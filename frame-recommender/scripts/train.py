#!/usr/bin/env python3
"""CLI script to train the recommendation model."""

import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.ingest.schema import FrameConfig
from src.model.recommender import FrameRecommender
from src.model.clusters import FrameClusterer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


def main():
    data_path = Path("data") / "frame_configs.json"

    if not data_path.exists():
        logger.error(
            f"No data at {data_path}. Run 'python scripts/ingest.py' first."
        )
        sys.exit(1)

    with open(data_path) as f:
        raw_configs = json.load(f)

    configs = [FrameConfig.from_dict(c) for c in raw_configs]
    logger.info(f"Loaded {len(configs)} frame configurations")

    if len(configs) < 2:
        logger.error("Need at least 2 configurations to train")
        sys.exit(1)

    # Train recommender
    recommender = FrameRecommender()
    train_meta = recommender.train(configs)
    model_path = recommender.save()

    logger.info(f"Recommender trained: {train_meta}")
    logger.info(f"Model saved to: {model_path}")

    # Train clusterer
    if len(configs) >= 4:
        clusterer = FrameClusterer()
        cluster_meta = clusterer.fit(configs, recommender.encoder)
        logger.info(f"Clusterer trained: {cluster_meta}")

        archetypes = clusterer.get_archetypes(top_n=5)
        logger.info("\nTop 5 Frame Archetypes:")
        for i, arch in enumerate(archetypes, 1):
            cfg = arch["config"]
            logger.info(
                f"  {i}. {cfg['moulding_material']} / {cfg['moulding_style']} / "
                f"{cfg['moulding_color']} — {cfg['opening_width']}x{cfg['opening_height']} "
                f"({arch['order_count']} orders, {arch['percentage']}%)"
            )

    # Quick test: recommend something
    logger.info("\n--- Quick test: 8x10 photo frame ---")
    test_query = FrameConfig(
        opening_width=8.0,
        opening_height=10.0,
        category="photo",
    )
    results = recommender.recommend(test_query, n_results=3)
    for i, rec in enumerate(results, 1):
        cfg = rec["config"]
        logger.info(
            f"  {i}. {cfg['moulding_material']} / {cfg['moulding_style']} / "
            f"{cfg['moulding_color']} — ${cfg['price']:.2f} "
            f"(score: {rec['score']})"
        )


if __name__ == "__main__":
    main()
