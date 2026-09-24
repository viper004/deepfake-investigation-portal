import sys
import os

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sentinel.model import load_sentinel_model


def test_model_loading():
    try:
        model, device = load_sentinel_model()
        total_params = sum(p.numel() for p in model.parameters())
        trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
        device_name = "CUDA" if device.type == "cuda" else "CPU"

        print("Sentinel AI model loaded successfully")
        print(f"Version: {model.config.version}")
        print(f"Parameters: {total_params:,}")
        print(f"Trainable parameters: {trainable_params}")
        print(f"Device: {device_name}")

        assert total_params == 7968783, f"Expected 7,968,783 parameters, got {total_params}"
        assert trainable_params == 0, f"Expected 0 trainable parameters, got {trainable_params}"
        return 0
    except Exception as e:
        print(f"Failed to load Sentinel AI model: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(test_model_loading())
