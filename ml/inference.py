"""Inference helpers for anemia detection.

Exposes `predict_anemia(image_path)` which runs image-quality checks and then
performs model inference using either the Keras .keras file or a TFLite file
if available. Returns a structured dict suitable for API consumption.
"""
from typing import Dict, Any
import os
import numpy as np
import cv2

from .image_quality import check_image_quality

ML_ROOT = os.path.dirname(__file__)
KERAS_MODEL_PATH = os.path.join(ML_ROOT, "anemia_mobilenetv2.keras")
TFLITE_MODEL_PATH = os.path.join(ML_ROOT, "anemia_mobilenetv2.tflite")


def _preprocess_for_model(image_path: str, target_size=(224, 224)) -> np.ndarray:
    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"Image not found or unreadable: {image_path}")
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(img, (target_size[1], target_size[0]), interpolation=cv2.INTER_LINEAR)
    arr = resized.astype("float32") / 255.0
    return np.expand_dims(arr, axis=0)


def _map_confidence_to_risk(confidence: float) -> str:
    if confidence > 0.7:
        return "High"
    if confidence > 0.4:
        return "Moderate"
    return "Low"


def _run_keras_model(model_path: str, input_array: np.ndarray) -> float:
    try:
        import tensorflow as tf
    except Exception as e:
        raise RuntimeError(f"TensorFlow not available: {e}")

    model = tf.keras.models.load_model(model_path)
    pred = model.predict(input_array)
    pred = np.array(pred).ravel()
    if pred.size == 1:
        # Assume single sigmoid output representing probability for non_anemic class
        pred_val = float(pred[0])
        anemic_prob = 1.0 - pred_val
    else:
        # Assume softmax [anemic, non_anemic]
        anemic_prob = float(pred[0])
    return float(max(0.0, min(1.0, anemic_prob)))


def _run_tflite_model(tflite_path: str, input_array: np.ndarray) -> float:
    try:
        import tflite_runtime.interpreter as tflite
    except Exception:
        try:
            import tensorflow as tf
            tflite = tf.lite
        except Exception as e:
            raise RuntimeError(f"No tflite runtime available: {e}")

    # Use TensorFlow Lite Interpreter if available
    try:
        # Normalize input depending on tflite model's expectation (assume 0-1 float)
        interpreter = tflite.Interpreter(model_path=tflite_path)
        interpreter.allocate_tensors()
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()

        # Set input - handle quantized models
        if input_details[0]["dtype"] == np.uint8:
            # assume model expects 0-255 uint8
            inp = (input_array * 255.0).astype(np.uint8)
        else:
            inp = input_array.astype(np.float32)

        interpreter.set_tensor(input_details[0]["index"], inp)
        interpreter.invoke()
        out = interpreter.get_tensor(output_details[0]["index"])
        out = np.array(out).ravel()
        if out.size == 1:
            pred_val = float(out[0])
            anemic_prob = 1.0 - pred_val
        else:
            anemic_prob = float(out[0])
        return float(max(0.0, min(1.0, anemic_prob)))
    except Exception as e:
        raise RuntimeError(f"TFLite inference failed: {e}")


def predict_anemia(image_path: str) -> Dict[str, Any]:
    """Run image-quality checks and predict anemia probability.

    Returns a dict following the specified schema. If image-quality fails,
    returns a `retake` response with issues. Otherwise attempts to run the
    Keras model (preferred) and falls back to TFLite if Keras file missing.
    """
    q = check_image_quality(image_path)
    if not q.get("is_usable", False):
        return {
            "status": "retake",
            "risk_level": None,
            "confidence": None,
            "anemia_probability": None,
            "image_quality": "poor",
            "issues": q.get("issues", []),
        }

    # Preprocess
    inp = _preprocess_for_model(image_path, target_size=(224, 224))

    # Try Keras model first
    if os.path.exists(KERAS_MODEL_PATH):
        try:
            anemic_prob = _run_keras_model(KERAS_MODEL_PATH, inp)
        except Exception as e:
            # If keras fails, try tflite
            anemic_prob = None
    else:
        anemic_prob = None

    if anemic_prob is None and os.path.exists(TFLITE_MODEL_PATH):
        anemic_prob = _run_tflite_model(TFLITE_MODEL_PATH, inp)

    if anemic_prob is None:
        raise RuntimeError("No working model available at ml/; place a .keras or .tflite file there")

    confidence = float(anemic_prob)
    risk_level = _map_confidence_to_risk(confidence)

    return {
        "status": "success",
        "risk_level": risk_level,
        "confidence": confidence,
        "anemia_probability": confidence,
        "image_quality": "good",
        "issues": [],
    }
