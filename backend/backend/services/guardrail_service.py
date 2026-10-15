"""
Domain Guardrail Service
========================
Multi-layer pre-retrieval intent classifier and post-generation stream guardrails.
Enforces domain locking to DPWH Cebu civil engineering projects, contractors,
budgets, and locations.
"""

import re
from typing import Tuple, Optional


STOP_WORDS = {
    "what", "are", "is", "the", "for", "in", "of", "and", "a", "an", "who", "which",
    "where", "how", "tell", "me", "about", "project", "projects", "located", "there",
    "any", "give", "list", "show", "it", "that", "this", "them", "some", "many",
    "much", "count", "number", "total", "sum", "can", "you", "please", "find",
    "all", "do", "does", "did", "have", "has", "had", "were", "was", "info", "details"
}

INFRA_DOMAIN_KEYWORDS = {
    "dpwh", "project", "projects", "infrastructure", "infra", "contractor", "contractors",
    "builder", "builders", "budget", "cost", "peso", "pesos", "allocated", "expenditure",
    "cebu", "mandaue", "lapu", "talisay", "toledo", "bogo", "naga", "carcar",
    "danao", "minglanilla", "consolacion", "cordova", "compostela", "liloan", "san fernando",
    "balamban", "asturias", "tuburan", "pinamungajan", "aloguinsan", "barili", "dumanjug",
    "ronda", "alcantara", "moalboal", "badian", "alegria", "malabuyoc", "ginatilan", "samboan",
    "santander", "oslob", "boljoon", "alcoy", "dalaguete", "argao", "sibonga", "san remigio",
    "medellin", "daanbantayan", "madridejos", "bantayan", "santa fe", "tabogon", "tabuelan",
    "borbon", "sogod", "catmon", "carmen", "camotes", "pilar", "poro", "san francisco",
    "tudela", "road", "roads", "highway", "bridge", "bridges", "flyover", "drainage",
    "flood", "river", "seawall", "building", "hall", "school", "slope", "deo", "status",
    "civil", "works", "engineering", "asphalt", "concrete", "paving", "rehabilitation"
}

CEBU_MUNICIPALITIES = {
    "cebu", "mandaue", "lapu", "talisay", "toledo", "bogo", "naga", "carcar",
    "danao", "minglanilla", "consolacion", "cordova", "compostela", "liloan", "san fernando",
    "balamban", "asturias", "tuburan", "pinamungajan", "aloguinsan", "barili", "dumanjug",
    "ronda", "alcantara", "moalboal", "badian", "alegria", "malabuyoc", "ginatilan", "samboan",
    "santander", "oslob", "boljoon", "alcoy", "dalaguete", "argao", "sibonga", "san remigio",
    "medellin", "daanbantayan", "madridejos", "bantayan", "santa fe", "tabogon", "tabuelan",
    "borbon", "sogod", "catmon", "carmen", "camotes", "pilar", "poro", "san francisco", "tudela"
}


def clean_location(loc: Optional[str]) -> str:
    """Standardize and clean location strings."""
    if not loc or not isinstance(loc, str):
        return "Cebu Province"
    val = loc.strip()
    if val.lower() in ["cebu", "cebu province", "region vii", "n/a", "none"]:
        return "Cebu Province"
    val = re.sub(r'^(?:cebu\s+province\s*[-–—:]*|region\s*vii\s*[-–—:]*)\s*', '', val, flags=re.IGNORECASE)
    return val.strip() or "Cebu Province"


def clean_description(desc: Optional[str]) -> str:
    """Format and clean project scope descriptions."""
    if not desc or not isinstance(desc, str):
        return "Civil works and infrastructure development"
    d = desc.strip()
    d = re.sub(r'^[,\s\-—:]+', '', d).strip()
    return d if d else desc


def sanitize_search_query(query: str) -> str:
    """Normalize common city variants and clean special Lucene characters."""
    q = re.sub(r'lapu[- ]*lapu', 'Lapu', query, flags=re.IGNORECASE)
    q = re.sub(r'cebu[- ]*city', 'Cebu City', q, flags=re.IGNORECASE)
    q = re.sub(r'[^a-zA-Z0-9\s]', ' ', q)
    words = [w for w in q.split() if len(w) > 2 and w.lower() not in STOP_WORDS]
    return " ".join(words) if words else q.strip()


def check_guardrail(query: str) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Sub-millisecond Pre-Retrieval Intent Classifier.
    Returns: (is_off_topic, reason, rule_name)
    """
    q_lower = query.lower().strip()

    # Layer 1: Direct Project ID exemption (e.g., "24HH0043", "25H00064")
    if re.search(r'\b\d{2}[A-Za-z]{1,2}\d{4,5}\b', query):
        return False, None, "project_id_exemption"

    # Layer 2: Domain code exemptions (e.g., "contractor code", "project code")
    if re.search(r'\b(?:contractor|project|office|procurement|district|dpwh)\s+code\b', q_lower):
        return False, None, "domain_code_exemption"

    # Layer 3: Programming, scripting, or coding query intent
    is_code_request = bool(re.search(
        r'\b(?:for\s+loops?|while\s+loops?|nested\s+loops?|'
        r'write\s+(?:a\s+)?(?:code|script|program|function|class)|'
        r'code\s+(?:for|to|in|example|snippet|sample)|'
        r'python|javascript|typescript|c\+\+|golang|rust|html|css|php|java\b|'
        r'function|syntax|algorithm|compiler|debugging|recursion|sql\s+query|'
        r'def\s+\w+|import\s+\w+|console\.log|print\()\b',
        q_lower
    ))
    if is_code_request:
        return True, "Programming and software code generation queries are outside system scope.", "programming_intent"

    # Layer 4: General trivia, jokes, creative writing
    is_creative = bool(re.search(
        r'\b(?:write\s+(?:a\s+)?(?:poem|poetry|story|essay|song|joke)|'
        r'tell\s+me\s+a\s+joke|weather\s+in|recipe\s+for|capital\s+of|'
        r'who\s+won|translate\s+(?:to|into)|how\s+to\s+cook)\b',
        q_lower
    ))
    if is_creative:
        return True, "General trivia and creative writing queries are outside system scope.", "creative_trivia_intent"

    # Layer 5: Non-domain generic definition queries (e.g. "what is dictionary?", "what is quantum?")
    def_match = re.search(r'^(?:what\s+(?:is|are|was|were)|define|explain|meaning\s+of)\s+(?:an?\s+|the\s+)?([a-zA-Z0-9_\s]+?)\??$', q_lower)
    if def_match:
        target = def_match.group(1).strip()
        target_words = set(target.split())
        has_domain = bool(target_words & INFRA_DOMAIN_KEYWORDS) or bool(re.search(r'\b\d{2}[A-Za-z]{1,2}\d{4,5}\b', target))
        if not has_domain:
            return True, f"Generic concept definitions outside DPWH civil engineering ('{target}') are outside system scope.", "generic_definition"

    # Layer 6: Persona adoption or prompt jailbreak attempts
    is_persona_override = bool(re.search(
        r'\b(?:act\s+as\s+(?:a|an)|you\s+are\s+now\s+(?:a|an)|pretend\s+to\s+be|'
        r'ignore\s+(?:all\s+)?(?:previous\s+)?instructions|jailbreak|dan\s+mode|'
        r'bypass\s+(?:rules|filters))\b',
        q_lower
    ))
    if is_persona_override:
        return True, "Persona adoption and roleplaying prompts are outside system scope.", "persona_override"

    return False, None, None


def is_prohibited_stream_chunk(text: str) -> bool:
    """Post-generation output rail: detects programming code or generic conceptual definitions."""
    t = text.lower()
    return bool(re.search(
        r'(?:```(?:python|javascript|js|ts|cpp|java|go|html|css)?|'
        r'\b(?:for\s+[a-zA-Z_]\w*\s+in\s+|while\s*\(|let\s+\w+\s*=|const\s+\w+\s*=|'
        r'def\s+[a-zA-Z_]\w*\(|function\s+[a-zA-Z_]\w*\(|console\.log|'
        r'System\.out\.println|printf\(|#include\s+<)|'
        r'is\s+a\s+programming\s+construct|is\s+a\s+looping\s+construct)\b',
        t
    ))
