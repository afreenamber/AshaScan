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


def _risk_bucket(anemic_probability: float) -> str:
    if anemic_probability > 0.7:
        return "high"
    if anemic_probability > 0.4:
        return "moderate"
    return "low"


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
