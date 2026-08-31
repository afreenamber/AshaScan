"""Preprocessing helpers (placeholders).

TODO: implement real image loading, quality checks, and preprocessing.
"""
from typing import Dict, Any
import numpy as np


def load_image(path: str) -> np.ndarray:
    """Load an image from disk and return as numpy array.

    TODO: implement actual image reading (e.g., cv2.imread or PIL.Image).
    """
    raise NotImplementedError("load_image() not implemented")


def check_image_quality(image: np.ndarray) -> Dict[str, Any]:
    """Perform quick quality checks and return a dict with metrics.

    Returns a dict like {"blur": float, "brightness": float, "framing": "ok"}
    TODO: implement blur detection, brightness checks, and framing heuristics.
    """
    # Placeholder values
    return {"blur": 0.0, "brightness": 0.0, "framing": "unknown"}


def preprocess_image(image: np.ndarray, target_size=(224, 224)) -> np.ndarray:
    """Resize and normalize image to model input.

    TODO: implement resizing, color-space conversion, and normalization.
    """
    # Placeholder: return zeros with expected shape
    return np.zeros((target_size[0], target_size[1], 3), dtype=np.float32)
