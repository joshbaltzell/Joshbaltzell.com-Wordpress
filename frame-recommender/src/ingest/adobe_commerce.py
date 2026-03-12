"""Adobe Commerce (Magento 2) REST API client for pulling order data."""

import logging
from typing import Iterator

import requests

from src.config import settings
from src.ingest.schema import FrameConfig

logger = logging.getLogger(__name__)


class AdobeCommerceClient:
    """Pulls orders from Adobe Commerce REST API and extracts frame configs."""

    def __init__(
        self,
        base_url: str | None = None,
        token: str | None = None,
    ):
        self.base_url = (base_url or settings.adobe_commerce_base_url).rstrip("/")
        self.token = token or settings.adobe_commerce_token
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        })

    def _get(self, endpoint: str, params: dict | None = None) -> dict:
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        response = self.session.get(url, params=params, timeout=30)
        response.raise_for_status()
        return response.json()

    def fetch_orders(
        self,
        page_size: int = 100,
        status: str = "complete",
    ) -> Iterator[dict]:
        """
        Paginate through all orders with the given status.
        Yields raw order dicts from the Adobe Commerce API.
        """
        current_page = 1
        while True:
            params = {
                "searchCriteria[filter_groups][0][filters][0][field]": "status",
                "searchCriteria[filter_groups][0][filters][0][value]": status,
                "searchCriteria[pageSize]": page_size,
                "searchCriteria[currentPage]": current_page,
                "searchCriteria[sortOrders][0][field]": "created_at",
                "searchCriteria[sortOrders][0][direction]": "DESC",
            }

            try:
                data = self._get("/orders", params=params)
            except requests.RequestException as e:
                logger.error(f"Failed to fetch orders page {current_page}: {e}")
                break

            items = data.get("items", [])
            if not items:
                break

            for order in items:
                yield order

            total_count = data.get("total_count", 0)
            fetched = current_page * page_size
            if fetched >= total_count:
                break

            current_page += 1

    def extract_frame_configs(self, order: dict) -> list[FrameConfig]:
        """
        Extract frame configurations from an order's line items.

        Adobe Commerce stores custom options as product_option.extension_attributes
        or as custom_options on each order item. The exact attribute names depend
        on how the store was configured.

        This method handles common patterns — you may need to adjust the
        attribute mapping to match your specific store setup.
        """
        configs = []
        order_id = str(order.get("entity_id", ""))

        for item in order.get("items", []):
            # Skip non-frame products (e.g., shipping, discounts)
            product_type = item.get("product_type", "")
            if product_type in ("virtual", "downloadable"):
                continue

            config = FrameConfig(
                order_id=order_id,
                sku=item.get("sku", ""),
                price=float(item.get("price", 0)),
            )

            # Extract custom options
            options = self._extract_custom_options(item)

            # Map options to FrameConfig fields
            config = self._map_options_to_config(config, options)

            # Derive orientation from dimensions
            if config.opening_width > 0 and config.opening_height > 0:
                if abs(config.opening_width - config.opening_height) < 0.5:
                    config.orientation = "square"
                elif config.opening_width > config.opening_height:
                    config.orientation = "landscape"
                else:
                    config.orientation = "portrait"

            configs.append(config)

        return configs

    def _extract_custom_options(self, item: dict) -> dict[str, str]:
        """
        Pull custom options from an order item.
        Adobe Commerce can store these in multiple locations.
        """
        options: dict[str, str] = {}

        # Method 1: product_option → extension_attributes → custom_options
        product_option = item.get("product_option", {})
        ext_attrs = product_option.get("extension_attributes", {})
        for opt in ext_attrs.get("custom_options", []):
            label = opt.get("option_id", "")
            value = opt.get("option_value", "")
            options[str(label)] = str(value)

        # Method 2: Top-level extension_attributes.custom_options
        for opt in item.get("extension_attributes", {}).get("custom_options", []):
            label = opt.get("option_id", "")
            value = opt.get("option_value", "")
            options[str(label)] = str(value)

        # Method 3: Configurable product options (super_attribute)
        for attr in ext_attrs.get("configurable_item_options", []):
            option_id = attr.get("option_id", "")
            option_value = attr.get("option_value", "")
            options[str(option_id)] = str(option_value)

        return options

    def _map_options_to_config(
        self,
        config: FrameConfig,
        options: dict[str, str],
    ) -> FrameConfig:
        """
        Map Adobe Commerce custom option IDs/values to FrameConfig fields.

        IMPORTANT: The option IDs below are placeholders. You'll need to
        update these to match your specific Adobe Commerce store's attribute
        configuration. Run the `ingest.py` script with --discover-options
        to see what option IDs your store uses.
        """
        # This mapping needs to be customized per store.
        # The keys are Adobe Commerce option_id values (as strings).
        # Use scripts/discover_options.py to find your store's option IDs.
        OPTION_MAP = {
            # "option_id": ("config_field", parser_function)
            # Examples — replace with your actual option IDs:
            # "142": ("opening_width", float),
            # "143": ("opening_height", float),
            # "144": ("moulding_material", str),
            # "145": ("moulding_color", str),
            # "146": ("moulding_style", str),
            # "147": ("moulding_width", float),
            # "148": ("moulding_finish", str),
            # "149": ("mat_included", lambda v: v.lower() in ("yes", "true", "1")),
            # "150": ("mat_color_top", str),
            # "151": ("mat_color_bottom", str),
            # "152": ("mat_width_top", float),
            # "153": ("glass_type", str),
            # "154": ("backing_type", str),
            # "155": ("mounting_type", str),
            # "156": ("category", str),
        }

        for option_id, value in options.items():
            mapping = OPTION_MAP.get(option_id)
            if mapping:
                field_name, parser = mapping
                try:
                    setattr(config, field_name, parser(value))
                except (ValueError, TypeError) as e:
                    logger.warning(
                        f"Failed to parse option {option_id}={value}: {e}"
                    )

        return config


def fetch_all_frame_configs(
    base_url: str | None = None,
    token: str | None = None,
) -> list[FrameConfig]:
    """Convenience function: pull all orders and extract frame configs."""
    client = AdobeCommerceClient(base_url=base_url, token=token)
    configs: list[FrameConfig] = []

    for order in client.fetch_orders():
        order_configs = client.extract_frame_configs(order)
        configs.extend(order_configs)

    logger.info(f"Extracted {len(configs)} frame configs from orders")
    return configs
