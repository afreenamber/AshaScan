# ML module

This folder contains machine-learning artifacts and helper code for the
anemia detection module.

Files
 `image_quality.py` — image-quality checks (blurry, too dark, overexposed, framing)

Usage

Import and call:

```python
from ml.inference import predict_anemia
res = predict_anemia("path/to/image.jpg")
```

The function returns a dict with `status` `success` or `retake` and additional
fields per the project specification.
