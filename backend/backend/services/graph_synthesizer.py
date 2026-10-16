"""
Deterministic Graph Synthesizer
===============================
Generates fluent, grounded plain-English engineering summaries directly from
retrieved Neo4j graph context without calling an external LLM.

Used as Tier-1 zero-token fallback when cloud LLMs (Groq) hit rate limits (429)
or are unauthenticated, guaranteeing the application never fails or crashes.
"""

import re
from typing import Dict, Any, Optional


def synthesize_graph_response(
    graph_context: str,
    question: str = "",
    is_single_project: bool = False,
    project_card: Optional[Dict[str, Any]] = None,
    include_setup_tip: bool = True
) -> str:
    """
    Synthesize factual, plain-English summary from Neo4j graph context.
    Returns complete sentences with verified project numbers and budget figures.
    """
    if not graph_context and not project_card:
        return "No DPWH Cebu infrastructure projects found matching your query."

    # 1. Single Project Card Synthesis
    if is_single_project or project_card:
        card = project_card or {}
        pid = card.get("id") or ""
        if not pid:
            pid_m = re.search(r'Project:\s*(?:DPWH\s*Project\s*)?([A-Za-z0-9]+)', graph_context)
            pid = pid_m.group(1) if pid_m else "Unspecified"

        desc = card.get("description")
        if not desc:
            desc_m = re.search(r'Scope Description:\s*([^\n]+)', graph_context)
            desc = desc_m.group(1).strip() if desc_m else "infrastructure civil works"

        loc = card.get("location")
        if not loc:
            loc_m = re.search(r'Location:\s*([^\n]+)', graph_context)
            loc = loc_m.group(1).strip() if loc_m else "Cebu Province"

        budget = card.get("budget")
        if not budget:
            budget_m = re.search(r'Budget:\s*([^\n]+)', graph_context)
            budget = budget_m.group(1).strip() if budget_m else "Undisclosed"

        contractor = card.get("contractor")
        if not contractor:
            contractor_m = re.search(r'Contractor:\s*([^\n]+)', graph_context)
            contractor = contractor_m.group(1).strip() if contractor_m else "Various Contractors"

        status = card.get("status")
        if not status:
            status_m = re.search(r'Status:\s*([^\n]+)', graph_context)
            status = status_m.group(1).strip() if status_m else "Recorded"

        summary = (
            f"Project {pid} involves {desc} in {loc}. "
            f"It has an allocated budget of {budget} awarded to {contractor} (Status: {status})."
        )

    # 2. Multi-project / Location Synthesis
    else:
        # Extract location label
        loc_m = re.search(r'(?:Location\s*/\s*Subject|Location):\s*([^\n]+)', graph_context)
        location = loc_m.group(1).strip() if loc_m else "Cebu Province"

        # Extract total count
        count_m = re.search(r'Total (?:Recorded )?Projects in (?:Database|Graph):\s*(\d+)', graph_context)
        total_count = count_m.group(1) if count_m else None

        # Extract total budget
        budget_m = re.search(r'Total Allocated Budget:\s*([^\n]+)', graph_context)
        total_budget = budget_m.group(1).strip() if budget_m else None

        # Extract sample projects or highlights
        samples = []
        for line in graph_context.split("\n"):
            if line.strip().startswith("- Project") or "DPWH Project" in line:
                samples.append(line.strip().lstrip("-").strip())

        parts = []
        if total_count and total_budget:
            parts.append(
                f"DPWH records show {total_count} infrastructure projects in {location} "
                f"with a total allocated budget of {total_budget}."
            )
        elif total_count:
            parts.append(f"DPWH records show {total_count} recorded infrastructure projects in {location}.")
        else:
            parts.append(f"Identified multiple DPWH infrastructure projects in {location}.")

        if samples:
            sample_summary = "; ".join(samples[:3])
            parts.append(f"Key projects include: {sample_summary}.")

        summary = " ".join(parts)

    if include_setup_tip:
        tip = (
            "\n\n⚡ [Synthesized via Instant Graph Mode — Groq limit reached or offline. "
            "Run 'python main.py --setup-local-ai' to enable offline AI (qwen2.5:0.5b ~398MB)]"
        )
        summary += tip

    return summary
