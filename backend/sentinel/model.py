import os
from dataclasses import dataclass
from typing import Optional, Tuple
import torch
import torch.nn as nn
import timm


@dataclass
class SentinelModelConfig:
    version: str = "V1.7-A"
    num_classes: int = 2
    classification_threshold: float = 0.40
    localization_threshold: float = 0.35
    input_size: Tuple[int, int] = (224, 224)
    rgb_backbone_name: str = "efficientnet_b0"


class LaplacianResidual(nn.Module):
    """
    Fixed Laplacian high-pass filter bank for extraction of spatial artifact residuals.
    """
    def __init__(self):
        super().__init__()
        kernel = torch.tensor([
            [[[0.0, -1.0, 0.0],
              [-1.0, 4.0, -1.0],
              [0.0, -1.0, 0.0]]],
            [[[0.0, -1.0, 0.0],
              [-1.0, 4.0, -1.0],
              [0.0, -1.0, 0.0]]],
            [[[0.0, -1.0, 0.0],
              [-1.0, 4.0, -1.0],
              [0.0, -1.0, 0.0]]]
        ], dtype=torch.float32)
        self.register_buffer("kernel", kernel)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return nn.functional.conv2d(x, self.kernel, padding=1, groups=3)


class ForensicBranch(nn.Module):
    """
    Specialized forensic stream capturing high-frequency forensic noise patterns.
    """
    def __init__(self):
        super().__init__()
        self.residual = LaplacianResidual()
        self.features = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=3, stride=1, padding=1, bias=False),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 64, kernel_size=3, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 128, kernel_size=3, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 128, kernel_size=3, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.AdaptiveAvgPool2d((1, 1))
        )
        self.projection = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128, 128)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        res = self.residual(x)
        feat = self.features(res)
        out = self.projection(feat)
        return out


class SentinelAIV17A(nn.Module):
    """
    Sentinel AI V1.7-A Dual-Head Model Architecture.
    - Head 1: Classification Head (Authentic vs Tampered)
    - Head 2: Spatial Localization Decoder (Pixel-level manipulation heatmap)
    """
    def __init__(self, config: Optional[SentinelModelConfig] = None):
        super().__init__()
        self.config = config or SentinelModelConfig()

        # RGB semantic stream backbone (EfficientNet-B0)
        self.rgb_backbone = timm.create_model(
            self.config.rgb_backbone_name,
            pretrained=False,
            num_classes=0
        )

        # High-frequency forensic stream
        self.forensic_branch = ForensicBranch()

        # Dual-head classification stream (1280 RGB pool + 128 forensic = 1408 features)
        self.classifier = nn.Sequential(
            nn.Linear(1408, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(256, self.config.num_classes)
        )

        # Spatial localization decoder (reconstructs 224x224 heatmap from 1280x7x7 feature map)
        self.localization_decoder = nn.Sequential(
            nn.Conv2d(1280, 256, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(256),
            nn.ReLU(inplace=True),
            nn.Upsample(scale_factor=2, mode="bilinear", align_corners=False),
            nn.Conv2d(256, 128, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.Upsample(scale_factor=2, mode="bilinear", align_corners=False),
            nn.Conv2d(128, 64, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.Upsample(scale_factor=2, mode="bilinear", align_corners=False),
            nn.Conv2d(64, 32, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.Upsample(scale_factor=2, mode="bilinear", align_corners=False),
            nn.Conv2d(32, 16, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(16),
            nn.ReLU(inplace=True),
            nn.Upsample(scale_factor=2, mode="bilinear", align_corners=False),
            nn.Conv2d(16, 1, kernel_size=1, bias=True),
            nn.Sigmoid()
        )

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Forward pass.
        Args:
            x: Input tensor of shape [B, 3, 224, 224]
        Returns:
            logits: Classification logits [B, 2] (index 0: Authentic, index 1: Tampered)
            loc_mask: Spatial localization heatmap [B, 1, 224, 224]
        """
        # Extract 2D convolutional features from backbone
        rgb_features = self.rgb_backbone.forward_features(x)
        rgb_pooled = self.rgb_backbone.forward_head(rgb_features, pre_logits=True)
        if rgb_pooled.dim() > 2:
            rgb_pooled = torch.flatten(rgb_pooled, 1)

        # Extract forensic residual features
        forensic_feat = self.forensic_branch(x)

        # Multi-modal fusion classification
        combined_feat = torch.cat([rgb_pooled, forensic_feat], dim=1)
        logits = self.classifier(combined_feat)

        # Pixel-level spatial localization
        loc_mask = self.localization_decoder(rgb_features)

        return logits, loc_mask


def resolve_model_path(custom_path: Optional[str] = None) -> str:
    """
    Locates the Sentinel AI checkpoint file.
    """
    if custom_path is not None:
        if os.path.isfile(custom_path):
            return custom_path
        raise FileNotFoundError(f"Specified Sentinel AI model checkpoint not found: {custom_path}")

    candidates = [
        os.path.join(os.getcwd(), "backend", "sentinel_ai_v17a_frozen_dual_head.pth"),
        os.path.join(os.getcwd(), "sentinel_ai_v17a_frozen_dual_head.pth"),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "sentinel_ai_v17a_frozen_dual_head.pth")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "sentinel_ai_v17a_frozen_dual_head.pth")),
    ]

    for path in candidates:
        if os.path.isfile(path):
            return path

    raise FileNotFoundError(
        "Sentinel AI V1.7-A model checkpoint not found. "
        "Expected 'sentinel_ai_v17a_frozen_dual_head.pth' in backend/ directory."
    )


def load_sentinel_model(
    checkpoint_path: Optional[str] = None,
    device: Optional[torch.device] = None
) -> Tuple[SentinelAIV17A, torch.device]:
    """
    Loads and validates the Sentinel AI V1.7-A model checkpoint.
    """
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model_path = resolve_model_path(checkpoint_path)
    checkpoint = torch.load(model_path, map_location=device)

    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        state_dict = checkpoint["model_state_dict"]
    elif isinstance(checkpoint, dict) and "state_dict" in checkpoint:
        state_dict = checkpoint["state_dict"]
    elif isinstance(checkpoint, dict):
        state_dict = checkpoint
    else:
        raise ValueError("Invalid checkpoint format: expected state dictionary.")

    model = SentinelAIV17A()
    missing, unexpected = model.load_state_dict(state_dict, strict=True)
    if missing or unexpected:
        raise RuntimeError(
            f"State dict mismatch! Missing keys: {len(missing)}, Unexpected keys: {len(unexpected)}"
        )

    # Freeze weights for deterministic inference
    for param in model.parameters():
        param.requires_grad = False

    model.to(device)
    model.eval()

    return model, device
