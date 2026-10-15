"""
Cebu Infrastructure Geocoding Engine
====================================
Provides deterministic, high-accuracy WGS84 spatial geocoding for all 53
cities and municipalities, major barangays, rivers, and engineering districts
across Cebu Province, Philippines.
"""

import re
from typing import Dict, Any, Optional, Tuple, List
import logging

logger = logging.getLogger("geocoding")

# ---------------------------------------------------------------------------
# 1. Official Cebu Municipalities and Cities Coordinates (WGS84)
# ---------------------------------------------------------------------------
CEBU_MUNICIPALITIES_GEO: Dict[str, Dict[str, Any]] = {
    # Highly Urbanized & Independent Cities (Metro Cebu core)
    "cebu city": {"lat": 10.3157, "lng": 123.8854, "name": "Cebu City", "type": "City", "district": "Cebu City"},
    "mandaue": {"lat": 10.3323, "lng": 123.9357, "name": "Mandaue City", "type": "City", "district": "6th District"},
    "lapu lapu": {"lat": 10.3115, "lng": 123.9534, "name": "Lapu-Lapu City", "type": "City", "district": "Lone District"},

    # Component Cities
    "talisay": {"lat": 10.2447, "lng": 123.8494, "name": "Talisay City", "type": "City", "district": "1st District"},
    "toledo": {"lat": 10.3789, "lng": 123.6406, "name": "Toledo City", "type": "City", "district": "3rd District"},
    "naga": {"lat": 10.2078, "lng": 123.7583, "name": "City of Naga", "type": "City", "district": "1st District"},
    "carcar": {"lat": 10.1067, "lng": 123.6414, "name": "Carcar City", "type": "City", "district": "1st District"},
    "danao": {"lat": 10.5311, "lng": 124.0256, "name": "Danao City", "type": "City", "district": "5th District"},
    "bogo": {"lat": 11.0514, "lng": 124.0056, "name": "Bogo City", "type": "City", "district": "4th District"},

    # Metro Cebu & Surrounds Municipalities
    "minglanilla": {"lat": 10.2458, "lng": 123.7972, "name": "Minglanilla", "type": "Municipality", "district": "1st District"},
    "consolacion": {"lat": 10.3769, "lng": 123.9575, "name": "Consolacion", "type": "Municipality", "district": "6th District"},
    "liloan": {"lat": 10.4008, "lng": 123.9983, "name": "Liloan", "type": "Municipality", "district": "5th District"},
    "cordova": {"lat": 10.2544, "lng": 123.9500, "name": "Cordova", "type": "Municipality", "district": "6th District"},
    "compostela": {"lat": 10.4578, "lng": 124.0125, "name": "Compostela", "type": "Municipality", "district": "5th District"},
    "san fernando": {"lat": 10.1611, "lng": 123.7083, "name": "San Fernando", "type": "Municipality", "district": "1st District"},

    # Mid-West Cebu Municipalities
    "balamban": {"lat": 10.5000, "lng": 123.7167, "name": "Balamban", "type": "Municipality", "district": "3rd District"},
    "asturias": {"lat": 10.5694, "lng": 123.7139, "name": "Asturias", "type": "Municipality", "district": "3rd District"},
    "tuburan": {"lat": 10.7258, "lng": 123.8267, "name": "Tuburan", "type": "Municipality", "district": "3rd District"},
    "pinamungajan": {"lat": 10.2683, "lng": 123.5858, "name": "Pinamungajan", "type": "Municipality", "district": "3rd District"},
    "aloguinsan": {"lat": 10.2247, "lng": 123.5558, "name": "Aloguinsan", "type": "Municipality", "district": "3rd District"},
    "barili": {"lat": 10.1167, "lng": 123.5333, "name": "Barili", "type": "Municipality", "district": "3rd District"},

    # South-West Cebu (7th District)
    "dumanjug": {"lat": 10.0578, "lng": 123.4931, "name": "Dumanjug", "type": "Municipality", "district": "7th District"},
    "ronda": {"lat": 10.0036, "lng": 123.4472, "name": "Ronda", "type": "Municipality", "district": "7th District"},
    "alcantara": {"lat": 9.9778, "lng": 123.4056, "name": "Alcantara", "type": "Municipality", "district": "7th District"},
    "moalboal": {"lat": 9.9575, "lng": 123.4000, "name": "Moalboal", "type": "Municipality", "district": "7th District"},
    "badian": {"lat": 9.8667, "lng": 123.3986, "name": "Badian", "type": "Municipality", "district": "7th District"},
    "alegria": {"lat": 9.7667, "lng": 123.3444, "name": "Alegria", "type": "Municipality", "district": "7th District"},
    "malabuyoc": {"lat": 9.6583, "lng": 123.3217, "name": "Malabuyoc", "type": "Municipality", "district": "7th District"},
    "ginatilan": {"lat": 9.5786, "lng": 123.3181, "name": "Ginatilan", "type": "Municipality", "district": "7th District"},

    # South & South-East Cebu (2nd District)
    "samboan": {"lat": 9.5292, "lng": 123.3083, "name": "Samboan", "type": "Municipality", "district": "2nd District"},
    "santander": {"lat": 9.4219, "lng": 123.3361, "name": "Santander", "type": "Municipality", "district": "2nd District"},
    "oslob": {"lat": 9.5186, "lng": 123.4319, "name": "Oslob", "type": "Municipality", "district": "2nd District"},
    "boljoon": {"lat": 9.6389, "lng": 123.4778, "name": "Boljoon", "type": "Municipality", "district": "2nd District"},
    "alcoy": {"lat": 9.7042, "lng": 123.5042, "name": "Alcoy", "type": "Municipality", "district": "2nd District"},
    "dalaguete": {"lat": 9.7619, "lng": 123.5342, "name": "Dalaguete", "type": "Municipality", "district": "2nd District"},
    "argao": {"lat": 9.8825, "lng": 123.6000, "name": "Argao", "type": "Municipality", "district": "2nd District"},
    "sibonga": {"lat": 10.0150, "lng": 123.6167, "name": "Sibonga", "type": "Municipality", "district": "1st District"},

    # North Cebu (4th & 5th Districts)
    "carmen": {"lat": 10.5794, "lng": 124.0194, "name": "Carmen", "type": "Municipality", "district": "5th District"},
    "catmon": {"lat": 10.6867, "lng": 124.0083, "name": "Catmon", "type": "Municipality", "district": "5th District"},
    "sogod": {"lat": 10.7483, "lng": 124.0042, "name": "Sogod", "type": "Municipality", "district": "5th District"},
    "borbon": {"lat": 10.8389, "lng": 124.0250, "name": "Borbon", "type": "Municipality", "district": "5th District"},
    "tabogon": {"lat": 10.9333, "lng": 124.0306, "name": "Tabogon", "type": "Municipality", "district": "4th District"},
    "tabuelan": {"lat": 10.9333, "lng": 123.8833, "name": "Tabuelan", "type": "Municipality", "district": "4th District"},
    "san remigio": {"lat": 10.9833, "lng": 123.9500, "name": "San Remigio", "type": "Municipality", "district": "4th District"},
    "medellin": {"lat": 11.1333, "lng": 123.9667, "name": "Medellin", "type": "Municipality", "district": "4th District"},
    "daanbantayan": {"lat": 11.2583, "lng": 124.0167, "name": "Daanbantayan", "type": "Municipality", "district": "4th District"},

    # Bantayan Island Group
    "santa fe": {"lat": 11.1550, "lng": 123.8056, "name": "Santa Fe", "type": "Municipality", "district": "4th District"},
    "bantayan": {"lat": 11.1683, "lng": 123.7233, "name": "Bantayan", "type": "Municipality", "district": "4th District"},
    "madridejos": {"lat": 11.2750, "lng": 123.7317, "name": "Madridejos", "type": "Municipality", "district": "4th District"},

    # Camotes Island Group (5th District)
    "san francisco": {"lat": 10.6558, "lng": 124.3814, "name": "San Francisco", "type": "Municipality", "district": "5th District"},
    "poro": {"lat": 10.6319, "lng": 124.4106, "name": "Poro", "type": "Municipality", "district": "5th District"},
    "tudela": {"lat": 10.6472, "lng": 124.4750, "name": "Tudela", "type": "Municipality", "district": "5th District"},
    "pilar": {"lat": 10.8083, "lng": 124.5333, "name": "Pilar", "type": "Municipality", "district": "5th District"},
    "camotes": {"lat": 10.6558, "lng": 124.3814, "name": "Camotes Islands", "type": "Islands", "district": "5th District"},
}

# ---------------------------------------------------------------------------
# 2. Known Cebu Barangays Coordinates (Specific Granularity)
# ---------------------------------------------------------------------------
CEBU_BARANGAYS_GEO: Dict[str, Dict[str, Any]] = {
    # Cebu City (High Frequency)
    "paril": {"lat": 10.4283, "lng": 123.8864, "muni": "Cebu City", "name": "Paril"},
    "zapatera": {"lat": 10.3105, "lng": 123.9030, "muni": "Cebu City", "name": "Zapatera"},
    "budlaan": {"lat": 10.3750, "lng": 123.9028, "muni": "Cebu City", "name": "Budlaan"},
    "sirao": {"lat": 10.4258, "lng": 123.8683, "muni": "Cebu City", "name": "Sirao"},
    "malubog": {"lat": 10.3806, "lng": 123.8611, "muni": "Cebu City", "name": "Malubog"},
    "bacayan": {"lat": 10.3750, "lng": 123.9250, "muni": "Cebu City", "name": "Bacayan"},
    "sudlon": {"lat": 10.3444, "lng": 123.8056, "muni": "Cebu City", "name": "Sudlon"},
    "lahug": {"lat": 10.3347, "lng": 123.8967, "muni": "Cebu City", "name": "Lahug"},
    "mabolo": {"lat": 10.3242, "lng": 123.9142, "muni": "Cebu City", "name": "Mabolo"},
    "guadalupe": {"lat": 10.3275, "lng": 123.8767, "muni": "Cebu City", "name": "Guadalupe"},
    "talamban": {"lat": 10.3683, "lng": 123.9183, "muni": "Cebu City", "name": "Talamban"},
    "kasambagan": {"lat": 10.3278, "lng": 123.9100, "muni": "Cebu City", "name": "Kasambagan"},
    "busay": {"lat": 10.3608, "lng": 123.8783, "muni": "Cebu City", "name": "Busay"},
    "mambaling": {"lat": 10.2922, "lng": 123.8711, "muni": "Cebu City", "name": "Mambaling"},
    "labangon": {"lat": 10.3056, "lng": 123.8750, "muni": "Cebu City", "name": "Labangon"},
    "pardo": {"lat": 10.2847, "lng": 123.8539, "muni": "Cebu City", "name": "Pardo"},
    "tisa": {"lat": 10.3072, "lng": 123.8633, "muni": "Cebu City", "name": "Tisa"},
    "guba": {"lat": 10.4222, "lng": 123.9056, "muni": "Cebu City", "name": "Guba"},
    "binaliw": {"lat": 10.4111, "lng": 123.9167, "muni": "Cebu City", "name": "Binaliw"},
    "pit os": {"lat": 10.3944, "lng": 123.9222, "muni": "Cebu City", "name": "Pit-os"},
    "pulangbato": {"lat": 10.3833, "lng": 123.9278, "muni": "Cebu City", "name": "Pulangbato"},

    # Mandaue City
    "subangdaku": {"lat": 10.3283, "lng": 123.9286, "muni": "Mandaue City", "name": "Subangdaku"},
    "tipolo": {"lat": 10.3275, "lng": 123.9356, "muni": "Mandaue City", "name": "Tipolo"},
    "guizo": {"lat": 10.3314, "lng": 123.9389, "muni": "Mandaue City", "name": "Guizo"},
    "centro": {"lat": 10.3342, "lng": 123.9428, "muni": "Mandaue City", "name": "Centro"},
    "mantuyong": {"lat": 10.3333, "lng": 123.9406, "muni": "Mandaue City", "name": "Mantuyong"},
    "ibabao": {"lat": 10.3389, "lng": 123.9422, "muni": "Mandaue City", "name": "Ibabao-Estancia"},
    "alang alang": {"lat": 10.3367, "lng": 123.9467, "muni": "Mandaue City", "name": "Alang-Alang"},
    "looc": {"lat": 10.3286, "lng": 123.9472, "muni": "Mandaue City", "name": "Looc"},
    "opao": {"lat": 10.3250, "lng": 123.9514, "muni": "Mandaue City", "name": "Opao"},
    "umapad": {"lat": 10.3389, "lng": 123.9600, "muni": "Mandaue City", "name": "Umapad"},
    "paknaan": {"lat": 10.3500, "lng": 123.9528, "muni": "Mandaue City", "name": "Paknaan"},
    "labogon": {"lat": 10.3583, "lng": 123.9472, "muni": "Mandaue City", "name": "Labogon"},
    "jagobiao": {"lat": 10.3667, "lng": 123.9444, "muni": "Mandaue City", "name": "Jagobiao"},
    "canduman": {"lat": 10.3639, "lng": 123.9306, "muni": "Mandaue City", "name": "Canduman"},
    "casuntingan": {"lat": 10.3500, "lng": 123.9278, "muni": "Mandaue City", "name": "Casuntingan"},
    "maguikay": {"lat": 10.3444, "lng": 123.9389, "muni": "Mandaue City", "name": "Maguikay"},
    "tabok": {"lat": 10.3556, "lng": 123.9361, "muni": "Mandaue City", "name": "Tabok"},
    "bakilid": {"lat": 10.3361, "lng": 123.9306, "muni": "Mandaue City", "name": "Bakilid"},
    "cabancalan": {"lat": 10.3528, "lng": 123.9222, "muni": "Mandaue City", "name": "Cabancalan"},

    # Lapu-Lapu City
    "maribago": {"lat": 10.2944, "lng": 124.0028, "muni": "Lapu-Lapu City", "name": "Maribago"},
    "mactan": {"lat": 10.3083, "lng": 124.0167, "muni": "Lapu-Lapu City", "name": "Mactan"},
    "punta engano": {"lat": 10.3167, "lng": 124.0333, "muni": "Lapu-Lapu City", "name": "Punta Engaño"},
    "pusok": {"lat": 10.3228, "lng": 123.9664, "muni": "Lapu-Lapu City", "name": "Pusok"},
    "pajo": {"lat": 10.3167, "lng": 123.9556, "muni": "Lapu-Lapu City", "name": "Pajo"},
    "gun ob": {"lat": 10.3056, "lng": 123.9472, "muni": "Lapu-Lapu City", "name": "Gun-ob"},
    "marigondon": {"lat": 10.2778, "lng": 123.9833, "muni": "Lapu-Lapu City", "name": "Marigondon"},
    "agus": {"lat": 10.2861, "lng": 123.9917, "muni": "Lapu-Lapu City", "name": "Agus"},
    "babag": {"lat": 10.2972, "lng": 123.9611, "muni": "Lapu-Lapu City", "name": "Babag"},
    "ibo": {"lat": 10.3283, "lng": 123.9786, "muni": "Lapu-Lapu City", "name": "Ibo"},

    # Talisay City
    "lagtang": {"lat": 10.2583, "lng": 123.8361, "muni": "Talisay City", "name": "Lagtang"},
    "tabunok": {"lat": 10.2528, "lng": 123.8472, "muni": "Talisay City", "name": "Tabunok"},
    "san roque": {"lat": 10.2444, "lng": 123.8583, "muni": "Talisay City", "name": "San Roque"},
    "dumlog": {"lat": 10.2361, "lng": 123.8389, "muni": "Talisay City", "name": "Dumlog"},
    "bulacao": {"lat": 10.2583, "lng": 123.8472, "muni": "Talisay City", "name": "Bulacao"},
    "lawan": {"lat": 10.2528, "lng": 123.8333, "muni": "Talisay City", "name": "Lawaan"},
    "jaclupan": {"lat": 10.2722, "lng": 123.8111, "muni": "Talisay City", "name": "Jaclupan"},
    "manipis": {"lat": 10.2889, "lng": 123.7778, "muni": "Talisay City", "name": "Manipis"},

    # Other Key Barangays
    "somosa": {"lat": 10.9333, "lng": 124.0306, "muni": "Tabogon", "name": "Somosa"},
    "polo": {"lat": 9.9778, "lng": 123.4056, "muni": "Alcantara", "name": "Polo"},
    "calumboyan": {"lat": 10.7483, "lng": 124.0042, "muni": "Sogod", "name": "Calumboyan"},
    "lombo": {"lat": 9.6583, "lng": 123.3217, "muni": "Malabuyoc", "name": "Lombo"},
}

# ---------------------------------------------------------------------------
# 3. Known Typo and Alias Normalization
# ---------------------------------------------------------------------------
ALIASES: Dict[str, str] = {
    r"\bsta\.?\s*fe\b": "santa fe",
    r"\bsan remegio\b": "san remigio",
    r"\bpinamungahan\b": "pinamungajan",
    r"\bdamanjug\b": "dumanjug",
    r"\bmedelllin\b": "medellin",
    r"\blapu[- ]*lapu\b": "lapu lapu",
    r"\bcebu[- ]*city\b": "cebu city",
    r"\bcity of carcar\b": "carcar",
    r"\bcity of naga\b": "naga",
    r"\bcity of toledo\b": "toledo",
    r"\bcity of talisay\b": "talisay",
    r"\bcity of danao\b": "danao",
    r"\bcity of bogo\b": "bogo",
    r"\bbutuanon\b": "mandaue",
    r"\bbulacao river\b": "talisay",
    r"\bmanlapay\b": "dumanjug",
    r"\bguindaruhan\b": "minglanilla",
    r"\bkotkot\b": "liloan",
    r"\bluyang\b": "carmen",
}

# District Office Geocenter Coordinates
DISTRICT_DEO_GEO: Dict[str, Dict[str, Any]] = {
    "cebu 1st": {"lat": 10.2447, "lng": 123.8494, "muni": "Talisay City", "desc": "Cebu 1st DEO (Talisay, Minglanilla, Naga, San Fernando, Carcar, Sibonga)"},
    "cebu 2nd": {"lat": 9.8825, "lng": 123.6000, "muni": "Argao", "desc": "Cebu 2nd DEO (Argao, Dalaguete, Alcoy, Boljoon, Oslob, Santander, Samboan)"},
    "cebu 3rd": {"lat": 10.3789, "lng": 123.6406, "muni": "Toledo City", "desc": "Cebu 3rd DEO (Toledo, Balamban, Asturias, Tuburan, Pinamungajan, Aloguinsan, Barili)"},
    "cebu 4th": {"lat": 11.0514, "lng": 124.0056, "muni": "Bogo City", "desc": "Cebu 4th DEO (Bogo, San Remigio, Medellin, Daanbantayan, Bantayan Islands, Tabogon)"},
    "cebu 5th": {"lat": 10.5311, "lng": 124.0256, "muni": "Danao City", "desc": "Cebu 5th DEO (Danao, Compostela, Liloan, Carmen, Catmon, Sogod, Borbon, Camotes)"},
    "cebu 6th": {"lat": 10.3323, "lng": 123.9357, "muni": "Mandaue City", "desc": "Cebu 6th DEO (Mandaue City, Lapu-Lapu City, Consolacion, Cordova)"},
    "cebu 7th": {"lat": 10.0578, "lng": 123.4931, "muni": "Dumanjug", "desc": "Cebu 7th DEO (Dumanjug, Ronda, Alcantara, Moalboal, Badian, Alegria, Malabuyoc, Ginatilan)"},
}


def geocode_location(raw_location: Optional[str]) -> Dict[str, Any]:
    """
    Deterministically geocode any raw DPWH Cebu location string into structured WGS84 coordinates.

    Returns:
        dict with keys:
          - latitude (float)
          - longitude (float)
          - municipality (str)
          - barangay (str or None)
          - province (str)
          - formatted_address (str)
          - confidence (str: 'barangay' | 'municipality' | 'district' | 'province')
    """
    if not raw_location or not raw_location.strip():
        # Fallback to Cebu Provincial Capitol
        return {
            "latitude": 10.3157,
            "longitude": 123.8854,
            "municipality": "Cebu City",
            "barangay": None,
            "province": "Cebu",
            "formatted_address": "Cebu, Philippines",
            "confidence": "province"
        }

    loc_str = raw_location.strip()
    clean = loc_str.lower()
    for pat, repl in ALIASES.items():
        clean = re.sub(pat, repl, clean, flags=re.IGNORECASE)
    clean_norm = re.sub(r'[^a-z0-9\s]', ' ', clean)

    # 1. Check for Multi-Municipality Jurisdiction bundles (DEO Districts)
    for d_key, d_info in DISTRICT_DEO_GEO.items():
        if d_key in clean_norm or (d_info["muni"].lower() in clean_norm and "," in loc_str and len(loc_str.split(",")) >= 4):
            return {
                "latitude": d_info["lat"],
                "longitude": d_info["lng"],
                "municipality": d_info["muni"],
                "barangay": None,
                "province": "Cebu",
                "formatted_address": f"{d_info['muni']} (District Office), Cebu, Philippines",
                "confidence": "district"
            }

    # 2. Identify explicit Municipality or City match
    sorted_munis = sorted(CEBU_MUNICIPALITIES_GEO.items(), key=lambda x: len(x[0]), reverse=True)
    matched_muni_key = None
    matched_muni_info = None
    for m_key, m_info in sorted_munis:
        if re.search(r'\b' + re.escape(m_key) + r'\b', clean_norm):
            matched_muni_key = m_key
            matched_muni_info = m_info
            break

    # 3. Check for specific known Barangay matches
    matched_brgy_info = None
    for b_key, b_info in CEBU_BARANGAYS_GEO.items():
        if re.search(r'\b' + re.escape(b_key) + r'\b', clean_norm):
            # If a municipality was found, only accept barangays from the same municipality
            if matched_muni_info:
                if b_info["muni"].lower() in matched_muni_info["name"].lower() or matched_muni_key in b_info["muni"].lower():
                    matched_brgy_info = b_info
                    break
            else:
                matched_brgy_info = b_info
                break

    if matched_brgy_info:
        return {
            "latitude": matched_brgy_info["lat"],
            "longitude": matched_brgy_info["lng"],
            "municipality": matched_brgy_info["muni"],
            "barangay": matched_brgy_info["name"],
            "province": "Cebu",
            "formatted_address": f"Brgy. {matched_brgy_info['name']}, {matched_brgy_info['muni']}, Cebu, Philippines",
            "confidence": "barangay"
        }

    if matched_muni_info:
        # Extract possible custom barangay prefix before the municipality
        parts = [p.strip() for p in loc_str.split(",") if p.strip()]
        brgy_cand = None
        if len(parts) >= 2:
            first_part = parts[0]
            if not any(k in first_part.lower() for k in CEBU_MUNICIPALITIES_GEO):
                first_part = re.sub(r'^(BARANGAY|BRGY\.?|PUROK|SITIO)\s*', '', first_part, flags=re.IGNORECASE).strip()
                if first_part and first_part.lower() != "unspecified" and len(first_part) > 2:
                    brgy_cand = first_part.title()

        addr = f"{brgy_cand}, {matched_muni_info['name']}, Cebu, Philippines" if brgy_cand else f"{matched_muni_info['name']}, Cebu, Philippines"
        return {
            "latitude": matched_muni_info["lat"],
            "longitude": matched_muni_info["lng"],
            "municipality": matched_muni_info["name"],
            "barangay": brgy_cand,
            "province": "Cebu",
            "formatted_address": addr,
            "confidence": "barangay" if brgy_cand else "municipality"
        }

    # 4. Default fallback: Cebu Central Provincial Coordinates
    return {
        "latitude": 10.3157,
        "longitude": 123.8854,
        "municipality": "Cebu City",
        "barangay": None,
        "province": "Cebu",
        "formatted_address": f"{loc_str}, Cebu, Philippines",
        "confidence": "province"
    }


def geocode_neo4j_graph(driver, batch_size: int = 500) -> Dict[str, Any]:
    """
    Populate latitude, longitude, municipality, barangay, and formatted_address
    on all Location and Project nodes in Neo4j.
    """
    import time
    start = time.perf_counter()

    with driver.session() as s:
        # Step 1: Fetch all unique Location nodes
        loc_records = s.run("MATCH (l:Location) RETURN l.name AS name").data()
        total_locs = len(loc_records)
        logger.info(f"Geocoding {total_locs} Location nodes in Neo4j...")

        # Compute geocode dictionary
        loc_payloads = []
        for r in loc_records:
            name = r.get("name")
            if not name:
                continue
            geo = geocode_location(name)
            loc_payloads.append({
                "name": name,
                "lat": geo["latitude"],
                "lng": geo["longitude"],
                "muni": geo["municipality"],
                "brgy": geo["barangay"] or "",
                "addr": geo["formatted_address"],
                "conf": geo["confidence"]
            })

        # Step 2: Batch update Location nodes
        cypher_update_locs = """
        UNWIND $batch AS item
        MATCH (l:Location {name: item.name})
        SET l.latitude = item.lat,
            l.longitude = item.lng,
            l.municipality = item.muni,
            l.barangay = item.brgy,
            l.formatted_address = item.addr,
            l.geocoding_confidence = item.conf,
            l.geocoded = true
        """
        for i in range(0, len(loc_payloads), batch_size):
            chunk = loc_payloads[i:i + batch_size]
            s.run(cypher_update_locs, batch=chunk)

        # Step 3: Propagate geocoding attributes from Location to connected Projects
        cypher_propagate = """
        MATCH (p:Project)-[:LOCATED_IN]->(l:Location)
        WHERE l.latitude IS NOT NULL
        SET p.latitude = l.latitude,
            p.longitude = l.longitude,
            p.municipality = l.municipality,
            p.barangay = l.barangay,
            p.formatted_address = l.formatted_address
        RETURN count(p) AS updated_projects
        """
        prop_res = s.run(cypher_propagate).single()
        updated_projects = prop_res["updated_projects"] if prop_res else 0

    elapsed = time.perf_counter() - start
    return {
        "locations_geocoded": len(loc_payloads),
        "projects_geocoded": updated_projects,
        "elapsed_seconds": round(elapsed, 2)
    }
