"""Core recommendation engine: NearestNeighbors on frame feature vectors."""

import logging
import os
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np

from sklearn.neighbors import NearestNeighbors

from src.config import settings
from src.features.encoder import FrameEncoder
from src.ingest.schema import FrameConfig

logger = logging.getLogger(__name__)


class FrameRecommender:
    """
    Content-based frame recommendation engine.

    Uses NearestNeighbors on encoded frame configurations to find
    similar historical orders for a given customer context.
    """

    def __init__(self, n_neighbors: int = 20):
        self.encoder = FrameEncoder()
        self.nn_model = NearestNeighbors(
            n_neighbors=n_neighbors,
            metric="cosine",
            algorithm="brute",  # cosine metric requires brute
        )
        self.configs: list[FrameConfig] = []
        self.feature_matrix: np.ndarray | None = None
        self.model_version: str = ""
        self._is_fitted = False

    def train(self, configs: list[FrameConfig]) -> dict:
        """
        Train the recommender on historical frame configurations.
        Returns training metadata.
        """
        if len(configs) < 2:
            raise ValueError("Need at least 2 configurations to train")

        self.configs = configs
        self.feature_matrix = self.encoder.fit_transform(configs)

        # Adjust n_neighbors if we have fewer samples
        actual_neighbors = min(self.nn_model.n_neighbors, len(configs) - 1)
        self.nn_model.set_params(n_neighbors=actual_neighbors)

        self.nn_model.fit(self.feature_matrix)
        self.model_version = datetime.now().strftime("%Y%m%d_%H%M%S")
        self._is_fitted = True

        logger.info(
            f"Model trained: {len(configs)} configs, "
            f"{self.feature_matrix.shape[1]} features, "
            f"version {self.model_version}"
        )

        return {
            "model_version": self.model_version,
            "training_samples": len(configs),
            "feature_dimension": self.feature_matrix.shape[1],
            "n_neighbors": actual_neighbors,
        }

    def recommend(
        self,
        query: FrameConfig,
        n_results: int = 5,
        budget_range: tuple[float, float] | None = None,
    ) -> list[dict]:
        """
        Given a (possibly partial) frame config, find the most similar
        historical configurations.

        Returns a list of recommendations, each containing:
        - config: the recommended FrameConfig
        - score: similarity score (0-1, higher = more similar)
        - distance: raw cosine distance
        """
        if not self._is_fitted:
            raise RuntimeError("Model not trained — call train() first")

        # Encode the query
        query_vector = self.encoder.transform([query])

        # Find nearest neighbors (fetch extra so we can deduplicate/filter)
        fetch_k = min(n_results * 3, len(self.configs))
        distances, indices = self.nn_model.kneighbors(
            query_vector, n_neighbors=fetch_k
        )

        results: list[dict] = []
        seen_signatures: set[str] = set()

        for dist, idx in zip(distances[0], indices[0]):
            config = self.configs[idx]

            # Optional budget filter
            if budget_range:
                if config.price < budget_range[0] or config.price > budget_range[1]:
                    continue

            # Deduplicate by a "signature" of key attributes
            sig = _config_signature(config)
            if sig in seen_signatures:
                continue
            seen_signatures.add(sig)

            # Convert cosine distance to similarity score
            similarity = max(0.0, 1.0 - dist)

            results.append({
                "config": config.to_dict(),
                "score": round(similarity, 4),
                "distance": round(float(dist), 4),
            })

            if len(results) >= n_results:
                break

        return results

    def get_popular(
        self,
        category: str | None = None,
        limit: int = 10,
    ) -> list[dict]:
        """
        Return the most popular frame configurations, optionally filtered
        by category. Popularity is determined by counting similar configs
        within a small radius.
        """
        if not self._is_fitted:
            raise RuntimeError("Model not trained — call train() first")

        filtered_configs = self.configs
        if category:
            filtered_configs = [
                c for c in self.configs if c.category == category
            ]

        if not filtered_configs:
            return []

        # Count how many configs are "near" each config (density-based popularity)
        filtered_vectors = self.encoder.transform(filtered_configs)
        popularity_scores: list[tuple[int, float]] = []

        for i in range(len(filtered_configs)):
            distances = np.linalg.norm(
                filtered_vectors - filtered_vectors[i], axis=1
            )
            # Count configs within a small radius as "similar"
            nearby = int(np.sum(distances < 0.5))
            popularity_scores.append((i, nearby))

        # Sort by popularity (descending)
        popularity_scores.sort(key=lambda x: x[1], reverse=True)

        # Deduplicate and return top N
        results: list[dict] = []
        seen: set[str] = set()

        for idx, pop_count in popularity_scores:
            config = filtered_configs[idx]
            sig = _config_signature(config)
            if sig in seen:
                continue
            seen.add(sig)

            results.append({
                "config": config.to_dict(),
                "popularity": pop_count,
                "similar_orders": pop_count,
            })

            if len(results) >= limit:
                break

        return results

    def save(self, directory: str | None = None) -> str:
        """Save model artifacts to disk."""
        model_dir = Path(directory or settings.model_dir)
        model_dir.mkdir(parents=True, exist_ok=True)

        artifact_path = model_dir / f"recommender_{self.model_version}.joblib"
        joblib.dump(
            {
                "encoder": self.encoder,
                "nn_model": self.nn_model,
                "configs": self.configs,
                "feature_matrix": self.feature_matrix,
                "model_version": self.model_version,
            },
            artifact_path,
        )

        # Also save as "latest" for easy loading
        latest_path = model_dir / "recommender_latest.joblib"
        joblib.dump(
            {
                "encoder": self.encoder,
                "nn_model": self.nn_model,
                "configs": self.configs,
                "feature_matrix": self.feature_matrix,
                "model_version": self.model_version,
            },
            latest_path,
        )

        logger.info(f"Model saved to {artifact_path}")
        return str(artifact_path)

    @classmethod
    def load(cls, path: str | None = None) -> "FrameRecommender":
        """Load a trained model from disk."""
        if path is None:
            path = os.path.join(settings.model_dir, "recommender_latest.joblib")

        if not os.path.exists(path):
            raise FileNotFoundError(f"No model found at {path}")

        data = joblib.load(path)

        recommender = cls()
        recommender.encoder = data["encoder"]
        recommender.nn_model = data["nn_model"]
        recommender.configs = data["configs"]
        recommender.feature_matrix = data["feature_matrix"]
        recommender.model_version = data["model_version"]
        recommender._is_fitted = True

        logger.info(
            f"Model loaded: version {recommender.model_version}, "
            f"{len(recommender.configs)} configs"
        )
        return recommender


def _config_signature(config: FrameConfig) -> str:
    """
    Create a deduplication signature from the key attributes.
    Two configs with the same signature are considered "the same recommendation".
    """
    return (
        f"{config.moulding_material}|{config.moulding_style}|{config.moulding_color}|"
        f"{config.moulding_finish}|{config.glass_type}|{config.mat_included}|"
        f"{config.mat_color_top}|{round(config.opening_width)}x{round(config.opening_height)}"
    )
