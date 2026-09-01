# ML module

This folder contains machine-learning artifacts and helper code for the
anemia detection module.

Files
- `anemia_mobilenetv2.keras` — placeholder for the trained Keras model
- `anemia_mobilenetv2.tflite` — placeholder for the TFLite model
- `image_quality.py` — image-quality checks (blurry, too dark, overexposed, framing)
- `inference.py` — `predict_anemia(image_path)` to run quality checks and inference

Usage

Import and call:

```python
from ml.inference import predict_anemia
res = predict_anemia("path/to/image.jpg")
```

The function returns a dict with `status` `success` or `retake` and additional
fields per the project specification.
