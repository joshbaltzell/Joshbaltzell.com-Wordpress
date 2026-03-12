"""Popularity-weighted clustering: find frame "archetypes" from order patterns."""

import logging

import numpy as np
from sklearn.cluster import KMeans

from src.features.encoder import FrameEncoder
from src.ingest.schema import FrameConfig

logger = logging.getLogger(__name__)


class FrameClusterer:
    """
    Groups frame configurations into archetypes using KMeans clustering.
    Each cluster represents a popular configuration pattern.
    """

    def __init__(self, n_clusters: int = 30):
        self.n_clusters = n_clusters
        self.kmeans: KMeans | None = None
        self.encoder: FrameEncoder | None = None
        self.configs: list[FrameConfig] = []
        self.labels: np.ndarray | None = None
        self.cluster_sizes: dict[int, int] = {}
        self.cluster_centers: list[FrameConfig] = []

    def fit(
        self,
        configs: list[FrameConfig],
        encoder: FrameEncoder,
    ) -> dict:
        """
        Cluster frame configs and identify archetypes.
        Uses a pre-fitted encoder.
        """
        self.configs = configs
        self.encoder = encoder

        feature_matrix = encoder.transform(configs)

        # Adjust n_clusters if we have fewer samples
        actual_clusters = min(self.n_clusters, len(configs) // 2, len(configs) - 1)
        if actual_clusters < 2:
            actual_clusters = 2

        self.kmeans = KMeans(
            n_clusters=actual_clusters,
            random_state=42,
            n_init=10,
        )
        self.labels = self.kmeans.fit_predict(feature_matrix)

        # Count cluster sizes
        self.cluster_sizes = {}
        for label in self.labels:
            self.cluster_sizes[int(label)] = self.cluster_sizes.get(int(label), 0) + 1

        # Find the representative config for each cluster (closest to centroid)
        self.cluster_centers = []
        for cluster_id in range(actual_clusters):
            mask = self.labels == cluster_id
            cluster_indices = np.where(mask)[0]
            if len(cluster_indices) == 0:
                continue

            cluster_vectors = feature_matrix[mask]
            centroid = self.kmeans.cluster_centers_[cluster_id]
            distances = np.linalg.norm(cluster_vectors - centroid, axis=1)
            closest_idx = cluster_indices[np.argmin(distances)]
            self.cluster_centers.append(configs[closest_idx])

        logger.info(
            f"Clustered {len(configs)} configs into {actual_clusters} archetypes. "
            f"Largest cluster: {max(self.cluster_sizes.values())} configs"
        )

        return {
            "n_clusters": actual_clusters,
            "cluster_sizes": self.cluster_sizes,
            "largest_cluster": max(self.cluster_sizes.values()),
            "smallest_cluster": min(self.cluster_sizes.values()),
        }

    def get_archetypes(self, top_n: int = 10) -> list[dict]:
        """
        Return the top N most popular archetypes (cluster representatives),
        sorted by cluster size.
        """
        if not self.cluster_centers:
            return []

        archetype_data = []
        for i, center_config in enumerate(self.cluster_centers):
            size = self.cluster_sizes.get(i, 0)
            archetype_data.append({
                "cluster_id": i,
                "config": center_config.to_dict(),
                "order_count": size,
                "percentage": round(size / len(self.configs) * 100, 1),
            })

        archetype_data.sort(key=lambda x: x["order_count"], reverse=True)
        return archetype_data[:top_n]

    def predict_cluster(self, config: FrameConfig) -> int:
        """Predict which cluster a new config belongs to."""
        if self.kmeans is None or self.encoder is None:
            raise RuntimeError("Clusterer not fitted")
        vector = self.encoder.transform([config])
        return int(self.kmeans.predict(vector)[0])
