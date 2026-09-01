from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import os
from typing import List
import numpy as np

# Lazy import TensorFlow during startup to surface import errors early.
try:
    import tensorflow as tf
except Exception:
    tf = None

from src.preprocess import check_image_quality, preprocess_image


APP_TITLE = "AshaScan API"
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "anemia_model.keras")

app = FastAPI(title=APP_TITLE)

# Allow all CORS origins for now (restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def load_model_on_startup():
    """Load the Keras model once at application startup and store on app.state.

    If loading fails, `app.state.model` will be None and prediction requests will
    return a 503 service unavailable response.
    """
    app.state.model = None
    if tf is None:
        print("TensorFlow not available; model will not be loaded.")
        return

    model_file = os.path.abspath(MODEL_PATH)
    if not os.path.exists(model_file):
        print(f"Model file not found at {model_file}; prediction endpoint will be unavailable.")
        return

    try:
        app.state.model = tf.keras.models.load_model(model_file)
        print(f"Loaded model from {model_file}")
    except Exception as e:
        print(f"Failed to load model: {e}")
        app.state.model = None


@app.get("/health")
def health_check():
    """Health endpoint to verify the service is up."""
    return {"status": "ok"}


def _map_confidence_to_risk(confidence: float) -> str:
    """Map anemic probability to risk level per project thresholds.

    - confidence > 0.7 => high
    - confidence > 0.4 => moderate
    - else => low
    """
    if confidence > 0.7:
        return "high"
    if confidence > 0.4:
        return "moderate"
    return "low"


@app.post("/predict")
async def predict_endpoint(file: UploadFile = File(...)):
    """Accept an image file, run quality checks, preprocess, and predict.

    Returns JSON: {"risk_level": "low"|"moderate"|"high", "confidence": float, "quality_issues": []}
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Read file bytes
    contents = await file.read()

    # 1) Run image quality checks
    try:
        q = check_image_quality(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image decode/quality check failed: {e}")

    if not q.get("is_usable", False):
        # Return 400 with clear issues list; do not run model
        return JSONResponse(status_code=400, content={
            "detail": "Image failed quality checks",
            "quality_issues": q.get("issues", []),
        })

    # 2) Ensure model is loaded
    model = getattr(app.state, "model", None)
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded; prediction unavailable")

    # 3) Preprocess image for model: ensure 224x224 RGB normalized array
    try:
        arr = preprocess_image(contents, target_size=(224, 224))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Preprocessing failed: {e}")

    # Add batch dim and run inference
    inp = np.expand_dims(arr, axis=0)
    try:
        pred = model.predict(inp)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference failed: {e}")

    # Model output handling: assume a single sigmoid output for non_anemic class.
    # Per project spec, class order is ['anemic', 'non_anemic'] and we map
    # anemic_probability = 1 - prediction_for_non_anemic
    try:
        pred_val = float(np.array(pred).ravel()[0])
    except Exception:
        raise HTTPException(status_code=500, detail="Unexpected model output shape")

    # Clamp prediction
    pred_val = max(0.0, min(1.0, pred_val))
    anemic_prob = 1.0 - pred_val

    risk_level = _map_confidence_to_risk(anemic_prob)

    return JSONResponse(content={
        "risk_level": risk_level,
        "confidence": float(anemic_prob),
        "quality_issues": [],
    })


if __name__ == "__main__":
    # Allow running as: python api/main.py
    import uvicorn

    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
