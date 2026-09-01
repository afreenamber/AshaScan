# ML Module — AshaScan

This folder contains the machine-learning components for the AshaScan anemia risk-screening system.

The ML pipeline takes an eye/conjunctiva image, checks its image quality, and uses a trained MobileNetV2 model to generate an anemia-risk prediction.

## Files

- `anemia_mobilenetv2.keras` — trained MobileNetV2 model in Keras format
- `anemia_mobilenetv2.tflite` — TensorFlow Lite version of the trained model for lightweight deployment
- `image_quality.py` — image-quality checks
- `inference.py` — model loading and prediction pipeline
- `README.md` — ML module documentation

## ML Pipeline

```text
Input Image
     ↓
Image Quality Check
     ↓
Blur / Brightness / Framing Detection
     ↓
Image Preprocessing
     ↓
MobileNetV2 Model
     ↓
Anemia Probability
     ↓
Risk Level + Confidence
