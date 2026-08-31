from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import io
from src import predict as predict_module

app = FastAPI(title="AshaScan API")


@app.post("/predict")
async def predict_endpoint(file: UploadFile = File(...)):
    """Accept an image file, run prediction, and return JSON result.

    TODO: add authentication, rate limiting, input validation, and better error handling.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    contents = await file.read()
    try:
        # Keep this simple: pass raw bytes to the predictor; real code should decode and preprocess
        image_bytes = io.BytesIO(contents)
        result = predict_module.predict(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return JSONResponse(content=result)
