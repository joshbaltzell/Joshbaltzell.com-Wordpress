#!/usr/bin/env python3
"""CLI script to ingest order data from Adobe Commerce."""

import json
import logging
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.ingest.adobe_commerce import AdobeCommerceClient, fetch_all_frame_configs
from src.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


def discover_options():
    """
    Fetch a sample of orders and print all custom option IDs found.
    Use this to build your OPTION_MAP in adobe_commerce.py.
    """
    client = AdobeCommerceClient()
    option_ids: dict[str, set[str]] = {}

    for i, order in enumerate(client.fetch_orders(page_size=10)):
        if i >= 10:
            break
        for item in order.get("items", []):
            product_option = item.get("product_option", {})
            ext = product_option.get("extension_attributes", {})
            for opt in ext.get("custom_options", []):
                oid = str(opt.get("option_id", ""))
                val = str(opt.get("option_value", ""))
                if oid not in option_ids:
                    option_ids[oid] = set()
                option_ids[oid].add(val)

    print("\n=== Custom Option IDs Found ===")
    for oid, values in sorted(option_ids.items()):
        sample = list(values)[:5]
        print(f"  Option ID {oid}: {sample}{'...' if len(values) > 5 else ''}")
    print(f"\nTotal: {len(option_ids)} unique option IDs")


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--discover-options":
        discover_options()
        return

    logger.info("Starting order ingestion from Adobe Commerce...")
    configs = fetch_all_frame_configs()

    if not configs:
        logger.warning("No frame configs extracted. Check your API credentials and OPTION_MAP.")
        return

    # Save to data directory
    data_dir = Path("data")
    data_dir.mkdir(exist_ok=True)
    output_path = data_dir / "frame_configs.json"

    with open(output_path, "w") as f:
        json.dump([c.to_dict() for c in configs], f, indent=2)

    unique_orders = len(set(c.order_id for c in configs))
    logger.info(
        f"Done! Extracted {len(configs)} frame configs from {unique_orders} orders."
    )
    logger.info(f"Saved to {output_path}")


if __name__ == "__main__":
    main()
