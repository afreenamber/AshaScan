"""Image-quality checks for anemia detection pipeline.

Provides functions to detect blurry, too-dark, overexposed, and wrong-framing
images. This module is intentionally self-contained so it can be used by the
`ml` inference code or imported by the backend without importing `src`.
"""
from typing import Dict, Any, Union
import os
import numpy as np
import cv2

# Thresholds (tuneable): see project docs for rationale.
BLUR_THRESHOLD = 100.0
TOO_DARK = 60.0
OVEREXPOSED = 200.0
MIN_EYE_AREA_RATIO = 0.01  # 1% of image area


def _read_image_input(image_input: Union[str, bytes, np.ndarray]) -> np.ndarray:
    """Load an image from path, bytes, or return array unchanged.

    Returns a BGR uint8 image suitable for OpenCV processing.
    """
    if isinstance(image_input, np.ndarray):
        return image_input
    if isinstance(image_input, bytes):
        arr = np.frombuffer(image_input, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image from bytes")
        return img
    if isinstance(image_input, str):
        if not os.path.exists(image_input):
            raise FileNotFoundError(f"Image path not found: {image_input}")
        img = cv2.imread(image_input, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError(f"cv2 failed to read image: {image_input}")
        return img
    raise TypeError("Unsupported image_input type; expected path, bytes, or ndarray")


def check_image_quality(image: Union[str, bytes, np.ndarray]) -> Dict[str, Any]:
    """Assess image quality and return structured results.

    Returns:
      {
        "is_usable": bool,
        "issues": ["blurry"|"too_dark"|"overexposed"|"wrong_framing"],
        "blur_score": float,
        "brightness_score": float
      }

    Accepts a file path, raw bytes, or a numpy array (BGR).
    """
    img = _read_image_input(image)
    if len(img.shape) == 3 and img.shape[2] == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img.copy()

    h, w = gray.shape[:2]
    img_area = float(h * w)

    issues = []

    # Blur: variance of Laplacian
    lap = cv2.Laplacian(gray, cv2.CV_64F)
    blur_score = float(lap.var())
    if blur_score < BLUR_THRESHOLD:
        issues.append("blurry")

    # Brightness
    brightness_score = float(np.mean(gray))
    if brightness_score < TOO_DARK:
        issues.append("too_dark")
    elif brightness_score > OVEREXPOSED:
        issues.append("overexposed")

    # Framing: Haar cascade eye detection
    cascade_path = cv2.data.haarcascades + "haarcascade_eye.xml"
    eye_cascade = cv2.CascadeClassifier(cascade_path)
    wrong_framing = True
    if not eye_cascade.empty():
        eyes = eye_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5)
        for (ex, ey, ew, eh) in eyes:
            eye_area = float(ew * eh)
            if eye_area >= MIN_EYE_AREA_RATIO * img_area:
                cx = ex + ew / 2.0
                cy = ey + eh / 2.0
                if (0.1 * w) <= cx <= (0.9 * w) and (0.1 * h) <= cy <= (0.9 * h):
                    wrong_framing = False
                    break
    else:
        # If cascade not available, skipp framing check (assume framing ok).
        wrong_framing = False

    if wrong_framing:
        issues.append("wrong_framing")

    is_usable = len(issues) == 0

    return {
        "is_usable": is_usable,
        "issues": issues,
        "blur_score": blur_score,
        "brightness_score": brightness_score,
    }


def is_image_usable(image: Union[str, bytes, np.ndarray]) -> bool:
    """Convenience helper returning True when image has no issues."""
    return check_image_quality(image)["is_usable"]
