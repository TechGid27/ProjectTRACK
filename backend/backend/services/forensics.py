"""
Image Forensics Service (Pillar 2 — Digital Image Forensics)
============================================================
Two tamper-evidence signals computed from a submitted photo:

1. Error Level Analysis (ELA): recompress the image as JPEG at a known quality
   and measure the per-pixel difference from the original. Spliced/edited
   regions compress differently from the rest of the frame, raising the score.
   We return a single normalized ``ela_score`` (0..~255 scale of mean abs diff);
   higher = more likely manipulated.

2. Perceptual hash (pHash): a 64-bit fingerprint robust to resize/recompression.
   Comparing a new photo's pHash against pHashes of PRIOR reports (Hamming
   distance) detects recycled/duplicate photos reused across submissions.

The combined ``forensics_verdict`` is one of: clean | suspicious | recycled.
"""

import io
import logging
from dataclasses import dataclass
from typing import Iterable, List, Optional

import imagehash
import numpy as np
from PIL import Image, ImageChops

logger = logging.getLogger("forensics")

# --- Tunable thresholds -----------------------------------------------------
# Mean-absolute ELA difference above this is treated as "suspicious".
ELA_SUSPICIOUS_THRESHOLD = 12.0
# JPEG quality used for the ELA recompression pass.
ELA_RESAVE_QUALITY = 90
# Max Hamming distance (out of 64 bits) to call two pHashes the same photo.
PHASH_RECYCLED_MAX_DISTANCE = 6


@dataclass
class ForensicsResult:
    """Combined forensic signals for a single photo."""
    ela_score: float
    phash: str
    phash_recycled: bool
    nearest_phash_distance: Optional[int]
    verdict: str  # clean | suspicious | recycled


def _load_image(image_bytes: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(image_bytes))
    # Normalize to RGB so ELA and hashing are deterministic.
    return img.convert("RGB")


def error_level_analysis(image_bytes: bytes, quality: int = ELA_RESAVE_QUALITY) -> float:
    """
    Compute an ELA score: mean absolute difference between the original image and
    a JPEG-recompressed copy. Higher indicates inconsistent compression (edits).
    """
    original = _load_image(image_bytes)
    buffer = io.BytesIO()
    original.save(buffer, format="JPEG", quality=quality)
    buffer.seek(0)
    resaved = Image.open(buffer).convert("RGB")

    diff = ImageChops.difference(original, resaved)
    arr = np.asarray(diff, dtype=np.float32)
    # Mean absolute difference across all channels/pixels.
    return float(arr.mean())


def perceptual_hash(image_bytes: bytes) -> str:
    """Return the perceptual hash (hex string) of an image."""
    img = _load_image(image_bytes)
    return str(imagehash.phash(img))


def hamming_distance(hash_a: str, hash_b: str) -> int:
    """Hamming distance between two hex pHash strings (bit difference, 0..64)."""
    ha = imagehash.hex_to_hash(hash_a)
    hb = imagehash.hex_to_hash(hash_b)
    return ha - hb


def is_recycled(
    phash: str,
    prior_phashes: Iterable[str],
    max_distance: int = PHASH_RECYCLED_MAX_DISTANCE,
):
    """
    Decide whether ``phash`` matches any prior report's hash within
    ``max_distance``. Returns (recycled: bool, nearest_distance: int | None).
    """
    nearest: Optional[int] = None
    for prior in prior_phashes:
        if not prior:
            continue
        try:
            dist = hamming_distance(phash, prior)
        except (ValueError, TypeError):
            continue
        if nearest is None or dist < nearest:
            nearest = dist
        if dist <= max_distance:
            return True, dist
    return False, nearest


def analyze(
    image_bytes: bytes,
    prior_phashes: Optional[List[str]] = None,
    ela_threshold: float = ELA_SUSPICIOUS_THRESHOLD,
    phash_max_distance: int = PHASH_RECYCLED_MAX_DISTANCE,
) -> ForensicsResult:
    """
    Run the full forensic pass and produce a combined verdict.

    Verdict precedence:
      * recycled  — pHash matches a prior report (strongest signal)
      * suspicious — ELA score exceeds the edit threshold
      * clean      — otherwise
    """
    ela_score = error_level_analysis(image_bytes)
    phash = perceptual_hash(image_bytes)
    recycled, nearest = is_recycled(phash, prior_phashes or [], phash_max_distance)

    if recycled:
        verdict = "recycled"
    elif ela_score >= ela_threshold:
        verdict = "suspicious"
    else:
        verdict = "clean"

    return ForensicsResult(
        ela_score=round(ela_score, 3),
        phash=phash,
        phash_recycled=recycled,
        nearest_phash_distance=nearest,
        verdict=verdict,
    )
