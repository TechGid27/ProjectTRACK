"""
LLM Integration Service
=======================
Handles grounded prompt construction, token budgeting, and real-time streaming
for XiaomiMiMo/MiMo-V2-Flash via Hugging Face Inference API, Xiaomi MiMo API,
or local OpenAI-compatible / Ollama endpoints with guardrails.
"""

import json
import time
import logging
from typing import AsyncGenerator, Dict, List, Optional, Tuple, Any
import httpx

from backend.config import settings
from backend.services.guardrail_service import is_prohibited_stream_chunk

logger = logging.getLogger("llm_service")


class LLMService:
    """Service for Xiaomi MiMo-V2-Flash and OpenAI-compatible LLM execution."""

    def __init__(self):
        self.model = settings.LLM_MODEL
        self.base_url = settings.LLM_BASE_URL.rstrip("/")
        self.native_ollama_url = settings.LLM_NATIVE_OLLAMA_URL
        self.api_key = settings.LLM_API_KEY
        self.timeout = settings.LLM_TIMEOUT

    def is_local_llm(self) -> bool:
        """Check if LLM is running on localhost."""
        return "localhost" in self.base_url or "127.0.0.1" in self.base_url

    def get_effective_max_tokens(self, requested_tokens: int = 2048) -> int:
        """Uncapped / generous token management for complete, uninterrupted generation."""
        return max(requested_tokens, settings.LLM_MAX_TOKENS)

    def get_headers(self) -> Dict[str, str]:
        """Construct standard authorization and content headers."""
        headers = {"Content-Type": "application/json"}
        if self.api_key and self.api_key.lower() not in ("ollama", "none", ""):
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def check_connection(self) -> Tuple[bool, float, Optional[str]]:
        """
        Check if the LLM provider (Hugging Face Router / Xiaomi MiMo / local) is responding.
        Returns: (reachable, latency_ms, error_message)
        """
        start = time.perf_counter()
        headers = self.get_headers()

        # Check /models endpoint
        models_url = f"{self.base_url}/models" if "/v1" in self.base_url else f"{self.base_url}/v1/models"
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(models_url, headers=headers)
                latency = (time.perf_counter() - start) * 1000
                if resp.status_code in (200, 204):
                    return True, round(latency, 2), None
                if resp.status_code == 401:
                    return False, round(latency, 2), "Authentication error: Missing or invalid API key"
                return False, round(latency, 2), f"HTTP {resp.status_code}"
        except Exception as e:
            latency = (time.perf_counter() - start) * 1000
            # If remote fails and local ollama is running, check local
            if self.is_local_llm():
                try:
                    async with httpx.AsyncClient(timeout=2.0) as client:
                        resp = await client.get("http://localhost:11434/api/tags")
                        if resp.status_code == 200:
                            return True, round((time.perf_counter() - start) * 1000, 2), None
                except Exception:
                    pass
            return False, round(latency, 2), str(e)

    def build_system_prompt(self, is_single_project: bool = False) -> str:
        """Construct grounded DPWH civil engineering system prompt optimized for MiMo-V2-Flash."""
        if is_single_project:
            return (
                "You are MiMo, an expert DPWH civil engineering assistant in Cebu, Philippines developed by Xiaomi.\n"
                "Provide a concise 1 to 2 sentence plain-English summary of what this project accomplishes.\n\n"
                "CRITICAL RULES:\n"
                "1. Focus ONLY on what is being constructed, repaired, or installed and its practical public benefit.\n"
                "2. Do NOT recite raw budget figures, dates, contractor name, or office name (the project card displays them).\n"
                "3. NEVER use the phrase 'Barangay Unspecified'.\n"
                "4. Always output complete, grammatically finished sentences ending with terminal punctuation (. or !)."
            )
        return (
            "You are MiMo, an expert DPWH civil engineering assistant in Cebu, Philippines developed by Xiaomi.\n"
            "Answer the user query based ONLY on the retrieved facts from the DPWH Cebu Knowledge Graph.\n\n"
            "CRITICAL RULES:\n"
            "1. Answer concisely in 2 to 4 sentences.\n"
            "2. State project names, contractors, and total budgets clearly.\n"
            "3. If multiple projects are found, synthesize key highlights.\n"
            "4. NEVER invent or hallucinate projects outside the provided context."
        )

    def construct_messages(
        self,
        question: str,
        graph_context: str,
        history: Optional[List[Dict[str, str]]] = None,
        is_single_project: bool = False
    ) -> List[Dict[str, str]]:
        """Build conversation payload with domain grounding."""
        system_prompt = self.build_system_prompt(is_single_project=is_single_project)
        messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]

        if history:
            for h in history[-4:]:
                messages.append({"role": h["role"], "content": h["content"]})

        user_content = f"Knowledge Graph Context:\n{graph_context}\n\nUser Question: {question}"
        messages.append({"role": "user", "content": user_content})
        return messages

    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 2048
    ) -> str:
        """Non-streaming generation returning complete grounded answer."""
        effective_tokens = self.get_effective_max_tokens(max_tokens)
        headers = self.get_headers()

        # 1. Primary: Standard OpenAI-compatible /chat/completions (Hugging Face / Xiaomi MiMo / vLLM / SGLang)
        completions_url = f"{self.base_url}/chat/completions"
        payload_v1 = {
            "model": self.model,
            "messages": messages,
            "max_tokens": effective_tokens,
            "temperature": 0.3,
            "stream": False
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(completions_url, headers=headers, json=payload_v1)
                if resp.status_code == 200:
                    data = resp.json()
                    choices = data.get("choices", [])
                    if choices:
                        msg = choices[0].get("message", {})
                        content = msg.get("content", "").strip()
                        # Fallback to reasoning_content if thinking model returned empty content
                        if not content and msg.get("reasoning_content"):
                            content = msg["reasoning_content"].strip()
                        if is_prohibited_stream_chunk(content):
                            return "I am restricted to answering questions regarding DPWH Cebu infrastructure projects."
                        return content
                else:
                    logger.warning(f"OpenAI completions error ({resp.status_code}): {resp.text}")
        except Exception as e:
            logger.debug(f"OpenAI completions endpoint failed: {e}")

        # 2. Secondary fallback: Local Ollama native endpoint (if running locally)
        if self.is_local_llm():
            try:
                payload_ollama = {
                    "model": self.model,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "num_ctx": 2048,
                        "num_predict": effective_tokens,
                        "temperature": 0.3,
                    }
                }
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.post(self.native_ollama_url, json=payload_ollama)
                    if resp.status_code == 200:
                        data = resp.json()
                        answer = data.get("message", {}).get("content", "").strip()
                        if is_prohibited_stream_chunk(answer):
                            return "I am restricted to answering questions regarding DPWH Cebu infrastructure projects."
                        return answer
            except Exception as e:
                logger.error(f"Ollama native fallback failed: {e}")

        return (
            "MiMo AI analysis could not be completed. Graph facts are provided above. "
            "(Please verify your LLM_API_KEY in .env if using Hugging Face or Xiaomi MiMo API)"
        )

    async def stream_tokens(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 2048
    ) -> AsyncGenerator[str, None]:
        """Stream response tokens as an asynchronous generator using standard SSE."""
        effective_tokens = self.get_effective_max_tokens(max_tokens)
        headers = self.get_headers()

        # 1. Primary: Standard OpenAI-compatible SSE streaming
        completions_url = f"{self.base_url}/chat/completions"
        payload_v1 = {
            "model": self.model,
            "messages": messages,
            "max_tokens": effective_tokens,
            "temperature": 0.3,
            "stream": True
        }

        collected_text = ""
        success = False

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream("POST", completions_url, headers=headers, json=payload_v1) as resp:
                    if resp.status_code == 200:
                        success = True
                        async for line in resp.aiter_lines():
                            if not line or not line.startswith("data: "):
                                continue
                            line_data = line[6:].strip()
                            if line_data == "[DONE]":
                                break
                            try:
                                d = json.loads(line_data)
                                choices = d.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {})
                                    chunk = delta.get("content", "")
                                    if chunk:
                                        collected_text += chunk
                                        if is_prohibited_stream_chunk(collected_text):
                                            yield "\n[Output Suppressed by Guardrail: Detected off-domain output]"
                                            return
                                        yield chunk
                            except json.JSONDecodeError:
                                continue
                    else:
                        err_body = (await resp.aread()).decode("utf-8", errors="replace")
                        logger.warning(f"Streaming error ({resp.status_code}): {err_body}")
        except Exception as e:
            logger.debug(f"OpenAI stream endpoint connection error: {e}")

        # 2. Secondary fallback: Local Ollama native streaming (if local)
        if not success and self.is_local_llm():
            try:
                payload_ollama = {
                    "model": self.model,
                    "messages": messages,
                    "stream": True,
                    "options": {
                        "num_ctx": 2048,
                        "num_predict": effective_tokens,
                        "temperature": 0.3,
                    }
                }
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    async with client.stream("POST", self.native_ollama_url, json=payload_ollama) as resp:
                        if resp.status_code == 200:
                            async for line in resp.aiter_lines():
                                if not line:
                                    continue
                                try:
                                    d = json.loads(line)
                                    chunk = d.get("message", {}).get("content", "")
                                    if chunk:
                                        collected_text += chunk
                                        if is_prohibited_stream_chunk(collected_text):
                                            yield "\n[Output Suppressed by Guardrail: Detected off-domain output]"
                                            return
                                        yield chunk
                                    if d.get("done", False):
                                        break
                                except json.JSONDecodeError:
                                    continue
            except Exception as e:
                logger.error(f"Ollama native stream error: {e}")
                yield f"\n[Streaming error: {e}]"


# Global singleton instance
llm_service = LLMService()
