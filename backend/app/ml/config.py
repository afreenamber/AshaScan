from pathlib import Path
import os

MODEL_FILENAME = "ASHASCAN_final_model.keras"
MODEL_DIR = Path(__file__).resolve().parent
MODEL_PATH = MODEL_DIR / MODEL_FILENAME

RED_THRESHOLD = float(os.getenv("RISK_RED_THRESHOLD", "0.70"))
YELLOW_THRESHOLD = float(os.getenv("RISK_YELLOW_THRESHOLD", "0.55"))
PREDICTION_THRESHOLD = YELLOW_THRESHOLD

IMAGE_SIZE = (224, 224)
