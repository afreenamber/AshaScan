from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional, Union
import sys

import numpy as np
import tensorflow as tf

from .config import MODEL_PATH, PREDICTION_THRESHOLD
from .preprocess import preprocess_image


def load_model(model_path: Union[str, Path] = MODEL_PATH):
    """Load the trained MobileNetV2 Keras model from disk."""
    model_file = Path(model_path)

    if not model_file.exists():
        raise FileNotFoundError(f"Model not found: {model_file}")

    return tf.keras.models.load_model(model_file)


def _extract_non_anemic_probability(output: Any) -> float:
    """
    Training class mapping:
        0 = anemic
        1 = non_anemic

    Sigmoid output = probability of non_anemic.
    """
    arr = np.asarray(output, dtype=np.float32)
    flat = arr.reshape(-1)

    if flat.size == 0:
        raise ValueError("Model output was empty")

    if flat.size == 1:
        return float(np.clip(flat[0], 0.0, 1.0))

    return float(np.clip(flat[1], 0.0, 1.0))


def predict(
    image_input: Union[str, bytes, np.ndarray],
    model: Optional[tf.keras.Model] = None,
    threshold: float = PREDICTION_THRESHOLD,
) -> Dict[str, Any]:

    model_to_use = model or load_model()

    processed = preprocess_image(image_input)
    batch = np.expand_dims(processed, axis=0)

    raw_output = model_to_use.predict(batch, verbose=0)

    non_anemic_probability = _extract_non_anemic_probability(raw_output)

    is_anemic = non_anemic_probability < threshold

    return {
        "prediction": int(is_anemic),
        "label": "anemic" if is_anemic else "non_anemic",
        "model_score": float(
            (1.0 - non_anemic_probability)
            if is_anemic
            else non_anemic_probability
        ),
        "threshold": float(threshold),
        "class_mapping": {
            "0": "anemic",
            "1": "non_anemic"
        }
    }


if __name__ == "__main__":

    if len(sys.argv) != 2:
        print("Usage: python -m ml.predict <image_path>")
        sys.exit(1)

    result = predict(sys.argv[1])

    print("\n=== ASHASCAN RESULT ===")
    print(f"Prediction: {result['label'].upper()}")
    print(f"Model score: {result['model_score']:.2%}")
    print(f"Threshold: {result['threshold']:.2f}")