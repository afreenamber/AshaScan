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

from .ml.config import MODEL_PATH
from .ml.preprocess import preprocess_image

_model = None
_load_attempted = False


def preload():
    """Force the model to load right now, instead of on the first user's
    screening request. Call this once at server startup. Loading
    TensorFlow + this ~22MB Keras model is the slow part (can take
    20-60+ seconds on a constrained CPU like a Codespace) — doing it at
    boot means that cost shows up in the startup logs, not as a frozen
    'Preparing result' screen on someone's first screening."""
    model = _get_model()
    if model is not None:
        print(f"[ml_bridge] Model preloaded successfully from {MODEL_PATH}")
    else:
        print(f"[ml_bridge] WARNING: could not preload model from {MODEL_PATH} — "
              f"screenings will fall back to DEMO_MODE if enabled, or fail.")
    return model is not None


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