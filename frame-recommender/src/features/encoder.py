"""Feature engineering: encode FrameConfig objects into numerical vectors."""

import logging

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, OneHotEncoder

from src.ingest.schema import (
    FrameConfig,
    ORIENTATIONS,
    MOULDING_MATERIALS,
    MOULDING_STYLES,
    MOULDING_FINISHES,
    MOULDING_COLORS,
    GLASS_TYPES,
    BACKING_TYPES,
    MOUNTING_TYPES,
    CATEGORIES,
)

logger = logging.getLogger(__name__)

# Features used for the recommendation model
NUMERICAL_FEATURES = [
    "opening_width",
    "opening_height",
    "moulding_width",
    "mat_width_top",
    "mat_width_bottom",
    "price",
]

CATEGORICAL_FEATURES = [
    "orientation",
    "moulding_material",
    "moulding_style",
    "moulding_finish",
    "moulding_color",
    "glass_type",
    "backing_type",
    "mounting_type",
    "category",
]

BOOLEAN_FEATURES = [
    "mat_included",
]

# Known categories for each categorical feature (for consistent encoding)
CATEGORY_VALUES = {
    "orientation": ORIENTATIONS,
    "moulding_material": MOULDING_MATERIALS,
    "moulding_style": MOULDING_STYLES,
    "moulding_finish": MOULDING_FINISHES,
    "moulding_color": MOULDING_COLORS,
    "glass_type": GLASS_TYPES,
    "backing_type": BACKING_TYPES,
    "mounting_type": MOUNTING_TYPES,
    "category": CATEGORIES,
}


def configs_to_dataframe(configs: list[FrameConfig]) -> pd.DataFrame:
    """Convert a list of FrameConfig objects to a pandas DataFrame."""
    records = [c.to_dict() for c in configs]
    df = pd.DataFrame(records)

    # Ensure boolean column is int for sklearn
    if "mat_included" in df.columns:
        df["mat_included"] = df["mat_included"].astype(int)

    return df


def build_feature_pipeline() -> ColumnTransformer:
    """
    Build a scikit-learn ColumnTransformer that encodes frame configs
    into a numerical feature matrix suitable for NearestNeighbors.

    Numerical features → StandardScaler
    Categorical features → OneHotEncoder (with known categories)
    Boolean features → passed through as-is (already 0/1)
    """
    # Build category lists for OneHotEncoder in column order
    categories = [
        CATEGORY_VALUES.get(feat, ["unknown"])
        for feat in CATEGORICAL_FEATURES
    ]

    transformers = [
        (
            "num",
            StandardScaler(),
            NUMERICAL_FEATURES,
        ),
        (
            "cat",
            OneHotEncoder(
                categories=categories,
                handle_unknown="infrequent_if_exist",
                sparse_output=False,
            ),
            CATEGORICAL_FEATURES,
        ),
        (
            "bool",
            "passthrough",
            BOOLEAN_FEATURES,
        ),
    ]

    return ColumnTransformer(
        transformers=transformers,
        remainder="drop",  # drop order_id, sku, mat colors (handled separately)
    )


class FrameEncoder:
    """
    Encodes FrameConfig objects into feature vectors.
    Wraps the sklearn ColumnTransformer with fit/transform methods.
    """

    def __init__(self):
        self.pipeline = build_feature_pipeline()
        self._is_fitted = False

    def fit(self, configs: list[FrameConfig]) -> "FrameEncoder":
        """Fit the encoder on training data."""
        df = configs_to_dataframe(configs)
        self.pipeline.fit(df)
        self._is_fitted = True
        logger.info(
            f"Encoder fitted on {len(configs)} configs, "
            f"output dimension: {self.pipeline.transform(df[:1]).shape[1]}"
        )
        return self

    def transform(self, configs: list[FrameConfig]) -> np.ndarray:
        """Transform FrameConfigs into feature vectors."""
        if not self._is_fitted:
            raise RuntimeError("Encoder not fitted — call fit() first")
        df = configs_to_dataframe(configs)
        return self.pipeline.transform(df)

    def fit_transform(self, configs: list[FrameConfig]) -> np.ndarray:
        """Fit and transform in one step."""
        df = configs_to_dataframe(configs)
        result = self.pipeline.fit_transform(df)
        self._is_fitted = True
        logger.info(
            f"Encoder fitted on {len(configs)} configs, "
            f"output dimension: {result.shape[1]}"
        )
        return result

    @property
    def feature_dimension(self) -> int:
        """Number of features in the output vector."""
        if not self._is_fitted:
            raise RuntimeError("Encoder not fitted — call fit() first")
        if hasattr(self.pipeline, "n_features_out_"):
            return self.pipeline.n_features_out_
        raise RuntimeError("Pipeline fitted but n_features_out_ not available")
