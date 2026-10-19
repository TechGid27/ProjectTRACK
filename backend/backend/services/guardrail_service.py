"""
Domain Guardrail Service
========================
Multi-layer pre-retrieval intent classifier and post-generation stream guardrails.
Enforces domain locking to DPWH Cebu civil engineering projects, contractors,
budgets, and locations.
"""

import re
import unicodedata
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


# Characters commonly abused to smuggle hidden instructions past text filters:
# zero-width spaces/joiners, bidi overrides, BOM, and other invisibles.
_INVISIBLE_CHARS = (
    "\u200b\u200c\u200d\u200e\u200f"  # zero-width + LTR/RTL marks
    "\u202a\u202b\u202c\u202d\u202e"  # bidi embedding/override
    "\u2060\u2061\u2062\u2063\u2064"  # word joiner / invisible operators
    "\ufeff"                              # BOM / zero-width no-break space
)
_INVISIBLE_RE = re.compile("[" + _INVISIBLE_CHARS + "]")
# ASCII/C1 control characters except tab/newline/carriage-return.
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")

# Defensive hard cap mirroring the ChatRequest max_length so oversized history
# items (which skip request-model validation) cannot balloon the prompt.
MAX_INPUT_CHARS = 2000


def sanitize_user_input(text: Optional[str], max_chars: int = MAX_INPUT_CHARS) -> str:
    """
    Normalize untrusted user/history text before it reaches the guardrail or LLM.

    Defends against common prompt-injection smuggling techniques:
      * Unicode normalization (NFKC) folds homoglyph / full-width look-alikes
        back to canonical ASCII so "?????????????????" style tricks are detectable.
      * Strips zero-width, bidi-override and other invisible characters used to
        hide instructions inside otherwise innocent text.
      * Strips control characters (keeping tab/newline).
      * Collapses runs of >2 blank lines and very long whitespace runs that are
        used to push a system prompt out of view ("prompt flooding").
      * Enforces a hard length cap.

    This is normalization, not blocking: the intent classifier (check_guardrail)
    still decides whether the cleaned text is in scope.
    """
    if not text or not isinstance(text, str):
        return ""
    t = unicodedata.normalize("NFKC", text)
    t = _INVISIBLE_RE.sub("", t)
    t = _CONTROL_RE.sub("", t)
    # Collapse excessive blank lines and horizontal whitespace.
    t = re.sub(r"[ \t]{4,}", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    t = t.strip()
    if len(t) > max_chars:
        t = t[:max_chars].rstrip()
    return t


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
    # Word-boundary anchored natural-language injection phrases.
    persona_phrase = bool(re.search(
        r'\b(?:'
        r'act\s+as\s+(?:a|an|the)?|you\s+are\s+(?:now|henceforth|from\s+now\s+on)|'
        r'pretend\s+(?:to\s+be|you\s+are)|roleplay|role-play|simulate\s+(?:a|an|being)|'
        # ignore / disregard / forget prior instructions or context (optional noun)
        r'(?:ignore|disregard|forget|override|bypass|reset|erase)\s+'
        r'(?:all\s+|everything\s+|any\s+)?(?:the\s+)?'
        r'(?:previous|prior|above|earlier|preceding|former|system|initial|original)'
        r'(?:\s+(?:instructions?|prompts?|rules?|guidelines?|constraints?|context|messages?))?|'
        r'(?:ignore|disregard|forget|override|bypass)\s+'
        r'(?:all\s+|everything\s+|any\s+)?(?:the\s+)?'
        r'(?:instructions?|prompts?|rules?|guidelines?|constraints?|context|messages?)|'
        r'ignore\s+everything|forget\s+(?:what|everything|all)|'
        # persona / mode jailbreaks
        r'jailbreak|dan\s+mode|do\s+anything\s+now|developer\s+mode|god\s+mode|'
        r'unfiltered\s+mode|no\s+restrictions|without\s+(?:any\s+)?restrictions|'
        # prompt / instruction exfiltration
        r'(?:reveal|show|print|repeat|output|display|tell\s+me)\s+'
        r'(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?|rules?|guidelines?|configuration)|'
        r'what\s+(?:is|are)\s+your\s+(?:system\s+)?(?:prompt|instructions?)|'
        r'repeat\s+the\s+(?:words|text)\s+above|'
        r'new\s+(?:instructions?|rules?|system\s+prompt)'
        r')\b',
        q_lower
    ))
    # Delimiter / fake-role / chat-template injection markers (no word boundary).
    delimiter_inject = bool(re.search(
        r'(?:</?\s*(?:system|assistant|user|im_start|im_end)\s*>|'
        r'\[/?\s*inst\s*\]|<\|\s*(?:im_start|im_end|system|user|assistant)|'
        r'```\s*system|^\s*system\s*:)',
        q_lower
    ))
    if persona_phrase or delimiter_inject:
        return True, "Persona adoption, instruction-override, and prompt-injection attempts are outside system scope.", "persona_override"

    return False, None, None


def is_prohibited_stream_chunk(text: str) -> bool:
    """Post-generation output rail: detects programming code or generic conceptual definitions."""
    t = text.lower()
    # NOTE: the "for <var> in <iter>" rule must require a CODE context. The
    # bare "for \\w+ in " pattern previously matched ordinary English prose such
    # as "for traffic in Lapu-Lapu" and wrongly suppressed valid answers. We now
    # only flag a for/in when it is followed by a typical Python iterable
    # (range(/enumerate(/zip(, a list/tuple literal) or ends the clause with a
    # colon -- shapes that do not occur in natural-language sentences.
    return bool(re.search(
        r'(?:```(?:python|javascript|js|ts|cpp|java|go|html|css)?|'
        r'\bfor\s+[a-zA-Z_]\w*\s+in\s+(?:range\(|enumerate\(|zip\(|\[|\()|'
        r'\bfor\s+[a-zA-Z_]\w*\s+in\s+[^\n:]{1,60}:\s|'
        r'\b(?:while\s*\(|let\s+\w+\s*=|const\s+\w+\s*=|'
        r'def\s+[a-zA-Z_]\w*\(|function\s+[a-zA-Z_]\w*\(|console\.log|'
        r'System\.out\.println|printf\(|#include\s+<)|'
        r'is\s+a\s+programming\s+construct|is\s+a\s+looping\s+construct)',
        t
    ))
