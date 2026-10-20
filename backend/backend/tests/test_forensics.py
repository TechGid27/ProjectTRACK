"""
Image Forensics Tests (Pillar 2)
================================
Fixtures are generated in-memory (no binary assets committed). The base scene is
a smooth vertical gradient with a couple of solid shapes — enough stable
mid-frequency structure for a deterministic perceptual hash, while remaining
smooth enough that a spliced (differently-compressed) region raises the mean
ELA score above a clean capture.
"""

import io
import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import numpy as np
from PIL import Image, ImageDraw

from backend.services import forensics


def _scene(w=256, h=256) -> Image.Image:
    """Smooth vertical gradient + two solid shapes: stable pHash, low baseline ELA."""
    y = np.linspace(40, 200, h, dtype=np.uint8)
    base = np.stack([np.tile(y.reshape(h, 1), (1, w))] * 3, axis=-1).astype("uint8")
    img = Image.fromarray(base, "RGB")
    d = ImageDraw.Draw(img)
    d.rectangle([30, 30, 110, 110], fill=(200, 60, 60))
    d.ellipse([140, 140, 220, 220], fill=(60, 160, 200))
    return img


def _jpeg_bytes(img: Image.Image, quality=95) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


def _clean_bytes() -> bytes:
    return _jpeg_bytes(_scene(), 95)


def _spliced_bytes() -> bytes:
    """A region that was heavily recompressed, pasted into a high-quality frame."""
    patch_src = _scene().crop((0, 0, 70, 70))
    pb = io.BytesIO()
    patch_src.save(pb, format="JPEG", quality=20)
    patch = Image.open(io.BytesIO(pb.getvalue())).convert("RGB")
    comp = _scene().copy()
    comp.paste(patch, (120, 40))
    return _jpeg_bytes(comp, 95)


class TestPerceptualHash(unittest.TestCase):
    def test_hash_is_stable_across_recompression(self):
        clean = _clean_bytes()
        img = Image.open(io.BytesIO(clean)).convert("RGB")
        for q in (80, 60, 50):
            resaved = _jpeg_bytes(img, q)
            dist = forensics.hamming_distance(
                forensics.perceptual_hash(clean), forensics.perceptual_hash(resaved)
            )
            self.assertLessEqual(dist, forensics.PHASH_RECYCLED_MAX_DISTANCE, f"unstable at q={q}")

    def test_different_images_have_distinct_hashes(self):
        h_clean = forensics.perceptual_hash(_clean_bytes())
        solid = _jpeg_bytes(Image.new("RGB", (256, 256), (10, 200, 50)))
        h_solid = forensics.perceptual_hash(solid)
        self.assertGreater(
            forensics.hamming_distance(h_clean, h_solid),
            forensics.PHASH_RECYCLED_MAX_DISTANCE,
        )


class TestErrorLevelAnalysis(unittest.TestCase):
    def test_spliced_scores_higher_than_clean(self):
        clean_score = forensics.error_level_analysis(_clean_bytes())
        spliced_score = forensics.error_level_analysis(_spliced_bytes())
        self.assertGreater(spliced_score, clean_score)


class TestRecycledDetection(unittest.TestCase):
    def test_duplicate_is_recycled(self):
        clean = _clean_bytes()
        prior = forensics.perceptual_hash(clean)
        dup = _jpeg_bytes(Image.open(io.BytesIO(clean)).convert("RGB"), quality=50)
        recycled, dist = forensics.is_recycled(forensics.perceptual_hash(dup), [prior])
        self.assertTrue(recycled)
        self.assertLessEqual(dist, forensics.PHASH_RECYCLED_MAX_DISTANCE)

    def test_novel_photo_not_recycled(self):
        prior = forensics.perceptual_hash(_clean_bytes())
        solid = _jpeg_bytes(Image.new("RGB", (256, 256), (10, 200, 50)))
        recycled, _ = forensics.is_recycled(forensics.perceptual_hash(solid), [prior])
        self.assertFalse(recycled)


class TestCombinedVerdict(unittest.TestCase):
    def test_clean_verdict_under_production_threshold(self):
        # Synthetic images sit well below the production ELA threshold (12.0).
        res = forensics.analyze(_clean_bytes(), prior_phashes=[])
        self.assertEqual(res.verdict, "clean")
        self.assertFalse(res.phash_recycled)
        self.assertLess(res.ela_score, forensics.ELA_SUSPICIOUS_THRESHOLD)

    def test_recycled_takes_precedence_over_ela(self):
        clean = _clean_bytes()
        prior = forensics.perceptual_hash(clean)
        # Even with a trivially-low ELA threshold, recycled wins the verdict.
        res = forensics.analyze(clean, prior_phashes=[prior], ela_threshold=0.0)
        self.assertEqual(res.verdict, "recycled")
        self.assertTrue(res.phash_recycled)

    def test_suspicious_when_ela_exceeds_threshold(self):
        # Drive the thresholding logic directly: a threshold below the measured
        # clean score forces a "suspicious" verdict for a non-recycled photo.
        clean = _clean_bytes()
        measured = forensics.error_level_analysis(clean)
        res = forensics.analyze(clean, prior_phashes=[], ela_threshold=measured - 0.01)
        self.assertEqual(res.verdict, "suspicious")


if __name__ == "__main__":
    unittest.main()
