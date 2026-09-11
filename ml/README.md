# ASHASCAN ML integration

This folder contains the model integration layer for the trained MobileNetV2 classifier.

## Model asset

Place the trained model file in the repository's `models/` folder with this exact name:

- `ASHASCAN_final_model.keras`

## Inference path

The pipeline uses the same MobileNetV2 preprocessing as the training pipeline:

- convert BGR to RGB
- resize to 224x224
- apply `tf.keras.applications.mobilenet_v2.preprocess_input`

The probability threshold is set to `0.30`.

Example usage:

```python
from ml.predict import predict

result = predict("path/to/image.jpg")
print(result)
```
