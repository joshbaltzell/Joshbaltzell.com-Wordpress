"""Frame configuration schema — the core data model for all frame attributes."""

from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class FrameConfig:
    """A fully-specified frame configuration extracted from an order."""

    # Dimensions
    opening_width: float = 0.0  # inches
    opening_height: float = 0.0  # inches
    orientation: str = "portrait"  # portrait | landscape | square

    # Moulding
    moulding_material: str = "wood"  # wood | metal | composite | poly
    moulding_width: float = 1.0  # profile width in inches
    moulding_color: str = "black"
    moulding_style: str = "modern"  # modern | ornate | rustic | minimal | traditional
    moulding_finish: str = "matte"  # matte | glossy | satin | distressed

    # Mat board
    mat_included: bool = True
    mat_color_top: str = "white"
    mat_color_bottom: str = ""  # empty = single mat
    mat_width_top: float = 2.0  # inches
    mat_width_bottom: float = 0.0  # 0 = single mat

    # Glass
    glass_type: str = "regular"  # regular | non_glare | uv_protection | museum

    # Backing & mounting
    backing_type: str = "standard"  # standard | acid_free | foam_core
    mounting_type: str = "none"  # dry_mount | hinge_mount | float_mount | none

    # Metadata
    price: float = 0.0
    category: str = "photo"  # photo | art | diploma | memorabilia | mirror

    # Order context (not used in feature encoding, but stored for reference)
    order_id: str = ""
    sku: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "FrameConfig":
        known_fields = {f.name for f in cls.__dataclass_fields__.values()}
        filtered = {k: v for k, v in data.items() if k in known_fields}
        return cls(**filtered)


# Canonical attribute values — used for encoding and validation
ORIENTATIONS = ["portrait", "landscape", "square"]
MOULDING_MATERIALS = ["wood", "metal", "composite", "poly"]
MOULDING_STYLES = ["modern", "ornate", "rustic", "minimal", "traditional"]
MOULDING_FINISHES = ["matte", "glossy", "satin", "distressed"]
GLASS_TYPES = ["regular", "non_glare", "uv_protection", "museum"]
BACKING_TYPES = ["standard", "acid_free", "foam_core"]
MOUNTING_TYPES = ["dry_mount", "hinge_mount", "float_mount", "none"]
CATEGORIES = ["photo", "art", "diploma", "memorabilia", "mirror"]
