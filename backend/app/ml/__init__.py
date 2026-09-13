"""Model integration helpers for the ASHASCAN MobileNetV2 pipeline.

Avoid importing heavy ML libraries (TensorFlow) at package import time so
the backend can start in demo or config-only modes without requiring TF.
Import `backend.app.ml.predict` explicitly when runtime prediction is
required.
"""

from .config import MODEL_FILENAME, MODEL_PATH, PREDICTION_THRESHOLD

__all__ = ["MODEL_FILENAME", "MODEL_PATH", "PREDICTION_THRESHOLD"]
