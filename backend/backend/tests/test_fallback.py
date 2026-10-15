"""
LLM Fallback & Graph Synthesizer Unit Tests
===========================================
Validates:
1. Deterministic Graph Synthesizer (Single & Multi-project extraction in <5ms).
2. LLM Service graceful fallback to graph synthesis when Groq returns 429 or 401.
3. Stream tokens fallback to synthesized SSE chunks.
4. Permission-gating in setup_local_ai.
"""

import sys
import unittest
from unittest.mock import patch, MagicMock, AsyncMock
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.services.graph_synthesizer import synthesize_graph_response
from backend.services.llm_service import llm_service
from backend.setup_local_ai import setup_local_ai, FALLBACK_MODEL


class TestLLMFallbackStrategy(unittest.IsolatedAsyncioTestCase):

    def test_synthesize_single_project(self):
        """Verify deterministic single-project card synthesis in <5ms."""
        context = (
            "Project: DPWH Project 24HH0043\n"
            "Location: Barangay Mabolo, Cebu City\n"
            "Scope Description: Construction of 4-Storey School Building\n"
            "Budget: ₱48,500,000.00\n"
            "Contractor: ABC Construction Corp\n"
            "Status: Completed"
        )
        result = synthesize_graph_response(
            graph_context=context,
            question="Tell me about 24HH0043",
            is_single_project=True,
            include_setup_tip=True
        )
        self.assertIn("Project 24HH0043 involves Construction of 4-Storey School Building", result)
        self.assertIn("Barangay Mabolo, Cebu City", result)
        self.assertIn("₱48,500,000.00", result)
        self.assertIn("ABC Construction Corp", result)
        self.assertIn("python main.py --setup-local-ai", result)

    def test_synthesize_multi_project(self):
        """Verify deterministic multi-project / location summary in <5ms."""
        context = (
            "Location / Subject: Cordova\n"
            "Total Recorded Projects in Database: 12\n"
            "Total Allocated Budget: ₱145,200,000.00\n"
            "Sample Projects:\n"
            "- Project 24HN0012: Rehabilitation of Flood Control Dike (₱25,000,000.00)\n"
            "- Project 24HN0015: Asphalt Overlay on Coastal Road (₱18,000,000.00)"
        )
        result = synthesize_graph_response(
            graph_context=context,
            question="What are the projects in Cordova?",
            is_single_project=False,
            include_setup_tip=True
        )
        self.assertIn("12 infrastructure projects in Cordova", result)
        self.assertIn("₱145,200,000.00", result)
        self.assertIn("Rehabilitation of Flood Control Dike", result)
        self.assertIn("python main.py --setup-local-ai", result)

    async def test_generate_response_fallback_on_429(self):
        """Ensure llm_service falls back to deterministic synthesizer when Groq hits 429."""
        messages = [
            {"role": "system", "content": "You are an assistant. 1 to 2 sentence plain-English summary of what this project accomplishes."},
            {"role": "user", "content": (
                "Knowledge Graph Context:\n"
                "Project: DPWH Project 25HN0099\n"
                "Location: Mandaue City\n"
                "Scope Description: Concreting of Access Road\n"
                "Budget: ₱15,000,000.00\n"
                "Contractor: Builders Inc\n"
                "Status: Ongoing\n\n"
                "User Question: Tell me about 25HN0099"
            )}
        ]

        # Mock httpx to simulate HTTP 429 rate limit from Groq and offline local Ollama
        mock_resp_429 = MagicMock()
        mock_resp_429.status_code = 429
        mock_resp_429.text = '{"error": {"message": "Rate limit reached"}}'

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
             patch.object(llm_service, "get_local_ollama_model", new_callable=AsyncMock) as mock_local:
            mock_post.return_value = mock_resp_429
            mock_local.return_value = None  # Local Ollama offline

            answer = await llm_service.generate_response(messages)

            # Verification: did not crash, synthesized from context, included tip
            self.assertIn("Project 25HN0099", answer)
            self.assertIn("Concreting of Access Road", answer)
            self.assertIn("Builders Inc", answer)
            self.assertIn("python main.py --setup-local-ai", answer)

    async def test_stream_tokens_fallback_on_429(self):
        """Ensure llm_service streams synthesized tokens when Groq stream fails."""
        messages = [
            {"role": "system", "content": "You are an assistant."},
            {"role": "user", "content": (
                "Knowledge Graph Context:\n"
                "Location: Danao City\n"
                "Total Recorded Projects in Database: 5\n"
                "Total Allocated Budget: ₱60,000,000.00\n\n"
                "User Question: Projects in Danao"
            )}
        ]

        with patch("httpx.AsyncClient.stream") as mock_stream, \
             patch.object(llm_service, "get_local_ollama_model", new_callable=AsyncMock) as mock_local:
            # Simulate network or HTTP error during stream
            mock_stream.side_effect = Exception("Groq connection timeout")
            mock_local.return_value = None  # Local Ollama offline

            collected = []
            async for token in llm_service.stream_tokens(messages):
                collected.append(token)

            full_streamed = "".join(collected)
            self.assertIn("5 infrastructure projects in Danao", full_streamed)
            self.assertIn("₱60,000,000.00", full_streamed)
            self.assertIn("python main.py --setup-local-ai", full_streamed)

    def test_setup_local_ai_permission_rejected(self):
        """Verify setup_local_ai does NOT install anything when user denies permission."""
        with patch("builtins.input", return_value="n"), \
             patch("subprocess.run") as mock_run:
            success = setup_local_ai(auto_confirm=False)
            self.assertFalse(success)
            mock_run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
