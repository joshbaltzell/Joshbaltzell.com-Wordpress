"""Tests for the frame recommendation engine."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.ingest.schema import FrameConfig
from src.features.encoder import FrameEncoder
from src.model.recommender import FrameRecommender
from src.model.clusters import FrameClusterer


def make_test_configs() -> list[FrameConfig]:
    """Generate a set of synthetic frame configs for testing."""
    configs = []

    # Modern photo frames
    for w, h in [(8, 10), (11, 14), (16, 20), (5, 7), (8, 10)]:
        configs.append(FrameConfig(
            opening_width=w, opening_height=h,
            orientation="portrait",
            moulding_material="wood", moulding_style="modern",
            moulding_color="black", moulding_finish="matte",
            moulding_width=1.0,
            mat_included=True, mat_color_top="white",
            mat_width_top=2.0,
            glass_type="regular", backing_type="standard",
            category="photo", price=45.0 + w * 2,
            order_id=f"ORD-{len(configs)}",
        ))

    # Ornate art frames
    for w, h in [(20, 24), (24, 30), (18, 24), (16, 20)]:
        configs.append(FrameConfig(
            opening_width=w, opening_height=h,
            orientation="portrait",
            moulding_material="wood", moulding_style="ornate",
            moulding_color="gold", moulding_finish="glossy",
            moulding_width=2.5,
            mat_included=True, mat_color_top="cream",
            mat_width_top=3.0,
            glass_type="uv_protection", backing_type="acid_free",
            category="art", price=150.0 + w * 3,
            order_id=f"ORD-{len(configs)}",
        ))

    # Minimal metal frames
    for w, h in [(8, 10), (11, 14), (5, 7)]:
        configs.append(FrameConfig(
            opening_width=w, opening_height=h,
            orientation="portrait",
            moulding_material="metal", moulding_style="minimal",
            moulding_color="silver", moulding_finish="satin",
            moulding_width=0.5,
            mat_included=False,
            glass_type="non_glare", backing_type="standard",
            category="photo", price=35.0 + w * 1.5,
            order_id=f"ORD-{len(configs)}",
        ))

    # Diploma frames
    for w, h in [(8.5, 11), (11, 14)]:
        configs.append(FrameConfig(
            opening_width=w, opening_height=h,
            orientation="portrait",
            moulding_material="wood", moulding_style="traditional",
            moulding_color="cherry", moulding_finish="glossy",
            moulding_width=1.5,
            mat_included=True, mat_color_top="navy",
            mat_width_top=2.5,
            glass_type="non_glare", backing_type="acid_free",
            category="diploma", price=80.0,
            order_id=f"ORD-{len(configs)}",
        ))

    return configs


def test_encoder_basic():
    configs = make_test_configs()
    encoder = FrameEncoder()
    matrix = encoder.fit_transform(configs)

    assert matrix.shape[0] == len(configs)
    assert matrix.shape[1] > 0
    print(f"Encoder: {len(configs)} configs → {matrix.shape[1]} features")


def test_recommender_train_and_recommend():
    configs = make_test_configs()

    rec = FrameRecommender(n_neighbors=5)
    meta = rec.train(configs)

    assert meta["training_samples"] == len(configs)
    assert meta["feature_dimension"] > 0

    # Query for a modern photo frame
    query = FrameConfig(
        opening_width=8.0,
        opening_height=10.0,
        category="photo",
        moulding_style="modern",
    )
    results = rec.recommend(query, n_results=3)

    assert len(results) > 0
    assert results[0]["score"] > 0
    # The top result should be a modern photo frame
    assert results[0]["config"]["moulding_style"] == "modern"
    print(f"Top recommendation: {results[0]['config']['moulding_material']} "
          f"{results[0]['config']['moulding_style']} — score {results[0]['score']}")


def test_recommender_budget_filter():
    configs = make_test_configs()
    rec = FrameRecommender()
    rec.train(configs)

    query = FrameConfig(opening_width=16, opening_height=20, category="photo")
    results = rec.recommend(query, n_results=5, budget_range=(30.0, 80.0))

    for r in results:
        assert r["config"]["price"] >= 30.0
        assert r["config"]["price"] <= 80.0


def test_popular():
    configs = make_test_configs()
    rec = FrameRecommender()
    rec.train(configs)

    popular = rec.get_popular(category="photo", limit=3)
    assert len(popular) > 0
    for p in popular:
        assert p["config"]["category"] == "photo"


def test_clusterer():
    configs = make_test_configs()
    encoder = FrameEncoder()
    encoder.fit(configs)

    clusterer = FrameClusterer(n_clusters=4)
    meta = clusterer.fit(configs, encoder)

    assert meta["n_clusters"] > 0
    archetypes = clusterer.get_archetypes(top_n=3)
    assert len(archetypes) > 0
    print(f"Top archetype: {archetypes[0]['config']['moulding_style']} "
          f"({archetypes[0]['order_count']} orders)")


def test_save_and_load(tmp_path):
    configs = make_test_configs()
    rec = FrameRecommender()
    rec.train(configs)
    path = rec.save(str(tmp_path))

    loaded = FrameRecommender.load(path)
    assert loaded.model_version == rec.model_version
    assert len(loaded.configs) == len(configs)

    # Recommendations should work after loading
    query = FrameConfig(opening_width=8, opening_height=10, category="photo")
    results = loaded.recommend(query, n_results=2)
    assert len(results) > 0


if __name__ == "__main__":
    import tempfile

    print("Running tests...\n")
    test_encoder_basic()
    print("  ✓ encoder_basic")

    test_recommender_train_and_recommend()
    print("  ✓ recommender_train_and_recommend")

    test_recommender_budget_filter()
    print("  ✓ recommender_budget_filter")

    test_popular()
    print("  ✓ popular")

    test_clusterer()
    print("  ✓ clusterer")

    with tempfile.TemporaryDirectory() as td:
        test_save_and_load(td)
    print("  ✓ save_and_load")

    print("\nAll tests passed!")
