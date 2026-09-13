"""Model integration helpers for the ASHASCAN MobileNetV2 pipeline.

This package intentionally avoids importing heavy ML dependencies at
package-import time. Importing `ml.predict` (which imports TensorFlow)
can be done explicitly by callers that need runtime prediction.
"""

from .config import MODEL_FILENAME, MODEL_PATH, PREDICTION_THRESHOLD

__all__ = ["MODEL_FILENAME", "MODEL_PATH", "PREDICTION_THRESHOLD"]
