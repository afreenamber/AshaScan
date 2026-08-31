"""Prediction placeholder.

Provides a `predict(image)` function that returns a risk level and confidence.
"""
from typing import Dict, Any


def predict(image) -> Dict[str, Any]:
    """Given a preprocessed image, return a prediction dict.

    TODO: load model from `models/` and run inference.
    """
    # Placeholder response
    return {"risk_level": "unknown", "confidence": 0.0}
