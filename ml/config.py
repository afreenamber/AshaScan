from pathlib import Path

MODEL_FILENAME = "ASHASCAN_final_model.keras"
ROOT_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = ROOT_DIR / "models"
MODEL_PATH = MODEL_DIR / MODEL_FILENAME

PREDICTION_THRESHOLD = 0.55
IMAGE_SIZE = (224, 224)
