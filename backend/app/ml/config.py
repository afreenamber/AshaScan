from pathlib import Path

MODEL_FILENAME = "ASHASCAN_final_model.keras"
MODEL_DIR = Path(__file__).resolve().parent
MODEL_PATH = MODEL_DIR / MODEL_FILENAME

PREDICTION_THRESHOLD = 0.30
IMAGE_SIZE = (224, 224)