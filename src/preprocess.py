"""Preprocessing helpers including image-quality checks.

This module provides simple, explainable heuristics for deciding whether
an eye/conjunctiva image is usable for downstream model inference.

Quality metrics and thresholds are intentionally conservative and configurable
via constants below. Each threshold includes a brief rationale in the
docstrings/comments so the choices can be justified in project documentation.
"""
from typing import Dict, Any, Union
import os
import numpy as np
import cv2


# Thresholds (tuneable):
# Variance of Laplacian below this -> considered blurry.
# Rationale: variance of Laplacian is a standard blur metric; 100 is a
# conservative starting point that flags visibly blurry photos on typical
# smartphone images. Adjust after dataset analysis.
BLUR_THRESHOLD = 100.0

# Brightness thresholds on 0-255 grayscale mean:
# Images with mean < TOO_DARK are likely underexposed; > OVEREXPOSED are too bright.
# Rationale: 60 and 200 are chosen to capture clearly under/overexposed cases
# while allowing some natural variation in lighting.
TOO_DARK = 60.0
OVEREXPOSED = 200.0

# Minimum relative eye area required to consider framing reasonable.
# If detected eye bounding box area is less than MIN_EYE_AREA_RATIO * image_area,
# we consider the eye too small (likely misframed or too far).
MIN_EYE_AREA_RATIO = 0.01  # 1% of image area


def _read_image_input(image_input: Union[str, bytes, np.ndarray]) -> np.ndarray:
    """Load image from path, bytes, or return array unchanged.

    Accepts:
    - filesystem path string
    - bytes-like (raw file bytes)
    - numpy.ndarray image (BGR or grayscale)
    Returns BGR uint8 image suitable for OpenCV processing.
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


def load_image(path: str) -> np.ndarray:
    """Load an image from disk and return as BGR numpy array.

    Wrapper around OpenCV's `imread` to keep the public API explicit.
    """
    return _read_image_input(path)


def check_image_quality(image: Union[str, bytes, np.ndarray]) -> Dict[str, Any]:
    """Assess image quality and return metrics and usability.

    Returns a dict with keys:
      - is_usable: bool
      - issues: list[str] (any of: "blurry", "too_dark", "overexposed", "wrong_framing")
      - blur_score: float (variance of Laplacian)
      - brightness_score: float (mean grayscale value, 0-255)

    The function accepts a path string, bytes, or a numpy array.
    """
    img = _read_image_input(image)

    # Convert to grayscale for brightness and blur computations
    if len(img.shape) == 3 and img.shape[2] == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img.copy()

    h, w = gray.shape[:2]
    img_area = float(h * w)

    issues = []

    # 1) Blur detection using variance of Laplacian
    # Higher variance -> more edges -> sharper image. Low variance indicates blur.
    lap = cv2.Laplacian(gray, cv2.CV_64F)
    blur_score = float(lap.var())
    if blur_score < BLUR_THRESHOLD:
        issues.append("blurry")

    # 2) Brightness checks: mean pixel value in grayscale (0-255)
    brightness_score = float(np.mean(gray))
    if brightness_score < TOO_DARK:
        issues.append("too_dark")
    elif brightness_score > OVEREXPOSED:
        issues.append("overexposed")

    # 3) Framing check via Haar cascade for eyes
    # We use OpenCV's pre-trained Haar cascade for eye detection. If no
    # sufficiently large eye region is detected, mark as wrong_framing.
    cascade_path = cv2.data.haarcascades + "haarcascade_eye.xml"
    eye_cascade = cv2.CascadeClassifier(cascade_path)
    wrong_framing = True
    if not eye_cascade.empty():
        # detectMultiScale expects a grayscale image
        eyes = eye_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5)
        # Check for at least one reasonably-sized eye detection
        for (ex, ey, ew, eh) in eyes:
            eye_area = float(ew * eh)
            if eye_area >= MIN_EYE_AREA_RATIO * img_area:
                # Additional heuristic: check that the eye is not at extreme edge
                cx = ex + ew / 2.0
                cy = ey + eh / 2.0
                # Accept if eye center lies within the central 80% of the image
                if (0.1 * w) <= cx <= (0.9 * w) and (0.1 * h) <= cy <= (0.9 * h):
                    wrong_framing = False
                    break
    else:
        # If cascade failed to load, we cannot perform framing check reliably.
        # Do not add wrong_framing; caller should ensure OpenCV is installed with data.
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


def preprocess_image(image: Union[str, bytes, np.ndarray], target_size=(224, 224)) -> np.ndarray:
    """Resize and normalize image to model input shape.

    This is a minimal placeholder: it decodes the image, resizes using
    bilinear interpolation, and scales pixel values to [0,1] as float32.
    TODO: replace with model-specific preprocessing (color space, mean/std, augmentations).
    """
    img = _read_image_input(image)
    # Convert BGR to RGB for most ML models
    if len(img.shape) == 3 and img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(img, (target_size[1], target_size[0]), interpolation=cv2.INTER_LINEAR)
    arr = resized.astype("float32") / 255.0
    return arr
