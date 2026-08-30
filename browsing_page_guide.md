# BasketWise Browse Page Contract

## 1. MVP Scope

For the MVP, the Browse page only needs:

* categories
* subcategories
* product cards
* current Woolworths / Coles / ALDI prices
* add products to the shared basket
* pagination / load more

Do **not** implement these until the core Browse flow works:

* search
* retailer-only filtering
* price sorting
* recommended sorting
* biggest saving
* tags / dietary filters
* specials filtering

---

# 2. Source of Truth

The frontend should **not hardcode Woolworths, Coles, or ALDI category names**.

Use:

```http
GET /categories
```

The backend returns the approved BasketWise categories and subcategories.

Example:

```json
[
  {
    "id": "fruit-vegetables",
    "name": "Fruit & Vegetables",
    "subcategories": [
      {
        "id": "fruit",
        "name": "Fruit"
      },
      {
        "id": "vegetables",
        "name": "Vegetables"
      }
    ]
  }
]
```

Frontend rule:

* `name` = what the user sees
* `id` = what the frontend sends to the backend

Example:

```text
User sees:

Fruit & Vegetables
└── Vegetables

Frontend sends:

GET /products?category=fruit-vegetables&subcategory=vegetables
```

---

# 3. Frontend Taxonomy

This is the approved BasketWise taxonomy that `GET /categories` should return.

## Fruit & Vegetables

* Fruit
* Vegetables
* Herbs & Sprouts
* Salads
* Prepared Vegetables
* Flowers

## Meat & Seafood

* Beef
* Poultry
* Lamb
* Pork
* Mince
* Sausages & Burgers
* Ham
* Seafood
* Roasts & Slow Cooked
* Game

## Deli & Chilled

* Deli Meats
* Ham, Bacon & Smallgoods
* Sausages & Frankfurts
* Antipasto
* Dips & Spreads
* Gourmet Cheese
* Platters
* Ready to Eat

## Dairy, Eggs & Fridge

* Milk
* Long Life Milk
* Eggs
* Cheese
* Yoghurt
* Butter & Margarine
* Cream & Custard
* Dairy Desserts
* Chilled Juice
* Fresh Pasta & Sauces
* Ready Meals

## Bakery

* Bread
* Rolls & Buns
* Wraps & Flatbreads
* Pizza Bases
* Cakes & Sweet Treats
* Breakfast Bakery
* Savoury Bakery
* Bake at Home

## Pantry

* Breakfast
* Coffee
* Tea
* Jams, Honey & Spreads
* Oils & Vinegars
* Sauces
* Canned Food
* Soups & Noodles
* Pasta, Rice & Grains
* Baking
* Herbs & Spices
* Stocks & Gravy
* Condiments
* Desserts
* Nuts & Dried Fruit

## Snacks & Confectionery

* Chips
* Chocolate
* Lollies
* Biscuits
* Crackers
* Snack Bars
* Nuts & Snacks

## Frozen

* Frozen Vegetables
* Frozen Fruit
* Frozen Meat
* Frozen Seafood
* Frozen Meals
* Frozen Pizza
* Frozen Chips & Wedges
* Frozen Party Food
* Ice Cream
* Frozen Desserts

## Drinks

* Water
* Soft Drinks
* Juice & Cordial
* Sports & Energy
* Iced Tea & Kombucha
* Flavoured Milk
* Coffee Drinks
* Tea & Coffee
* Non-Alcoholic Drinks

## Cleaning & Household

* Laundry
* Household Cleaning
* Dishwashing
* Kitchen Cleaning
* Bathroom Cleaning
* Paper Products
* Food Storage
* Air Fresheners
* Brooms & Mops
* Pest Control

## Health & Beauty

* Vitamins & Supplements
* Sports Nutrition
* First Aid & Medicinal
* Dental Care
* Hair Care
* Skin Care
* Cosmetics
* Personal Care
* Shower & Bath
* Deodorant
* Shaving & Hair Removal
* Period & Continence Care
* Sun Protection

## Baby

* Baby Food
* Baby Formula
* Nappies & Wipes
* Bottles & Feeding
* Bath & Skincare
* Baby Medicinal
* Dummies & Teethers
* Baby Clothing

## Pet

* Cat
* Dog
* Birds
* Fish
* Small Pets

## Liquor

* Beer
* Wine
* Spirits
* Premixed Drinks

## Home & Garden

* Kitchenware & Storage
* Dining & Entertaining
* Home Decor
* Bedding
* Bathroom
* Outdoor Living
* Party Supplies
* Stationery
* Reusable Bags

## Electronics

* Small Appliances
* Electronics & Accessories

## Tobacco

* Tobacco

---

# 4. Load Categories

When Browse opens:

```http
GET /categories
```

Use the response to render the category list.

When a category is clicked:

1. Make the category active
2. Expand its subcategories
3. Fetch products belonging to that category

Example:

```text
User clicks:

Dairy, Eggs & Fridge
```

Frontend calls:

```http
GET /products?category=dairy-eggs-fridge&limit=24&offset=0
```

---

# 5. Load Products

When Browse first opens:

```http
GET /products?limit=24&offset=0
```

Render the returned products.

Do **not** request the entire catalogue at once.

---

# 6. Click Subcategory

Example:

```text
Dairy, Eggs & Fridge
└── Milk
```

Frontend calls:

```http
GET /products?category=dairy-eggs-fridge&subcategory=milk&limit=24&offset=0
```

Only Milk products should be shown.

---

# 7. ProductCard Data

`GET /products` should return the canonical product and its current retailer offers together.

Example:

```json
{
  "id": "product-uuid",
  "name": "Full Cream Milk",
  "category": "dairy-eggs-fridge",
  "subcategory": "milk",
  "size_value": 2,
  "size_unit": "L",
  "image_url": "...",
  "offers": [
    {
      "retailer": "woolworths",
      "price": 3.10
    },
    {
      "retailer": "coles",
      "price": 3.20
    },
    {
      "retailer": "aldi",
      "price": 2.89
    }
  ]
}
```

The frontend should **not make a separate API request for every ProductCard price**.

The one `/products` response should contain everything required to display the ProductCard.

Example ProductCard information:

```text
Full Cream Milk
2L

ALDI         $2.89
Woolworths   $3.10
Coles        $3.20

[ Add ]
```

---

# 8. Add to Basket

When the user clicks:

```text
Add
```

add the canonical product to the shared React basket.

Basket item:

```ts
{
  product_id: product.id,
  quantity: 1
}
```

Do not add:

* Woolworths product ID
* Coles product ID
* ALDI product ID
* offer ID

The basket stores the canonical BasketWise `product_id`.

Example:

```text
Browse Milk
↓
Click Add
↓
{
  product_id: "product-uuid",
  quantity: 1
}
↓
Shared basket
```

---

# 9. Pagination / Load More

Initial request:

```http
GET /products?limit=24&offset=0
```

Next 24:

```http
GET /products?limit=24&offset=24
```

For a selected category:

```http
GET /products?category=fruit-vegetables&limit=24&offset=24
```

For a selected subcategory:

```http
GET /products?category=fruit-vegetables&subcategory=vegetables&limit=24&offset=24
```

The UI can later use:

* Load More
* pagination
* infinite scroll

The API behaviour stays the same.

---

# 10. MVP `GET /products` Parameters

For the MVP, only use:

```text
category
subcategory
limit
offset
```

Examples:

```http
GET /products?limit=24&offset=0
```

```http
GET /products?category=fruit-vegetables&limit=24&offset=0
```

```http
GET /products?category=fruit-vegetables&subcategory=vegetables&limit=24&offset=0
```

---

# Definition of Done

For the MVP, a user should be able to:

```text
Open Browse
↓
See categories from GET /categories
↓
Click Dairy, Eggs & Fridge
↓
See its subcategories
↓
Click Milk
↓
See Milk products
↓
See Woolworths / Coles / ALDI prices on each ProductCard
↓
Click Add
↓
Product is added to the shared basket
```

---

# Extensions, Not MVP

Do not implement anything below until the core Browse flow works.

## 1. Search

Future behaviour:

```http
GET /products?q=milk&limit=24&offset=0
```

Can later combine with category:

```http
GET /products?category=dairy-eggs-fridge&q=milk&limit=24&offset=0
```

Future query parameter:

```text
q
```

---

## 2. Retailer Filter

Future options:

```text
All
Woolworths
Coles
ALDI
```

Example:

```http
GET /products?category=dairy-eggs-fridge&subcategory=milk&retailer=woolworths&limit=24&offset=0
```

When Woolworths is selected:

* return products available from Woolworths
* display the relevant Woolworths offer

Future query parameter:

```text
retailer
```

---

## 3. Price Sorting

Future options:

```text
Price Low → High
Price High → Low
```

Possible API:

```http
GET /products?sort=price_asc&limit=24&offset=0
```

```http
GET /products?sort=price_desc&limit=24&offset=0
```

If no retailer is selected:

* sort using the cheapest current retailer offer for each product

If a retailer is selected:

* sort using that retailer's price

Future query parameter:

```text
sort
```

---

## 4. Recommended Sorting

Future option:

```text
Recommended
```

Do not implement until the BasketWise ranking formula is defined.

It could eventually consider:

* current price
* availability
* historical pricing
* specials
* user preferences
* convenience

Possible future API:

```http
GET /products?sort=recommended
```

---

## 5. Biggest Saving

Future option:

```text
Biggest Saving
```

The saving calculation must be defined before implementation.

Possible definitions:

* current price vs `was_price`
* current price vs 30-day average
* cheapest retailer vs most expensive retailer

Possible future API:

```http
GET /products?sort=biggest_saving
```

---

## 6. Tags / Dietary Filters

Future filters:

* Organic
* Halal
* Kosher
* Vegan
* Vegetarian
* Gluten Free
* High Protein
* Lactose Free

These are product tags, not categories or subcategories.

Possible future API:

```http
GET /products?tag=lactose-free
```

---

## 7. Specials

`Specials` is not a normal category.

A product keeps its normal taxonomy:

```text
Dairy, Eggs & Fridge
└── Milk
```

The retailer offer separately contains:

```text
is_special = true
```

Possible future filter:

```http
GET /products?special=true
```

---

## 8. Other Future Filters

Possible later additions:

* brand
* pack size
* availability
* unit price
