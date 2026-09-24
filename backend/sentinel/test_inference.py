import sys
import os

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sentinel.inference import SentinelInferenceEngine


def test_standalone_inference():
    test_images = [
        os.path.join(backend_dir, "uploads", "57244f424f284ffbb6aae62425f06ea5.jpg"),
        os.path.join(backend_dir, "uploads", "219302ef27434208abc8aa4c621c712e.jpg"),
        os.path.join(backend_dir, "..", "frontend", "public", "images", "auth", "cyber1.png")
    ]

    # Filter to existing images
    valid_images = [p for p in test_images if os.path.exists(p)]
    if not valid_images:
        print("Error: No test images found!", file=sys.stderr)
        return 1

    print("--- Initializing Sentinel AI Engine ---")
    engine = SentinelInferenceEngine.get_instance()
    print("Model loaded")

    for idx, img_path in enumerate(valid_images, 1):
        print(f"\n[Test Image {idx}] {os.path.basename(img_path)}")
        res = engine.analyze_image(img_path)

        print(f"Input shape: [1, 3, 224, 224] (Original: {res['original_size']})")
        print(f"Classification: {res['classification'].upper()}")
        print(f"Probabilities: Tampered={res['tampered_probability']:.2%} | Authentic={res['authentic_probability']:.2%}")
        print(f"Localization generated: {res['localization_available']} (Threshold={res['localization_threshold']:.2f}, Max={res['metrics']['loc_max_confidence']:.2f})")
        print(f"Inference time: {res['inference_time_seconds'] * 1000:.1f} ms")

        # Assertions
        assert res["classification"] in ["tampered", "authentic"]
        assert 0.0 <= res["tampered_probability"] <= 1.0
        assert 0.0 <= res["authentic_probability"] <= 1.0
        assert round(res["tampered_probability"] + res["authentic_probability"], 2) == 1.00
        assert res["localization_mask"].shape == (224, 224)

    print("\nStandalone inference test passed successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(test_standalone_inference())
