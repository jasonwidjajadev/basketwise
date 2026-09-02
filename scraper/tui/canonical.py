"""Canonical BasketWise taxonomy: retailer source strings -> canonical IDs.

CATEGORY_MAP / SUBCATEGORY_MAP / TAG_MAP / CANONICAL_SUBCATEGORIES are transcribed
from the appendix of project-management/Source-of_truth_v2.md and are the single
source of truth for normalisation. Harris Farm is not in v2 (it was added to the
crawler later); its map lives here and is mirrored into the doc.

Rule from v2: an unknown source string normalises to None. Never invent a mapping --
the raw value is always preserved on the offer as source_category/source_subcategory.
"""
from __future__ import annotations

import re
import unicodedata

# --- v2 section 4: the 17 canonical categories, in frontend display order ---------
CATEGORIES: list[tuple[str, str]] = [
    ("fruit-vegetables", "Fruit & Vegetables"),
    ("meat-seafood", "Meat & Seafood"),
    ("deli-chilled", "Deli & Chilled"),
    ("dairy-eggs-fridge", "Dairy, Eggs & Fridge"),
    ("bakery", "Bakery"),
    ("pantry", "Pantry"),
    ("snacks-confectionery", "Snacks & Confectionery"),
    ("frozen", "Frozen"),
    ("drinks", "Drinks"),
    ("cleaning-household", "Cleaning & Household"),
    ("health-beauty", "Health & Beauty"),
    ("baby", "Baby"),
    ("pet", "Pet"),
    ("liquor", "Liquor"),
    ("electronics", "Electronics"),
    ("home-garden", "Home & Garden"),
    ("tobacco", "Tobacco"),
]
CATEGORY_NAME = dict(CATEGORIES)

# --- v2 section 0.2.1: canonical tags -------------------------------------------
TAGS: dict[str, str] = {
    "organic": "Organic",
    "halal": "Halal",
    "kosher": "Kosher",
    "vegan": "Vegan",
    "vegetarian": "Vegetarian",
    "gluten-free": "Gluten Free",
    "high-protein": "High Protein",
    "lactose-free": "Lactose Free",
}

# --- v2 appendix 1: top-level category mapping ----------------------------------
# None = a promotional/merchandising collection. Preserve the source value but never
# use it as products.category.
CATEGORY_MAP: dict[str, dict[str, str | None]] = {
    "woolworths": {
        "Fruit & Veg": "fruit-vegetables",
        "Poultry, Meat & Seafood": "meat-seafood",
        "Deli": "deli-chilled",
        "Dairy, Eggs & Fridge": "dairy-eggs-fridge",
        "Bakery": "bakery",
        "Freezer": "frozen",
        "Snacks & Confectionery": "snacks-confectionery",
        "Pantry": "pantry",
        "Drinks": "drinks",
        "Beer, Wine & Spirits": "liquor",
        "Beauty": "health-beauty",
        "Personal Care": "health-beauty",
        "Health & Wellness": "health-beauty",
        "Cleaning & Maintenance": "cleaning-household",
        "Baby": "baby",
        "Pet": "pet",
        "Electronics": "electronics",
        "Home & Lifestyle": "home-garden",
        "International Foods": None,
        "Dinner": None,
        "Lunch Box": None,
        "Front of Store": None,
        "New": None,
        "Specials": None,
        "Everyday Market": None,
        "Healthylife": None,
        "Back to School": None,
        "Gift Ideas": None,
    },
    "coles": {
        "Meat & Seafood": "meat-seafood",
        "Fruit & Vegetables": "fruit-vegetables",
        "Dairy, Eggs & Fridge": "dairy-eggs-fridge",
        "Bakery": "bakery",
        "Deli": "deli-chilled",
        "Pantry": "pantry",
        "Chips, Chocolates & Snacks": "snacks-confectionery",
        "Drinks": "drinks",
        "Liquorland": "liquor",
        "Frozen": "frozen",
        "Cleaning & Laundry": "cleaning-household",
        "Health & Beauty": "health-beauty",
        "Baby": "baby",
        "Pet": "pet",
        "Home & Garden": "home-garden",
        "Tobacco": "tobacco",
        "Dietary & World Foods": None,
        "Lunchbox": None,
        "Specials": None,
        "Big Pack Value": None,
        "Deliver More Range": None,
        "Down Down": None,
        "Fresh Specials": None,
    },
    "aldi": {
        "Fruit & Vegetable": "fruit-vegetables",
        "Fruits & Vegetables": "fruit-vegetables",
        "Meat & Seafood": "meat-seafood",
        "Deli": "deli-chilled",
        "Deli & Chilled Meats": "deli-chilled",
        "Dairy, Eggs & Fridge": "dairy-eggs-fridge",
        "Pantry": "pantry",
        "Bakery": "bakery",
        "Freezer": "frozen",
        "Drinks": "drinks",
        "Health & Beauty": "health-beauty",
        "Baby": "baby",
        "Cleaning & Household": "cleaning-household",
        "Pets": "pet",
        "Liquor": "liquor",
        "Snacks & Confectionery": "snacks-confectionery",
        "Higher Protein Food and Drink": None,
        "Front of Store": None,
        "Lower Prices": None,
        "Super Savers": None,
        "Limited Time Only": None,
        "The People's Picks": None,
        "People's Picks": None,
    },
    # Not in v2 -- Harris Farm exposes only its internal merchandising codes
    # (Frdg1-Cheese, Grocery-Confection, Z-Bakery ...) via `category`.
    "harrisfarm": {
        "Fruit": "fruit-vegetables",
        "Vegetables": "fruit-vegetables",
        "Fruit & Vegetables": "fruit-vegetables",
        "Salads": "fruit-vegetables",
        "Herbs": "fruit-vegetables",
        "Frdg5-Meat": "meat-seafood",
        "Frdg5-Seafood": "meat-seafood",
        "Frdg5-Poultry": "meat-seafood",
        "Frdg4-Deli": "deli-chilled",
        "Frdg1-Antipasti": "deli-chilled",
        "Frdg3-Meals": "deli-chilled",
        "Frdg1-Cheese": "dairy-eggs-fridge",
        "Frdg2-Dairy": "dairy-eggs-fridge",
        "Fridge-Dairy": "dairy-eggs-fridge",
        "Fridge-Yoghurts": "dairy-eggs-fridge",
        "Frdg2-Eggs": "dairy-eggs-fridge",
        "Frdg2-Butter": "dairy-eggs-fridge",
        "Z-Bakery": "bakery",
        "Bakery": "bakery",
        "Grocery-Cooking": "pantry",
        "Grocery-Condiments": "pantry",
        "Grocery-Pasta": "pantry",
        "Grocery-Coffee": "pantry",
        "Grocery-Spices": "pantry",
        "Grocery-Asian": "pantry",
        "Grocery-Oils": "pantry",
        "Grocery-Spreads": "pantry",
        "Grocery-Can or Jar": "pantry",
        "Grocery-Cereal": "pantry",
        "Grocery-Baking": "pantry",
        "Grocery-Tea": "pantry",
        "Grocery-Health": "pantry",
        "Grocery-Confection": "snacks-confectionery",
        "Grocery-Biscuits": "snacks-confectionery",
        "Grocery-Nuts": "snacks-confectionery",
        "Grocery-Chips": "snacks-confectionery",
        "Grocery-Snacks": "snacks-confectionery",
        "Frozen": "frozen",
        "Z-Frozen": "frozen",
        "Grocery-Drinks": "drinks",
        "Fridge-Drinks": "drinks",
        "Frdg1-Drinks": "drinks",
        "Grocery-Cleaning": "cleaning-household",
        "Grocery-Household": "cleaning-household",
        "Liquor": "liquor",
        "Grocery-Liquor": "liquor",
        "Grocery-Pet": "pet",
        "Grocery-Baby": "baby",
    },
}

# --- v2 appendix 2: canonical subcategories per category -------------------------
CANONICAL_SUBCATEGORIES: dict[str, list[str]] = {
    "fruit-vegetables": ["fruit", "vegetables", "herbs", "salads", "prepared-vegetables"],
    "meat-seafood": ["beef", "poultry", "lamb", "pork", "mince", "sausages-burgers", "seafood", "ham"],
    "deli-chilled": ["deli-meat", "dips-antipasto", "chilled-meals"],
    "dairy-eggs-fridge": ["milk", "long-life-milk", "eggs", "yoghurt", "cheese", "butter-margarine", "cream-custard"],
    "bakery": ["bread", "wraps-flatbread", "cakes-desserts", "pastries"],
    "pantry": ["breakfast", "pasta-rice-grains", "canned-food", "sauces", "condiments-dressings",
               "oils-vinegars", "spreads", "baking", "herbs-spices"],
    "snacks-confectionery": ["chips", "chocolate", "lollies", "biscuits", "crackers", "nuts-dried-fruit"],
    "frozen": ["frozen-vegetables", "frozen-fruit", "frozen-meals", "frozen-pizza", "frozen-meat",
               "frozen-seafood", "ice-cream"],
    "drinks": ["water", "soft-drinks", "juice-cordial", "sports-energy", "iced-tea-kombucha",
               "tea-coffee", "flavoured-milk"],
    "cleaning-household": ["laundry", "household-cleaning", "dishwashing", "bathroom-cleaning",
                           "kitchen-cleaning", "paper-products", "food-storage", "air-fresheners", "pest-control"],
    "health-beauty": ["personal-care", "skincare", "hair-care", "oral-care", "health", "beauty"],
    "baby": ["baby-food", "baby-formula", "nappies-wipes", "baby-care"],
    "pet": ["dog", "cat", "pet-food", "pet-care"],
    "liquor": ["beer", "wine", "spirits", "cider-rtd"],
}

# Human labels for subcategory IDs. Anything not listed falls back to a title-cased slug.
SUBCATEGORY_NAME: dict[str, str] = {
    "long-life-milk": "Long Life Milk", "butter-margarine": "Butter & Margarine",
    "cream-custard": "Cream & Custard", "cream-custard-desserts": "Cream, Custard & Desserts",
    "dips-pate": "Dips & Pate", "dips-antipasto": "Dips & Antipasto",
    "sausages-burgers": "Sausages & Burgers", "sausages-frankfurts": "Sausages & Frankfurts",
    "ham-bacon-smallgoods": "Ham, Bacon & Smallgoods", "deli-meat": "Deli Meat", "deli-meats": "Deli Meats",
    "deli-specialties": "Deli Specialties", "bbq-meat": "BBQ Meat", "roasts-slow-cooked": "Roasts & Slow Cooked",
    "prepared-vegetables": "Prepared Vegetables", "pasta-rice-grains": "Pasta, Rice & Grains",
    "canned-food": "Canned Food", "condiments-dressings": "Condiments & Dressings",
    "oils-vinegars": "Oils & Vinegars", "herbs-spices": "Herbs & Spices",
    "nuts-dried-fruit": "Nuts & Dried Fruit", "breakfast-spreads": "Breakfast & Spreads",
    "snack-bars": "Muesli & Snack Bars", "tea-coffee": "Tea & Coffee", "cooking-sauces": "Cooking Sauces",
    "frozen-vegetables": "Frozen Vegetables", "frozen-fruit": "Frozen Fruit", "frozen-meals": "Frozen Meals",
    "frozen-pizza": "Frozen Pizza", "frozen-meat": "Frozen Meat", "frozen-seafood": "Frozen Seafood",
    "frozen-desserts": "Frozen Desserts", "ice-cream": "Ice Cream", "soft-drinks": "Soft Drinks",
    "juice-cordial": "Juices & Cordials", "juice-cordial-iced-tea": "Cordials, Juices & Iced Teas",
    "sports-energy": "Sports & Energy Drinks", "iced-tea-kombucha": "Iced Tea & Kombucha",
    "flavoured-milk": "Flavoured Milk", "chilled-drinks": "Chilled Drinks", "chilled-meals": "Chilled Meals",
    "household-cleaning": "Household Cleaning", "bathroom-cleaning": "Bathroom Cleaning",
    "kitchen-cleaning": "Kitchen Cleaning", "paper-products": "Toilet Paper, Tissues & Paper Towels",
    "food-storage": "Food Storage", "air-fresheners": "Air Fresheners", "pest-control": "Pest Control",
    "personal-care": "Personal Care", "skincare": "Skincare", "hair-care": "Hair Care",
    "oral-care": "Oral Care", "health-foods": "Health Foods", "vitamins-supplements": "Vitamins & Supplements",
    "sports-nutrition": "Diet & Sports Nutrition", "first-aid-medicinal": "First Aid & Medicinal",
    "baby-food": "Baby Food", "baby-formula": "Baby Formula", "nappies-wipes": "Nappies & Wipes",
    "baby-care": "Baby Care", "pet-food": "Pet Food", "pet-care": "Pet Care", "other-pets": "Other Pets",
    "cider-rtd": "Cider & RTD", "wraps-flatbread": "Wraps & Flatbread", "cakes-desserts": "Cakes & Desserts",
}

# --- v2 appendix 3: subcategory mapping -----------------------------------------
SUBCATEGORY_MAP: dict[str, dict[str, str]] = {
    "woolworths": {
        "Fruit": "fruit", "Vegetables": "vegetables", "Salad": "salads",
        "Prepared Vegetables": "prepared-vegetables",
        "Poultry": "poultry", "Seafood": "seafood", "Mince": "mince",
        "BBQ Meat": "bbq-meat", "Roasts & Slow Cooked": "roasts-slow-cooked",
        "Deli Meats": "deli-meats", "Ham, Bacon & Smallgoods": "ham-bacon-smallgoods",
        "Sausages & Frankfurts": "sausages-frankfurts", "Deli Specialties": "deli-specialties",
        "Milk": "milk", "Cheese": "cheese", "Yoghurt": "yoghurt", "Eggs": "eggs",
        "Cream, Custard & Desserts": "cream-custard-desserts", "Dips & Pate": "dips-pate",
        "Breakfast & Spreads": "breakfast-spreads", "Muesli Bars & Snack Bars": "snack-bars",
        "Tea & Coffee": "tea-coffee", "Long Life Milk": "long-life-milk", "Baking": "baking",
        "Herbs & Spices": "herbs-spices", "Pasta, Rice & Grains": "pasta-rice-grains",
        "Cooking Sauces & Recipe Bases": "cooking-sauces", "Oil & Vinegar": "oils-vinegars",
        "Frozen Seafood": "frozen-seafood", "Frozen Meat": "frozen-meat", "Frozen Pizzas": "frozen-pizza",
        "Frozen Vegetables": "frozen-vegetables", "Frozen Fruit": "frozen-fruit",
        "Ice Cream": "ice-cream", "Frozen Desserts": "frozen-desserts",
        "Chilled Drinks": "chilled-drinks", "Soft Drinks": "soft-drinks",
        "Cordials, Juices & Iced Teas": "juice-cordial-iced-tea", "Water": "water",
        "Sports & Energy Drinks": "sports-energy", "Tea": "tea", "Coffee": "coffee",
        "Health Foods": "health-foods", "Vitamins": "vitamins-supplements",
        "Diet & Sports Nutrition": "sports-nutrition", "First Aid & Medicinal": "first-aid-medicinal",
        "Cat & Kitten": "cat", "Dog & Puppy": "dog", "Birds, Fish & Small Pets": "other-pets",
    },
    "coles": {
        "Fruit": "fruit", "Vegetables": "vegetables", "Herbs, Chillies & Sprouts": "herbs",
        "Packaged Salad": "salads", "Prepared Vegetable": "prepared-vegetables",
        "Beef & Veal": "beef", "Poultry": "poultry", "Bbq, Sausages & Burgers": "sausages-burgers",
        "Lamb": "lamb", "Pork": "pork", "Ham": "ham", "Mince": "mince", "Seafood": "seafood",
        "Milk": "milk", "Yoghurt": "yoghurt", "Cheese": "cheese", "Eggs": "eggs",
        "Butter & Margarine": "butter-margarine", "Long Life-Milk": "long-life-milk",
        "Cream & Custard": "cream-custard", "Breakfast": "breakfast",
        "Jams, Honey & Spreads": "spreads", "Oils & Vinegars": "oils-vinegars", "Sauces": "sauces",
        "Canned Food, Soups & Noodles": "canned-food",
        "Pasta, Rice, Legumes & Grains": "pasta-rice-grains", "Baking": "baking",
        "Herbs & Spices": "herbs-spices", "Ice Cream": "ice-cream",
        "Frozen Chicken, Beef & Pork": "frozen-meat", "Frozen Fish & Seafood": "frozen-seafood",
        "Frozen Fruit": "frozen-fruit", "Frozen Meals": "frozen-meals",
        "Frozen Pizza & Bases": "frozen-pizza", "Frozen Vegetables": "frozen-vegetables",
        "Laundry": "laundry", "Household Cleaning": "household-cleaning", "Dishwashing": "dishwashing",
        "Food Storage": "food-storage", "Air Fresheners & Home Fragrance": "air-fresheners",
        "Bathroom": "bathroom-cleaning", "Pest Control": "pest-control",
        "Toilet Paper, Tissues & Paper Towels": "paper-products",
    },
    "aldi": {
        "Fresh Fruits": "fruit", "Fresh Vegetables": "vegetables", "Fresh Herbs": "herbs",
        "Prepared Vegetables": "prepared-vegetables", "Salads": "salads",
        "Beef": "beef", "Lamb": "lamb", "Pork": "pork", "Poultry": "poultry",
        "Sausage": "sausages-burgers", "Seafood": "seafood",
        "Milk": "milk", "Long Life Milk": "long-life-milk", "Eggs": "eggs", "Cheese": "cheese",
        "Yogurt": "yoghurt", "Creams & Custards": "cream-custard",
        "Butter & Margarine": "butter-margarine", "Baking": "baking", "Canned Food": "canned-food",
        "Cereals & Muesli": "breakfast", "Condiments & Dressings": "condiments-dressings",
        "Crackers & Crisp Breads": "crackers", "Dried Fruits, Nuts & Jerky": "nuts-dried-fruit",
        "Herbs & Spices": "herbs-spices", "Jams & Spreads": "spreads",
        "Iced Tea & Kombucha": "iced-tea-kombucha", "Juices & Cordials": "juice-cordial",
        "Soft Drinks": "soft-drinks", "Sports & Energy": "sports-energy",
        "Tea, Coffee & Hot Chocolate": "tea-coffee", "Water": "water",
        "Air Fresheners & Fragrances": "air-fresheners", "Bathroom": "bathroom-cleaning",
        "Cleaning Home Essentials": "household-cleaning", "Kitchen": "kitchen-cleaning",
        "Laundry": "laundry", "Pest Control": "pest-control",
        "Toilet Paper, Tissues & Paper Towels": "paper-products",
        "Baby Food": "baby-food", "Baby Formula": "baby-formula", "Baby Nappies & Wipes": "nappies-wipes",
    },
    "harrisfarm": {
        "Frdg1-Cheese": "cheese", "Fridge-Yoghurts": "yoghurt", "Frdg2-Eggs": "eggs",
        "Frdg2-Butter": "butter-margarine", "Frdg5-Meat": "beef", "Frdg5-Poultry": "poultry",
        "Frdg5-Seafood": "seafood", "Frdg4-Deli": "deli-meat", "Frdg1-Antipasti": "dips-antipasto",
        "Frdg3-Meals": "chilled-meals", "Grocery-Pasta": "pasta-rice-grains",
        "Grocery-Coffee": "tea-coffee", "Grocery-Tea": "tea-coffee", "Grocery-Spices": "herbs-spices",
        "Grocery-Oils": "oils-vinegars", "Grocery-Spreads": "spreads",
        "Grocery-Can or Jar": "canned-food", "Grocery-Cereal": "breakfast", "Grocery-Baking": "baking",
        "Grocery-Condiments": "condiments-dressings", "Grocery-Biscuits": "biscuits",
        "Grocery-Nuts": "nuts-dried-fruit", "Grocery-Chips": "chips", "Grocery-Confection": "chocolate",
    },
}


# Volume-driven extension to the v2 starter map: the highest-count source strings
# the appendix did not cover. Same rule applies -- only unambiguous mappings.
_EXTRA_SUBCATEGORIES: dict[str, dict[str, str]] = {
    "woolworths": {
        "Hair Care": "hair-care",
        "Skincare & Body": "skincare",
        "Shower, Bath & Body": "personal-care",
        "Cosmetics": "beauty",
        "Oral Care": "oral-care",
        "Deodorant": "personal-care",
        "Shaving & Hair Removal": "personal-care",
        "Feminine Hygiene": "personal-care",
        "Cleaning Goods": "household-cleaning",
        "Kitchen": "kitchen-cleaning",
        "Laundry": "laundry",
        "Bathroom": "bathroom-cleaning",
        "Cleaning": "household-cleaning",
        "Canned Food & Instant Meals": "canned-food",
        "Confectionery": "chocolate",
        "Chocolate": "chocolate",
        "Biscuits & Crackers": "biscuits",
        "Chips & Snacks": "chips",
        "Snacks": "chips",
        "Nuts & Dried Fruit": "nuts-dried-fruit",
        "Condiments": "condiments-dressings",
        "Sauces": "sauces",
        "Spreads": "spreads",
        "Coffee": "tea-coffee",
        "Beer": "beer",
        "Red Wine": "wine",
        "White Wine": "wine",
        "Wine": "wine",
        "Spirits": "spirits",
        "Cider": "cider-rtd",
        "Premix & RTD": "cider-rtd",
        "Sparkling Wine": "wine",
        "Juice": "juice-cordial",
        "Juices": "juice-cordial",
        "Bread": "bread",
        "Bread & Rolls": "bread",
        "Cakes & Desserts": "cakes-desserts",
        "Ready To Eat Meals": "chilled-meals",
        "Dips": "dips-antipasto",
        "Bacon": "ham-bacon-smallgoods",
        "Nappies & Wipes": "nappies-wipes",
        "Baby Food": "baby-food",
        "Baby Formula": "baby-formula",
        "Toilet Paper & Tissues": "paper-products",
    },
    "coles": {
        "Hair Care": "hair-care",
        "Skin Care": "skincare",
        "Cosmetics": "beauty",
        "Oral Care": "oral-care",
        "Vitamins & Supplements": "health",
        "First Aid & Medicinal": "health",
        "Deodorants": "personal-care",
        "Shaving & Hair Removal": "personal-care",
        "Feminine Hygiene": "personal-care",
        "Toiletries": "personal-care",
        "Spirits": "spirits",
        "Red Wine": "wine",
        "White Wine": "wine",
        "Wine": "wine",
        "Beer": "beer",
        "Sparkling Wine": "wine",
        "Cider": "cider-rtd",
        "Premixed Drinks": "cider-rtd",
        "Chocolates": "chocolate",
        "Snacks": "chips",
        "Chips": "chips",
        "Lollies": "lollies",
        "Biscuits": "biscuits",
        "Crackers": "crackers",
        "Nuts & Dried Fruit": "nuts-dried-fruit",
        "Pickled Vegetables & Condiments": "condiments-dressings",
        "Coffee": "tea-coffee",
        "Tea": "tea-coffee",
        "Juice": "juice-cordial",
        "Soft Drinks": "soft-drinks",
        "Water": "water",
        "Cordial": "juice-cordial",
        "Dog & Puppy": "dog",
        "Cat & Kitten": "cat",
        "Ready To Eat Meals": "chilled-meals",
        "Bread": "bread",
        "Bread & Rolls": "bread",
        "Cakes & Desserts": "cakes-desserts",
        "Dips": "dips-antipasto",
        "Bacon": "ham-bacon-smallgoods",
        "Nappies & Wipes": "nappies-wipes",
        "Baby Food": "baby-food",
        "Baby Formula": "baby-formula",
        "Frozen Desserts": "frozen-desserts",
        "Cleaning": "household-cleaning",
    },
    "aldi": {
        "Confectionery": "chocolate",
        "Biscuit & Cookies": "biscuits",
        "Sauces": "sauces",
        "Chips": "chips",
        "Beer": "beer",
        "Wine": "wine",
        "Spirits": "spirits",
        "Bread": "bread",
        "Bread & Rolls": "bread",
        "Hair Care": "hair-care",
        "Skin Care": "skincare",
        "Oral Care": "oral-care",
        "Cheese": "cheese",
        "Frozen Vegetables": "frozen-vegetables",
        "Frozen Meals": "frozen-meals",
        "Ice Cream": "ice-cream",
        "Deli Meats": "deli-meat",
        "Dips": "dips-antipasto",
    },
}

for _store, _m in _EXTRA_SUBCATEGORIES.items():
    SUBCATEGORY_MAP.setdefault(_store, {}).update(_m)

# --- v2 appendix: retailer label -> canonical tag --------------------------------
TAG_MAP: dict[str, dict[str, list[str]]] = {
    "woolworths": {"Organic Meat & Poultry": ["organic"]},
    "coles": {
        "Halal": ["halal"],
        "Kosher Meat & Seafood": ["kosher"],
        "Organic Meat": ["organic"],
        "Gluten Free Range": ["gluten-free"],
        "Vegan Range": ["vegan"],
        "Vegetarian & Vegan": ["vegetarian", "vegan"],
        "Health Foods Sports Nutrition & Diet": [],
    },
    "aldi": {
        "Vegetarian & Vegan": ["vegetarian", "vegan"],
        "Higher Protein Food and Drink": ["high-protein"],
    },
}


# Retailer `dietary` strings ("Vegan", "Halal, Kosher, Vegetarian") are far better
# tag evidence than a merchandising collection name: they are per-product claims made
# by the retailer, not a guess from which aisle something sits in.
DIETARY_TAG_MAP: dict[str, str] = {
    "vegan": "vegan",
    "vegetarian": "vegetarian",
    "halal": "halal",
    "kosher": "kosher",
    "gluten free": "gluten-free",
    "gluten-free": "gluten-free",
    "organic": "organic",
    "certified organic": "organic",
    "lactose free": "lactose-free",
    "dairy free": "lactose-free",
    "high protein": "high-protein",
    "source of protein": "high-protein",
    "good source of protein": "high-protein",
}


def tags_from_dietary(dietary: str | None) -> list[str]:
    """Parse a comma-separated retailer dietary claim into canonical tag ids.

    Only exact claim matches count. Marketing text ("99% Fat Free", "GMO Free")
    has no canonical tag and is ignored rather than forced into one.
    """
    if not dietary:
        return []
    out: list[str] = []
    for part in dietary.replace(";", ",").split(","):
        tag = DIETARY_TAG_MAP.get(part.strip().lower())
        if tag and tag not in out:
            out.append(tag)
    return out


def normalize_category(retailer: str, source_category: str | None) -> str | None:
    if source_category is None:
        return None
    return CATEGORY_MAP.get(retailer.lower().strip(), {}).get(source_category.strip())


def normalize_subcategory(retailer: str, source_subcategory: str | None) -> str | None:
    if source_subcategory is None:
        return None
    return SUBCATEGORY_MAP.get(retailer.lower().strip(), {}).get(source_subcategory.strip())


def normalize_tags(retailer: str, *source_labels: str | None) -> list[str]:
    """Tags only from labels that unambiguously describe an attribute (v2 taxonomy rule)."""
    table = TAG_MAP.get(retailer.lower().strip(), {})
    out: list[str] = []
    for label in source_labels:
        if not label:
            continue
        for tag in table.get(label.strip(), []):
            if tag not in out:
                out.append(tag)
    return out


def subcategory_name(sub_id: str) -> str:
    return SUBCATEGORY_NAME.get(sub_id) or sub_id.replace("-", " ").title()


# --- size parsing ---------------------------------------------------------------
# Canonical units: g, ml, pk, ea. Everything scales into one of those so 1kg and
# 1000g compare equal, which is what makes cross-retailer matching work.
_SIZE_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*(kg|g|mg|l|ml|litre|liters?|litres?|pk|pack|pieces?|pce|ea|each|dozen|doz)\b",
    re.I,
)
_MULTI_RE = re.compile(r"(\d+)\s*[x*]\s*(\d+(?:\.\d+)?)\s*(kg|g|l|ml)\b", re.I)
_UNIT_SCALE = {
    "kg": (1000.0, "g"), "g": (1.0, "g"), "mg": (0.001, "g"),
    "l": (1000.0, "ml"), "litre": (1000.0, "ml"), "litres": (1000.0, "ml"),
    "liter": (1000.0, "ml"), "liters": (1000.0, "ml"), "ml": (1.0, "ml"),
    "pk": (1.0, "pk"), "pack": (1.0, "pk"), "piece": (1.0, "pk"), "pieces": (1.0, "pk"),
    "pce": (1.0, "pk"), "dozen": (12.0, "pk"), "doz": (12.0, "pk"),
    "ea": (1.0, "ea"), "each": (1.0, "ea"),
}


def parse_size(size: str | None, name: str | None = None) -> tuple[float | None, str | None]:
    """('2L', ...) -> (2000.0, 'ml').  '6 x 375ml' -> (2250.0, 'ml').  Falls back to the name."""
    for text in (size, name):
        if not text:
            continue
        m = _MULTI_RE.search(text)
        if m:
            count, value, unit = int(m.group(1)), float(m.group(2)), m.group(3).lower()
            scale, canon = _UNIT_SCALE[unit]
            return round(count * value * scale, 3), canon
        m = _SIZE_RE.search(text)
        if m:
            value, unit = float(m.group(1)), m.group(2).lower()
            scale, canon = _UNIT_SCALE[unit]
            return round(value * scale, 3), canon
    return None, None


# --- name normalisation + slugs --------------------------------------------------
# Shared with build_master.py's cross-store linking so both use one definition.
_brandnoise = re.compile(r"\b(coles|woolworths|ww|the|by|brand|select|essentials|homebrand|macro)\b")
_unitnorm = re.compile(r"(\d+(?:\.\d+)?)\s*(kg|g|l|ml|pk|pack|ea|each)\b")
_punct = re.compile(r"[^a-z0-9 ]+")
_ws = re.compile(r"\s+")


def norm_name(name: str, size: str) -> str:
    """Normalised match key: lowercase, brand noise stripped, units scaled to g/ml/pk."""
    s = f"{name} {size}".lower()

    def conv(m: re.Match) -> str:
        v, u = float(m.group(1)), m.group(2)
        if u == "kg":
            return f"{v * 1000:g}g"
        if u == "l":
            return f"{v * 1000:g}ml"
        if u in ("pack", "ea", "each"):
            return f"{v:g}pk"
        return f"{v:g}{u}"

    s = _unitnorm.sub(conv, s)
    s = _brandnoise.sub(" ", s)
    s = _punct.sub(" ", s)
    return _ws.sub(" ", s).strip()


_slug_strip = re.compile(r"[^a-z0-9]+")


def slugify(text: str, maxlen: int = 60) -> str:
    s = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    s = _slug_strip.sub("-", s.lower()).strip("-")
    if len(s) > maxlen:
        s = s[:maxlen].rsplit("-", 1)[0]
    return s or "item"
