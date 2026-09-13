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

    # MobileNetV2 preprocessing: scale pixels from [0,255] to [-1,1]
    processed = (rgb / 127.5) - 1.0

    return processed.astype(np.float32)