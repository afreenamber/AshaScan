from __future__ import annotations
 
from pathlib import Path
from typing import Union
 
import numpy as np
from PIL import Image
 
from .config import IMAGE_SIZE
 
 
def _read_image(image_input: Union[str, bytes, np.ndarray]) -> np.ndarray:
    if isinstance(image_input, np.ndarray):
        return image_input.copy()
 
    if isinstance(image_input, bytes):
        from io import BytesIO
        return np.array(Image.open(BytesIO(image_input)).convert("RGB"))
 
    if isinstance(image_input, str):
        return np.array(Image.open(image_input).convert("RGB"))
 
    raise TypeError(
        "Unsupported image input type; expected path, bytes, or numpy array"
    )
 
 
def preprocess_image(
    image_input: Union[str, bytes, np.ndarray],
    target_size: tuple[int, int] = IMAGE_SIZE,
) -> np.ndarray:
 
    img = _read_image(image_input)
 
    pil_img = Image.fromarray(img)
    pil_img = pil_img.resize(
        (target_size[1], target_size[0]),
        Image.Resampling.LANCZOS
    )
 
    rgb = np.asarray(pil_img).astype(np.float32)
 
    # NOTE: Do NOT rescale to [-1, 1] here. The saved .keras model already
    # contains its own MobileNetV2 preprocessing layers (visible as
    # `true_divide` / `subtract` in model.summary()), which expect raw
    # [0, 255] pixel values and normalize internally. Normalizing here too
    # was double-applying the transform: values already in [-1, 1] got
    # squashed a second time into a ~[-1.008, -0.992] band, so every image
    # looked almost identical to the model and every screening landed in
    # the same risk bucket.
    return rgb.astype(np.float32)