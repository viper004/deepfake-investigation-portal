import time
from typing import Dict, Any, Optional, Union, BinaryIO
from PIL import Image
import torch
from .model import load_sentinel_model, SentinelAIV17A
from .preprocessing import preprocess_image, validate_and_load_image


class SentinelInferenceEngine:
    """
    Singleton inference engine for Sentinel AI V1.7-A.
    Keeps model loaded in memory for fast sub-second inference calls.
    """
    _instance: Optional["SentinelInferenceEngine"] = None

    def __init__(
        self,
        checkpoint_path: Optional[str] = None,
        device: Optional[torch.device] = None,
        classification_threshold: float = 0.40,
        localization_threshold: float = 0.35
    ):
        self.classification_threshold = classification_threshold
        self.localization_threshold = localization_threshold
        self.model, self.device = load_sentinel_model(checkpoint_path=checkpoint_path, device=device)

    @classmethod
    def get_instance(
        cls,
        checkpoint_path: Optional[str] = None,
        device: Optional[torch.device] = None
    ) -> "SentinelInferenceEngine":
        if cls._instance is None:
            cls._instance = cls(checkpoint_path=checkpoint_path, device=device)
        return cls._instance

    def analyze_image(
        self,
        image_input: Union[str, BinaryIO, Image.Image]
    ) -> Dict[str, Any]:
        """
        Runs dual-head Sentinel AI inference on an evidence image.
        """
        start_time = time.perf_counter()

        # Step 1: Preprocessing
        tensor, original_size = preprocess_image(image_input)
        tensor = tensor.to(self.device)

        # Step 2: Model Inference
        with torch.no_grad():
            logits, loc_mask = self.model(tensor)
            probs = torch.softmax(logits, dim=1).cpu().squeeze(0)
            loc_mask_np = loc_mask.cpu().squeeze(0).squeeze(0).numpy()

        inference_time = round(time.perf_counter() - start_time, 4)

        # Step 3: Probabilities & Classification
        authentic_prob = round(float(probs[0].item()), 4)
        tampered_prob = round(float(probs[1].item()), 4)

        # Apply forensic classification threshold (0.40)
        is_tampered = tampered_prob >= self.classification_threshold
        classification = "tampered" if is_tampered else "authentic"

        # Check localization heatmap against localization threshold (0.35)
        loc_max = float(loc_mask_np.max())
        loc_mean = float(loc_mask_np.mean())
        has_localization = bool(loc_max >= self.localization_threshold)

        return {
            "classification": classification,
            "tampered_probability": tampered_prob,
            "authentic_probability": authentic_prob,
            "classification_threshold": self.classification_threshold,
            "localization_available": has_localization,
            "localization_threshold": self.localization_threshold,
            "localization_mask": loc_mask_np,
            "original_size": original_size,
            "model_version": self.model.config.version,
            "device": str(self.device),
            "inference_time_seconds": inference_time,
            "metrics": {
                "loc_max_confidence": round(loc_max, 4),
                "loc_mean_confidence": round(loc_mean, 4)
            }
        }


def run_standalone_inference(image_path: str) -> Dict[str, Any]:
    """
    Convenience function for standalone inference on a single image file.
    """
    engine = SentinelInferenceEngine.get_instance()
    return engine.analyze_image(image_path)
