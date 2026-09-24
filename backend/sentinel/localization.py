import os
from typing import Tuple, Dict, Any, Union, Optional
import numpy as np
from PIL import Image, ImageOps
from .preprocessing import validate_and_load_image


def generate_jet_colormap() -> np.ndarray:
    """
    Generates a 256-color JET heatmap lookup table (RGB) in [0, 255].
    """
    x = np.linspace(0, 1, 256)
    r = np.clip(1.5 - np.abs(4 * x - 3), 0, 1)
    g = np.clip(1.5 - np.abs(4 * x - 2), 0, 1)
    b = np.clip(1.5 - np.abs(4 * x - 1), 0, 1)
    return (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)


JET_COLORMAP = generate_jet_colormap()


def create_localization_artifacts(
    original_image_input: Union[str, Image.Image],
    localization_mask: np.ndarray,
    output_dir: str,
    base_name: str,
    localization_threshold: float = 0.35,
    blend_alpha: float = 0.6
) -> Dict[str, str]:
    """
    Creates forensic localization visual artifacts from Sentinel AI mask:
    1. Resizes mask back to original image dimensions preserving exact aspect ratio.
    2. Generates standalone grayscale localization mask PNG.
    3. Generates forensic colored heatmap overlay PNG.

    Args:
        original_image_input: File path or PIL Image of the original evidence.
        localization_mask: (224, 224) float numpy array with values in [0.0, 1.0].
        output_dir: Directory where artifacts will be written.
        base_name: Prefix / stem for output file names.
        localization_threshold: Threshold above which tampering is highlighted (default 0.35).
        blend_alpha: Maximum blending alpha for highlighted regions.

    Returns:
        Dict containing paths to:
          - 'mask_path': standalone normalized mask PNG
          - 'overlay_path': forensic heatmap overlay PNG
    """
    os.makedirs(output_dir, exist_ok=True)

    # 1. Load original image and get exact native dimensions
    orig_img = validate_and_load_image(original_image_input)
    orig_w, orig_h = orig_img.size

    # 2. Ensure mask is 2D numpy array in float range [0.0, 1.0]
    mask = np.asarray(localization_mask, dtype=np.float32)
    if mask.ndim == 3:
        mask = mask.squeeze()
    mask = np.clip(mask, 0.0, 1.0)

    # 3. Resize mask to original image dimensions using Bilinear interpolation
    mask_pil_224 = Image.fromarray((mask * 255).astype(np.uint8), mode="L")
    mask_pil_full = mask_pil_224.resize((orig_w, orig_h), resample=Image.Resampling.BILINEAR)
    mask_full_np = np.asarray(mask_pil_full, dtype=np.float32) / 255.0

    # 4. Save standalone mask image
    mask_filename = f"{base_name}_mask.png"
    mask_path = os.path.join(output_dir, mask_filename)
    mask_pil_full.save(mask_path, format="PNG")

    # 5. Apply JET Colormap to produce full-resolution RGB heatmap
    mask_indices = (mask_full_np * 255).astype(np.uint8)
    heatmap_rgb = JET_COLORMAP[mask_indices]  # (H, W, 3)

    # 6. Calculate alpha mask based on localization threshold (0.35)
    # Below threshold: gradual falloff to 0. Above threshold: full blend_alpha
    alpha_weights = np.zeros_like(mask_full_np)
    above_mask = mask_full_np >= localization_threshold
    alpha_weights[above_mask] = blend_alpha * (
        (mask_full_np[above_mask] - localization_threshold) / (1.0 - localization_threshold + 1e-6)
    )
    # Ensure minimum visibility for detected regions
    alpha_weights[above_mask] = np.clip(alpha_weights[above_mask] + 0.25, 0.25, blend_alpha)
    alpha_3d = np.repeat(alpha_weights[:, :, np.newaxis], 3, axis=2)

    # 7. Alpha blend heatmap over original image
    orig_np = np.asarray(orig_img, dtype=np.float32)
    overlay_np = (orig_np * (1.0 - alpha_3d) + heatmap_rgb.astype(np.float32) * alpha_3d)
    overlay_np = np.clip(overlay_np, 0, 255).astype(np.uint8)

    overlay_pil = Image.fromarray(overlay_np, mode="RGB")
    overlay_filename = f"{base_name}_localization.png"
    overlay_path = os.path.join(output_dir, overlay_filename)
    overlay_pil.save(overlay_path, format="PNG")

    return {
        "mask_path": mask_path,
        "overlay_path": overlay_path,
        "dimensions": (orig_w, orig_h)
    }
