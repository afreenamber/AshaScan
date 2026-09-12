"""
Bridges the trained model in app/ml/ to the interface backend/app/main.py expects:
    (risk_level: "low"|"moderate"|"high", confidence: float 0-1, model_version: str)

Loaded once and cached — do NOT reload the model on every request, it's ~10MB
and TensorFlow's load_model() is slow enough that per-request loading would
make every screening take several extra seconds.
"""
from pathlib import Path
from typing import Optional

import numpy as np

from .ml.config import MODEL_PATH, IMAGE_SIZE
from .ml.preprocess import preprocess_image

_model = None
_load_attempted = False


def preload():
    model = _get_model()
    if model is None:
        print(f"[ml_bridge] WARNING: could not preload model from {MODEL_PATH} — "
              f"screenings will fall back to DEMO_MODE if enabled, or fail.")
        return False

    print(f"[ml_bridge] Model loaded from {MODEL_PATH}, running warm-up prediction...")
    try:
        import time
        t0 = time.time()
        dummy = np.zeros((1, *IMAGE_SIZE, 3), dtype=np.float32)
        model.predict(dummy, verbose=0)
        print(f"[ml_bridge] Warm-up prediction complete in {time.time() - t0:.1f}s "
              f"— model preloaded successfully.")
    except Exception as e:
        print(f"[ml_bridge] WARNING: warm-up prediction failed: {e} "
              f"— first real screening may still be slow.")
        return False

    return True


def is_available() -> bool:
    """Cheap check without forcing a load — used to decide whether to even try."""
    return Path(MODEL_PATH).exists()


def _get_model():
    global _model, _load_attempted
    if _model is not None:
        return _model
    if _load_attempted:
        # We already tried and failed this run; don't retry on every request.
        return None

    _load_attempted = True
    try:
        import tensorflow as tf
        _model = tf.keras.models.load_model(MODEL_PATH)
        print(f"[ml_bridge] Loaded model from {MODEL_PATH}")
    except Exception as e:
        print(f"[ml_bridge] Failed to load model: {e}")
        _model = None
    return _model


import os

# These control where the 3-tier Green/Yellow/Red split falls on the raw
RED_THRESHOLD = float(os.getenv("RISK_RED_THRESHOLD", "0.70"))
YELLOW_THRESHOLD = float(os.getenv("RISK_YELLOW_THRESHOLD", "0.55"))


def _risk_bucket(anemic_probability: float) -> str:
    if anemic_probability > RED_THRESHOLD:
        return "red"
    if anemic_probability > YELLOW_THRESHOLD:
        return "yellow"
    return "green"


def predict_from_bytes(image_bytes: bytes) -> Optional[tuple[str, float, str]]:
    """Returns None if the model isn't loaded (caller should fall back to DEMO_MODE)."""
    model = _get_model()
    if model is None:
        return None

    processed = preprocess_image(image_bytes)
    batch = np.expand_dims(processed, axis=0)
    raw_output = model.predict(batch, verbose=0)

    # Training class mapping (confirmed with ML teammate): 0 = anemic, 1 = non_anemic.
    # Sigmoid output = P(non_anemic), so P(anemic) = 1 - output.
    non_anemic_probability = float(np.clip(np.asarray(raw_output).ravel()[0], 0.0, 1.0))
    anemic_probability = 1.0 - non_anemic_probability

    return (_risk_bucket(anemic_probability), anemic_probability, "ashascan-mobilenetv2-v1")