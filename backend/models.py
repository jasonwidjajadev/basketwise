"""Response/request models. These exist to generate an accurate OpenAPI schema --
the frontend runs `openapi-typescript` against /openapi.json to get its TS types,
so this file is effectively the typed half of the source-of-truth contract.

Shapes mirror Source-of-truth.md sections 0.3, 0.4 and 0.7.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Retailer = Literal["coles", "woolworths", "aldi", "harrisfarm"]


class Subcategory(BaseModel):
    id: str = Field(examples=["milk"], description="Stable canonical id. Send this in API requests.")
    name: str = Field(examples=["Milk"], description="Display label. Never derive this yourself.")
    product_count: int = Field(examples=[214])


class Category(BaseModel):
    id: str = Field(examples=["dairy-eggs-fridge"])
    name: str = Field(examples=["Dairy, Eggs & Fridge"])
    product_count: int = Field(examples=[3546])
    subcategories: list[Subcategory] = []


class Product(BaseModel):
    """A canonical grocery -- what the user wants to buy, not one retailer's listing."""

    id: str = Field(examples=["full-cream-milk-2l"], description="Canonical id. The basket stores this.")
    name: str = Field(examples=["Full Cream Milk"])
    brand: str | None = Field(default=None, examples=["Bega"])
    category: str | None = Field(default=None, examples=["dairy-eggs-fridge"])
    subcategory: str | None = Field(default=None, examples=["milk"],
                                    description="null when no reliable canonical mapping exists yet.")
    tags: list[str] = Field(default=[], examples=[["gluten-free"]])
    size_value: float | None = Field(default=None, examples=[2000.0],
                                     description="Normalised: grams, millilitres, packs or each.")
    size_unit: str | None = Field(default=None, examples=["ml"])
    image_url: str | None = None
    is_essential: bool = False
    min_price: float | None = Field(default=None, examples=[3.10],
                                    description="Cheapest current price across all retailers.")
    cheapest_retailer: str | None = Field(default=None, examples=["coles"],
                                          description="Which retailer sells it at `min_price`.")
    unit_price: float | None = Field(default=None, examples=[1.55],
                                     description="Price per `unit_measure` at the cheapest retailer. "
                                                 "Use with `unit_measure` to render \"$1.55 / 100g\" so "
                                                 "a 500 g tub and a 1 kg tub compare honestly.")
    unit_measure: str | None = Field(default=None, examples=["100g"])
    was_price: float | None = Field(default=None, examples=[4.20],
                                    description="Pre-special price at the cheapest retailer. "
                                                "null when not on special.")
    has_special: bool = Field(default=False, description="On special at at least one retailer.")
    retailer_count: int = Field(default=0, examples=[3], description="How many retailers stock it.")
    rating_avg: float | None = Field(default=None, examples=[4.7],
                                     description="Retailer star rating. Sparse today -- the Woolworths "
                                                 "detail crawl has not been run yet. Render only if present.")
    rating_count: int | None = Field(default=None, examples=[13])


class PricePoint(BaseModel):
    price: float
    was_price: float | None = None
    is_special: bool | None = None
    recorded_at: str


class PriceHistory(BaseModel):
    product_id: str
    retailer: str
    points: list[PricePoint]


class Offer(BaseModel):
    """One canonical product as sold by one retailer."""

    id: str
    product_id: str
    retailer: Retailer
    retailer_product_id: str | None = None
    retailer_product_name: str
    retailer_brand: str | None = None
    source_category: str | None = Field(default=None, description="Raw retailer taxonomy, preserved.")
    source_subcategory: str | None = None
    price: float
    was_price: float | None = None
    is_special: bool | None = None
    special_type: str | None = None
    special_end_date: str | None = None
    size_value: float | None = None
    size_unit: str | None = None
    unit_price: float | None = None
    product_url: str | None = None
    image_url: str | None = None
    is_available: bool | None = None
    last_updated: str | None = None


class ProductDetail(Product):
    offers: list[Offer] = []


class BasketItem(BaseModel):
    product_id: str = Field(examples=["full-cream-milk-2l"])
    quantity: int = Field(gt=0, examples=[2], description="Must be > 0. Removing the last unit removes the item.")


class CompareRequest(BaseModel):
    items: list[BasketItem]


CompareOptionId = Literal["recommended-split", "cheapest-single-store", "lowest-possible-price"]


class CompareItem(BaseModel):
    product_id: str
    product_name: str
    retailer_product_id: str | None = None
    retailer_product_name: str
    quantity: int
    unit_price: float
    line_total: float
    image_url: str | None = None


class StoreBreakdown(BaseModel):
    retailer: Retailer
    subtotal: float
    items: list[CompareItem]


class CompareOption(BaseModel):
    id: CompareOptionId
    name: str
    description: str
    total: float | None = Field(
        default=None,
        description="Complete-basket total. null when this strategy cannot fulfil every known item.")
    savings: float | None = Field(
        default=None,
        description="baseline (most expensive complete single-store) minus total. null when total or baseline is missing.")
    stores: int = Field(description="Number of retailer groups in breakdown.")
    recommended: bool
    breakdown: list[StoreBreakdown]


class CompareResponse(BaseModel):
    options: list[CompareOption]
    unknown_product_ids: list[str] = Field(
        default=[], description="Ids in the request that do not exist at all.")


class Health(BaseModel):
    status: str
    build_id: str | None = None
    built_at: str | None = None
    product_count: int
    offer_count: int
    retailers: list[str]
