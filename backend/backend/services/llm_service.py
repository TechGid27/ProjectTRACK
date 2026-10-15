"""
LLM Integration Service
=======================
Handles grounded prompt construction, token budgeting, and real-time streaming
for Groq (Llama 3.3 / 3.1) via Groq API or local OpenAI-compatible / Ollama
endpoints with guardrails.
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
    """Service for Groq and OpenAI-compatible LLM execution."""

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
        Check if the LLM provider (Groq / OpenAI-compatible / local) is responding.
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
                    # Check if local Ollama is active as fallback
                    local_model = await self.get_local_ollama_model()
                    if local_model:
                        return True, round((time.perf_counter() - start) * 1000, 2), f"Groq 401 (Auth error) — Local Ollama fallback active ({local_model})"
                    return False, round(latency, 2), "Authentication error: Missing or invalid Groq API key (GROQ_API_KEY / LLM_API_KEY)"
                return False, round(latency, 2), f"HTTP {resp.status_code}"
        except Exception as e:
            latency = (time.perf_counter() - start) * 1000
            # If remote fails, check if local ollama is running
            local_model = await self.get_local_ollama_model()
            if local_model:
                return True, round((time.perf_counter() - start) * 1000, 2), f"Remote LLM offline — Local Ollama fallback active ({local_model})"
            return False, round(latency, 2), str(e)

    async def get_local_ollama_model(self) -> Optional[str]:
        """Check if local Ollama is reachable and return a usable model name."""
        try:
            async with httpx.AsyncClient(timeout=1.0) as client:
                resp = await client.get("http://localhost:11434/api/tags")
                if resp.status_code == 200:
                    data = resp.json()
                    models = [m.get("name", "") for m in data.get("models", [])]
                    for m in models:
                        if "qwen2.5:0.5b" in m:
                            return m
                    if models:
                        return models[0]
                    return "qwen2.5:0.5b"
        except Exception:
            pass
        return None

    def extract_context_from_messages(self, messages: List[Dict[str, str]]) -> Tuple[str, str, bool]:
        """Extract graph_context, question, and single_project flag from conversation messages."""
        graph_context = ""
        question = ""
        is_single = False
        for m in messages:
            content = m.get("content", "")
            if m.get("role") == "system":
                if "1 to 2 sentence plain-English summary of what this project accomplishes" in content:
                    is_single = True
            elif m.get("role") == "user":
                if "Knowledge Graph Context:\n" in content:
                    parts = content.split("Knowledge Graph Context:\n", 1)[1]
                    if "\n\nUser Question: " in parts:
                        ctx, q = parts.split("\n\nUser Question: ", 1)
                        graph_context = ctx.strip()
                        question = q.strip()
                    elif "\n\nTopic: " in parts:
                        graph_context = parts.split("\n\nTopic: ", 1)[0].strip()
                        question = content
                    else:
                        graph_context = parts.strip()
                else:
                    question = content
        return graph_context, question, is_single

    def build_system_prompt(self, is_single_project: bool = False) -> str:
        """Construct grounded DPWH civil engineering system prompt optimized for Groq."""
        if is_single_project:
            return (
                "You are ProjectTRACK AI, an expert DPWH civil engineering assistant in Cebu, Philippines powered by Groq.\n"
                "Provide a concise 1 to 2 sentence plain-English summary of what this project accomplishes.\n\n"
                "CRITICAL RULES:\n"
                "1. Focus ONLY on what is being constructed, repaired, or installed and its practical public benefit.\n"
                "2. Do NOT recite raw budget figures, dates, contractor name, or office name (the project card displays them).\n"
                "3. NEVER use the phrase 'Barangay Unspecified'.\n"
                "4. Always output complete, grammatically finished sentences ending with terminal punctuation (. or !)."
            )
        return (
            "You are ProjectTRACK AI, an expert DPWH civil engineering assistant in Cebu, Philippines powered by Groq.\n"
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
        """Non-streaming generation returning complete grounded answer with multi-tier fallback."""
        effective_tokens = self.get_effective_max_tokens(max_tokens)
        headers = self.get_headers()

        # Tier 0: Primary Cloud LLM (Groq / OpenAI-compatible endpoint)
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
                        if not content and msg.get("reasoning_content"):
                            content = msg["reasoning_content"].strip()
                        if is_prohibited_stream_chunk(content):
                            return "I am restricted to answering questions regarding DPWH Cebu infrastructure projects."
                        return content
                else:
                    logger.warning(f"Groq completions error ({resp.status_code}): {resp.text}")
        except Exception as e:
            logger.debug(f"Groq completions endpoint failed: {e}")

        # Tier 1 Fallback: Local Ollama (qwen2.5:0.5b or local model)
        local_model = await self.get_local_ollama_model()
        if local_model:
            try:
                payload_ollama = {
                    "model": local_model,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "num_ctx": 2048,
                        "num_predict": effective_tokens,
                        "temperature": 0.3,
                    }
                }
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.post("http://localhost:11434/api/chat", json=payload_ollama)
                    if resp.status_code == 200:
                        data = resp.json()
                        answer = data.get("message", {}).get("content", "").strip()
                        if is_prohibited_stream_chunk(answer):
                            return "I am restricted to answering questions regarding DPWH Cebu infrastructure projects."
                        if answer:
                            return f"{answer}\n\n⚡ [Generated via Offline Local Model: {local_model}]"
            except Exception as e:
                logger.warning(f"Local Ollama fallback failed: {e}")

        # Tier 2 Fallback: Instant Graph Deterministic Synthesizer (<5ms)
        from backend.services.graph_synthesizer import synthesize_graph_response
        ctx, q, is_single = self.extract_context_from_messages(messages)
        return synthesize_graph_response(
            graph_context=ctx,
            question=q,
            is_single_project=is_single,
            include_setup_tip=True
        )

    async def stream_tokens(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 2048
    ) -> AsyncGenerator[str, None]:
        """Stream response tokens as an asynchronous generator with multi-tier fallback."""
        effective_tokens = self.get_effective_max_tokens(max_tokens)
        headers = self.get_headers()

        # Tier 0: Primary Cloud LLM (Groq / OpenAI-compatible endpoint)
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
                                        success = True
                            except json.JSONDecodeError:
                                continue
                    else:
                        err_body = (await resp.aread()).decode("utf-8", errors="replace")
                        logger.warning(f"Groq streaming error ({resp.status_code}): {err_body}")
        except Exception as e:
            logger.debug(f"Groq stream endpoint connection error: {e}")

        if success:
            return

        # Tier 1 Fallback: Local Ollama (qwen2.5:0.5b or local model)
        local_model = await self.get_local_ollama_model()
        if local_model:
            try:
                payload_ollama = {
                    "model": local_model,
                    "messages": messages,
                    "stream": True,
                    "options": {
                        "num_ctx": 2048,
                        "num_predict": effective_tokens,
                        "temperature": 0.3,
                    }
                }
                ollama_collected = ""
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    async with client.stream("POST", "http://localhost:11434/api/chat", json=payload_ollama) as resp:
                        if resp.status_code == 200:
                            async for line in resp.aiter_lines():
                                if not line:
                                    continue
                                try:
                                    d = json.loads(line)
                                    chunk = d.get("message", {}).get("content", "")
                                    if chunk:
                                        ollama_collected += chunk
                                        if is_prohibited_stream_chunk(ollama_collected):
                                            yield "\n[Output Suppressed by Guardrail: Detected off-domain output]"
                                            return
                                        yield chunk
                                    if d.get("done", False):
                                        break
                                except json.JSONDecodeError:
                                    continue
                if ollama_collected:
                    yield f"\n\n⚡ [Generated via Offline Local Model: {local_model}]"
                    return
            except Exception as e:
                logger.warning(f"Local Ollama streaming failed: {e}")

        # Tier 2 Fallback: Instant Graph Deterministic Synthesizer (<5ms)
        from backend.services.graph_synthesizer import synthesize_graph_response
        ctx, q, is_single = self.extract_context_from_messages(messages)
        synthesized = synthesize_graph_response(
            graph_context=ctx,
            question=q,
            is_single_project=is_single,
            include_setup_tip=True
        )
        words = synthesized.split(" ")
        for i, w in enumerate(words):
            yield w if i == len(words) - 1 else w + " "


# Global singleton instance
llm_service = LLMService()
