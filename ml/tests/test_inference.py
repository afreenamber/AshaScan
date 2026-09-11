import numpy as np

from ml.config import MODEL_FILENAME, PREDICTION_THRESHOLD
from ml.preprocess import preprocess_image


def test_model_filename_matches_requested_asset():
    assert MODEL_FILENAME == "ASHASCAN_final_model.keras"


def test_prediction_threshold_is_0_30():
    assert PREDICTION_THRESHOLD == 0.30


def test_preprocess_image_returns_model_ready_array():
    sample = np.zeros((32, 32, 3), dtype=np.uint8)
    tensor = preprocess_image(sample)
    assert tensor.dtype == np.float32
    assert tensor.shape[-1] == 3
    assert tensor.shape[0] == 224
    assert tensor.shape[1] == 224
