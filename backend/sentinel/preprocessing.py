import os
from typing import Tuple, Union, BinaryIO
from PIL import Image, ImageOps
import torch
import torchvision.transforms as T

# Standard PyTorch vision normalization parameters
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

# Inference preprocessing pipeline
INFERENCE_TRANSFORM = T.Compose([
    T.Resize((224, 224), interpolation=T.InterpolationMode.BILINEAR),
    T.ToTensor(),
    T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
])

SUPPORTED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".jfif"}


def validate_and_load_image(image_input: Union[str, BinaryIO, Image.Image]) -> Image.Image:
    """
    Validates, loads, and normalizes an image for forensic processing.
    Handles EXIF orientation and RGB conversion.
    """
    if isinstance(image_input, str):
        if not os.path.exists(image_input):
            raise FileNotFoundError(f"Evidence image not found: {image_input}")

        ext = os.path.splitext(image_input)[1].lower()
        if ext and ext not in SUPPORTED_IMAGE_EXTENSIONS:
            raise ValueError(f"Unsupported evidence format '{ext}'. Supported formats: {sorted(SUPPORTED_IMAGE_EXTENSIONS)}")

        try:
            pil_image = Image.open(image_input)
            pil_image.load()  # Verify image integrity
        except Exception as e:
            raise ValueError(f"Invalid or corrupted evidence image: {e}")

    elif isinstance(image_input, Image.Image):
        pil_image = image_input
    else:
        try:
            pil_image = Image.open(image_input)
            pil_image.load()
        except Exception as e:
            raise ValueError(f"Invalid or corrupted evidence image stream: {e}")

    # Correct EXIF rotation if present
    try:
        pil_image = ImageOps.exif_transpose(pil_image)
    except Exception:
        pass

    # Ensure 3-channel RGB format
    if pil_image.mode != "RGB":
        pil_image = pil_image.convert("RGB")

    return pil_image


def preprocess_image(
    image_input: Union[str, BinaryIO, Image.Image],
    target_size: Tuple[int, int] = (224, 224)
) -> Tuple[torch.Tensor, Tuple[int, int]]:
    """
    Preprocesses an evidence image into the exact [1, 3, 224, 224] tensor required by Sentinel AI.
    Returns:
        tensor: [1, 3, 224, 224] normalized PyTorch tensor
        original_size: (width, height) of the original image
    """
    pil_image = validate_and_load_image(image_input)
    orig_size = pil_image.size  # (width, height)

    tensor = INFERENCE_TRANSFORM(pil_image)
    tensor = tensor.unsqueeze(0)  # [1, 3, 224, 224]

    return tensor, orig_size
