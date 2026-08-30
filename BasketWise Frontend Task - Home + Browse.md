# BasketWise Frontend Task

**Assigned:** Wednesday 26 August  
**Due:** Friday 28 August, 6pm  
**Buffer:** Early Saturday 29 August only if something unexpected comes up

## Goal

Build the **Home Page** and **Browse Page** for BasketWise.

For this task, focus on:

1. Getting the layout correct
2. Breaking the UI into reusable React components
3. Displaying grocery items using mock data
4. Making category filtering work
5. Making a basic shared basket work between Home and Browse
6. Making navigation between pages work

You **do not need to build the backend, database, authentication, comparison algorithm, receipt scanning, or real API integration yet.**

For now:

```text
React
↓
Mock product data
↓
Home / Browse
↓
Shared basket
```

After Friday, we will replace the mock product data with real backend API responses.

---

# Priority

## Priority 1, must finish by Friday 28 August, 6pm

- Navbar
- Hero
- Everyday Essentials section
- Reusable `ProductCard`
- Browse page
- Category sidebar
- Product grid
- Category filtering
- Basic shared basket
- Add products from Home and Browse
- Navigation between Home and Browse
- FAQ
- Footer
- Desktop layout working
- Basic mobile layout not breaking

## Important

**Do not start Priority 2 until all Priority 1 work is working.**

## Priority 2, only if Priority 1 is finished

- Search bar actually filters products
- Better cart UI
- FAQ accordion
- More polished responsive behaviour
- Hover/animation polish

## Do not work on yet

- Compare page
- Sign-in functionality
- Authentication
- User/My List page
- Backend API integration
- Database
- Receipt upload
- Real supermarket price comparison
- Real scraping

We will handle these separately after this task.

---

# 1. Mock Product Data

For Friday, create:

```text
src/data/products.ts
```

This file temporarily replaces the backend.

Home and Browse should **both use the same product data** from this file.

Do not hardcode separate grocery lists inside `HomePage.tsx` and `BrowsePage.tsx`.

## Product type

Use something similar to:

```ts
export type Product = {
  id: string
  name: string
  size: string
  category: string
  image: string
}
```

Example:

```ts
export const products: Product[] = [
  {
    id: "milk-full-cream-2l",
    name: "Full Cream Milk",
    size: "2L",
    category: "Dairy",
    image: "/images/milk.webp",
  },
  {
    id: "white-bread",
    name: "White Bread",
    size: "700g",
    category: "Bakery",
    image: "/images/white-bread.webp",
  },
  {
    id: "broccoli",
    name: "Broccoli",
    size: "1 each",
    category: "Vegetables",
    image: "/images/broccoli.webp",
  },
  {
    id: "carrots-1kg",
    name: "Carrots",
    size: "1kg",
    category: "Vegetables",
    image: "/images/carrots.webp",
  },
]
```

Aim for around **15 to 20 mock products**.

Use categories such as:

```text
Dairy
Bakery
Fruit
Vegetables
Meat
Pantry
```

For example:

```text
Dairy
- Full Cream Milk
- Greek Yoghurt
- Cheddar Cheese

Bakery
- White Bread
- Wholemeal Bread

Fruit
- Bananas
- Apples

Vegetables
- Broccoli
- Carrots
- Potatoes

Meat
- Chicken Breast
- Beef Mince

Pantry
- Rice
- Pasta
- Tomato Sauce
```

## Important

The idea is:

```text
products.ts
    │
    ├── Home Page → selects Essentials
    │
    └── Browse Page → filters by category
```

Later, Kushi/backend work will return this same type of data through API endpoints.

For example:

```text
GET /products
GET /products?category=Vegetables
GET /products?q=milk
```

For Friday, **do not make these API requests yet**.

---

# 2. Home Page

Route:

```text
/
```

The Home Page should contain:

```text
Navbar
↓
Hero
↓
Everyday Essentials
↓
FAQ
↓
Footer
```

---

# 2.1 Navbar

Layout:

```text
LOGO | Search groceries... | Browse | Sign in | Cart
```

Include:

- BasketWise logo/name
- Search bar
- Browse link/button
- Sign In link/button
- Cart

## Behaviour

### Logo

Clicking the logo should navigate to:

```text
/
```

### Browse

Clicking Browse should navigate to:

```text
/browse
```

### Search

**Priority 1**

The search bar only needs to display correctly.

**Priority 2**

Typing:

```text
milk
```

should show/filter matching products.

Do not work on this until Priority 1 is complete.

### Sign In

No authentication required.

It can:

- navigate to `/signin`, or
- remain as a visual placeholder

### Cart

The navbar should show:

```text
Cart (0)
```

When products are added:

```text
Cart (1)
Cart (2)
Cart (3)
```

This cart count needs to be shared between Home and Browse.

---

# 2.2 Hero

Use the existing BasketWise design direction.

Rough structure:

```text
┌────────────────────┬────────────────────┐
│                    │                    │
│     HERO IMAGE     │   HERO MESSAGE     │
│                    │                    │
│                    │   Short text       │
│                    │                    │
│                    │                    │
└────────────────────┴────────────────────┘
```

Required:

- hero image
- main heading
- short supporting message
- layout matching the BasketWise design

Do not build receipt upload yet.

---

# 2.3 Everyday Essentials

Heading:

```text
Everyday essentials
```

Optional supporting text:

```text
Quickly add the groceries you buy most often.
```

Show common groceries in a visual grid.

Examples:

1. Full Cream Milk, 2L
2. White Bread
3. Eggs, 12 pack
4. Bananas
5. Chicken Breast
6. Rice
7. Pasta
8. Greek Yoghurt

Use Woolworths/Coles product cards as general visual inspiration.

Each card should roughly contain:

```text
┌─────────────────┐
│                 │
│     IMAGE       │
│                 │
│ Full Cream Milk │
│ 2L              │
│             [+] │
└─────────────────┘
```

---

# 2.4 ProductCard

Create **one reusable component**:

```text
ProductCard
```

Do not manually create a separate card for Milk, Bread, Eggs, etc.

The component needs:

- image
- product name
- size
- Add button

For example:

```tsx
<ProductCard
  product={product}
/>
```

or:

```tsx
<ProductCard
  name="Full Cream Milk"
  size="2L"
  image="/images/milk.webp"
/>
```

Prefer passing the complete `Product` object if that fits the existing code.

The same `ProductCard` should be reusable on:

- Home
- Browse
- Search later

---

# 2.5 Basic Basket, Priority 1

For Friday, the basket only needs basic temporary frontend functionality.

When the user clicks:

```text
+
```

on Milk:

```text
Cart (0)
↓
Cart (1)
```

If they then add Broccoli:

```text
Cart (1)
↓
Cart (2)
```

The important requirement is:

> **Home and Browse must use the same basket.**

For example:

```text
Home
↓
Add Milk
↓
Cart (1)
↓
Go to Browse
↓
Add Broccoli
↓
Cart (2)
↓
Go back Home
↓
Cart should still be (2)
```

You do not need:

- backend basket storage
- database persistence
- user accounts
- basket saving after browser refresh
- supermarket prices
- comparison calculations

If the basket implementation becomes complicated, ask Jason before spending a large amount of time restructuring it.

---

# 2.6 FAQ

Create a simple FAQ section.

Questions:

## What is BasketWise?

BasketWise helps users compare grocery prices across supermarkets and find a cheaper way to shop.

## Why use BasketWise?

Our goal is to help Australians save money on everyday groceries by making supermarket price comparisons simple.

## Where do the prices come from?

For the MVP, BasketWise uses grocery product and pricing data collected from supported supermarkets.

### Priority 1

Display the questions and answers.

### Priority 2

Make them expandable/collapsible.

---

# 2.7 Footer

Keep the footer simple.

Example:

```text
BasketWise

Browse
FAQ

© 2026 BasketWise
```

Do not spend much time on the footer.

---

# 3. Browse Page

**High priority**

Route:

```text
/browse
```

Structure:

```text
Navbar

┌──────────────────┬──────────────────────────────────┐
│                  │                                  │
│ Categories       │ Products                         │
│                  │                                  │
│ All              │ [Product] [Product] [Product]   │
│ Dairy            │                                  │
│ Bakery           │ [Product] [Product] [Product]   │
│ Fruit            │                                  │
│ Vegetables       │                                  │
│ Meat             │                                  │
│ Pantry           │                                  │
│                  │                                  │
└──────────────────┴──────────────────────────────────┘
```

Use Instacart's category/product layout as visual inspiration, but keep BasketWise's styling.

---

# 3.1 CategorySidebar

Create a reusable component:

```text
CategorySidebar
```

Categories:

```text
All
Dairy
Bakery
Fruit
Vegetables
Meat
Pantry
```

The currently selected category should look visually different.

For example:

```text
All
Dairy
Bakery
Fruit
> Vegetables
Meat
Pantry
```

---

# 3.2 Exactly What Happens When a Category Is Clicked

For Friday, this is **frontend-only using mock data**.

There is no backend request yet.

Example:

User starts on:

```text
All
```

The page displays:

```text
Milk
Bread
Bananas
Broccoli
Carrots
Chicken Breast
Rice
Pasta
...
```

Then the user clicks:

```text
Vegetables
```

Your React state should change to something like:

```ts
selectedCategory = "Vegetables"
```

Then filter the mock products:

```ts
const visibleProducts =
  selectedCategory === "All"
    ? products
    : products.filter(
        (product) => product.category === selectedCategory
      )
```

Now the screen should only show:

```text
Broccoli
Carrots
Potatoes
```

When the user clicks:

```text
All
```

show every product again.

The user experience is:

```text
Click Vegetables
↓
selectedCategory changes
↓
filter products.ts
↓
render vegetable ProductCards
```

## Do not make this request yet

```text
GET /products?category=Vegetables
```

After Friday, we can replace the local filtering with that backend request.

The UI should not need to be redesigned when that happens.

---

# 3.3 Product Grid

The right side of the Browse page displays the filtered products.

Reuse:

```text
ProductCard
```

Do not make a completely separate product-card implementation for Browse unless there is a strong design reason.

Example:

```text
Dairy

[ Milk ] [ Yoghurt ] [ Cheese ]
```

If the user clicks:

```text
Dairy
```

only Dairy products should appear.

If the user clicks:

```text
Vegetables
```

only Vegetable products should appear.

---

# 3.4 Add Products From Browse

Each Browse ProductCard should have:

```text
+
```

Clicking it adds that product to the **same shared basket used by Home**.

Example:

```text
Home
↓
Add Milk
↓
Cart (1)

Browse
↓
Vegetables
↓
Add Broccoli
↓
Cart (2)
```

This is Priority 1.

---

# 4. Suggested Component Structure

Try to structure the work roughly like:

```text
src/
├── components/
│   ├── Navbar.tsx
│   ├── ProductCard.tsx
│   ├── CategorySidebar.tsx
│   ├── FAQ.tsx
│   └── Footer.tsx
│
├── pages/
│   ├── HomePage.tsx
│   └── BrowsePage.tsx
│
├── data/
│   └── products.ts
│
└── ...
```

If the existing project already has a different folder structure, follow the existing structure.

Do not restructure the whole repository just to match this example.

---

# 5. Recommended Development Order

Do not try to build everything at once.

## Step 1

Get the Home Page displaying:

```text
Navbar
+
Hero
```

## Step 2

Build one reusable:

```text
ProductCard
```

Make sure it can display a product from `products.ts`.

## Step 3

Use `ProductCard` to build Everyday Essentials.

## Step 4

Create:

```text
/browse
```

Make Navbar → Browse navigation work.

## Step 5

Build:

```text
CategorySidebar
```

## Step 6

Display all mock products on Browse.

## Step 7

Implement category filtering.

Test:

```text
All
↓
Vegetables
↓
Dairy
↓
All
```

## Step 8

Implement basic shared basket state.

Test:

```text
Add Milk from Home
↓
go to Browse
↓
Add Broccoli
↓
Cart count = 2
↓
go back Home
↓
Cart count still = 2
```

## Step 9

Add FAQ + Footer.

## Step 10

Check desktop/mobile layout.

## Step 11

Only after everything above works, start Priority 2.

---

# 6. Checkpoints

## Thursday 27 August, 6pm

Please have:

### Home

- Navbar working
- Hero mostly built
- reusable `ProductCard` working
- Essentials grid rendering products from `products.ts`

### Browse

- `/browse` route created
- CategorySidebar visible
- ProductGrid started

### Basket

- Add button visible
- basket work at least started

This does not need to be polished yet.

If you are blocked, message us before the checkpoint rather than waiting until Friday.

---

## Friday 28 August, 6pm

**Main deadline**

### Home

- Navbar
- Hero
- Everyday Essentials
- reusable ProductCard
- Add to Basket working
- FAQ
- Footer

### Browse

- CategorySidebar
- ProductGrid
- category filtering
- Add to Basket working
- same basket as Home
- navigation between Home and Browse

### Code

- reusable components
- mock product data stored separately
- Home and Browse use the same `products.ts`
- no duplicated hardcoded grocery lists
- no obvious TypeScript errors
- app builds/runs
- desktop works
- basic mobile layout does not visibly break

Open a PR for review by **Friday 6pm**.

---

# 7. Definition of Done

By Friday 6pm, this exact flow should work:

```text
Open BasketWise
↓
See Home Page
↓
See Everyday Essentials
↓
Click + on Full Cream Milk
↓
Cart changes from Cart (0) to Cart (1)
↓
Click Browse in Navbar
↓
Browse Page opens
↓
See category sidebar
↓
See all products
↓
Click Vegetables
↓
Only vegetable products appear
↓
Click + on Broccoli
↓
Cart changes from Cart (1) to Cart (2)
↓
Navigate back Home
↓
Basket still contains Milk + Broccoli
```

If this works, Priority 1 is complete.

---

# 8. Priority 2, Only If Everything Above Works

## Search

User types:

```text
milk
```

Then:

```text
Milk appears
↓
Click +
↓
Milk is added to the same basket
```

For now, search can simply filter the local `products.ts` data.

Later, it will become:

```text
GET /products?q=milk
```

## Other Priority 2 work

- better responsive design
- FAQ accordion
- hover states
- small animations
- improved cart display

Do not start these until Priority 1 is working.

---

# 9. What Happens After Friday

Do **not** start this section before the Friday deliverable is complete.

On Saturday:

1. We give Kushi/backend work the final `Product` data shape.
2. Backend can create endpoints such as:

```text
GET /categories
GET /products
GET /products?category=Vegetables
GET /products?q=milk
```

3. We replace local mock-data access with backend API responses.
4. We keep the same:
   - ProductCard
   - Browse layout
   - category UI
   - basket behaviour
5. We start the Compare Page as the next major feature.

The development progression should be:

```text
NOW
React + mock data + Home + Browse + Basket
↓
FRIDAY
Working frontend flow
↓
SATURDAY
Replace mock data with backend API
↓
NEXT
Compare Page
```

That is enough for this task.