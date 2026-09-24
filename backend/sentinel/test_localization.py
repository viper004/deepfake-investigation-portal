import sys
import os
from PIL import Image

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sentinel.inference import SentinelInferenceEngine
from sentinel.localization import create_localization_artifacts


def test_localization_artifacts():
    test_image_path = os.path.join(backend_dir, "uploads", "57244f424f284ffbb6aae62425f06ea5.jpg")
    output_dir = os.path.join(backend_dir, "uploads", "analysis")

    assert os.path.exists(test_image_path), f"Test image missing: {test_image_path}"
    orig_img = Image.open(test_image_path)
    orig_w, orig_h = orig_img.size

    print(f"Original image: {os.path.basename(test_image_path)} ({orig_w}x{orig_h})")

    # Step 1: Run Inference
    engine = SentinelInferenceEngine.get_instance()
    result = engine.analyze_image(test_image_path)
    print(f"Classification: {result['classification'].upper()} (Tampered={result['tampered_probability']:.1%})")

    # Step 2: Create Localization Artifacts
    base_name = "test_image001"
    artifacts = create_localization_artifacts(
        original_image_input=test_image_path,
        localization_mask=result["localization_mask"],
        output_dir=output_dir,
        base_name=base_name,
        localization_threshold=result["localization_threshold"]
    )

    mask_path = artifacts["mask_path"]
    overlay_path = artifacts["overlay_path"]

    print(f"Mask artifact: {mask_path}")
    print(f"Overlay artifact: {overlay_path}")

    # Acceptance Criteria Checks:
    # 1. Original exists and size unchanged
    assert os.path.exists(test_image_path), "Original image must exist"
    assert Image.open(test_image_path).size == (orig_w, orig_h), "Original dimensions must remain unchanged"

    # 2. Mask artifact exists and opens
    assert os.path.exists(mask_path), f"Mask file does not exist: {mask_path}"
    mask_img = Image.open(mask_path)
    assert mask_img.size == (orig_w, orig_h), f"Mask size {mask_img.size} does not match original {(orig_w, orig_h)}"

    # 3. Overlay artifact exists and opens correctly
    assert os.path.exists(overlay_path), f"Overlay file does not exist: {overlay_path}"
    overlay_img = Image.open(overlay_path)
    assert overlay_img.size == (orig_w, orig_h), f"Overlay size {overlay_img.size} does not match original {(orig_w, orig_h)}"
    assert overlay_img.mode == "RGB", f"Expected RGB overlay, got {overlay_img.mode}"

    print(f"\nAll verification checks passed:")
    print(f"✓ Original preserved: {orig_w}x{orig_h}")
    print(f"✓ Standalone mask verified: {mask_img.size}")
    print(f"✓ Forensic overlay verified: {overlay_img.size} (No distortion or cropping)")
    return 0


if __name__ == "__main__":
    sys.exit(test_localization_artifacts())
