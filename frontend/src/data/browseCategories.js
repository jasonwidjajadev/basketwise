// BasketWise approved category taxonomy — mirrors the shape the real
// `GET /categories` endpoint will return (see browsing_page_guide.md §2-3).
// `id` is what the frontend sends to the backend; `name` is what the user sees.

function slugify(label) {
  return label
    .toLowerCase()
    .replace(/[,&]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const TAXONOMY = [
  ['Fruit & Vegetables', ['Fruit', 'Vegetables', 'Herbs & Sprouts', 'Salads', 'Prepared Vegetables', 'Flowers']],
  [
    'Meat & Seafood',
    ['Beef', 'Poultry', 'Lamb', 'Pork', 'Mince', 'Sausages & Burgers', 'Ham', 'Seafood', 'Roasts & Slow Cooked', 'Game'],
  ],
  [
    'Deli & Chilled',
    [
      'Deli Meats',
      'Ham, Bacon & Smallgoods',
      'Sausages & Frankfurts',
      'Antipasto',
      'Dips & Spreads',
      'Gourmet Cheese',
      'Platters',
      'Ready to Eat',
    ],
  ],
  [
    'Dairy, Eggs & Fridge',
    [
      'Milk',
      'Long Life Milk',
      'Eggs',
      'Cheese',
      'Yoghurt',
      'Butter & Margarine',
      'Cream & Custard',
      'Dairy Desserts',
      'Chilled Juice',
      'Fresh Pasta & Sauces',
      'Ready Meals',
    ],
  ],
  [
    'Bakery',
    [
      'Bread',
      'Rolls & Buns',
      'Wraps & Flatbreads',
      'Pizza Bases',
      'Cakes & Sweet Treats',
      'Breakfast Bakery',
      'Savoury Bakery',
      'Bake at Home',
    ],
  ],
  [
    'Pantry',
    [
      'Breakfast',
      'Coffee',
      'Tea',
      'Jams, Honey & Spreads',
      'Oils & Vinegars',
      'Sauces',
      'Canned Food',
      'Soups & Noodles',
      'Pasta, Rice & Grains',
      'Baking',
      'Herbs & Spices',
      'Stocks & Gravy',
      'Condiments',
      'Desserts',
      'Nuts & Dried Fruit',
    ],
  ],
  ['Snacks & Confectionery', ['Chips', 'Chocolate', 'Lollies', 'Biscuits', 'Crackers', 'Snack Bars', 'Nuts & Snacks']],
  [
    'Frozen',
    [
      'Frozen Vegetables',
      'Frozen Fruit',
      'Frozen Meat',
      'Frozen Seafood',
      'Frozen Meals',
      'Frozen Pizza',
      'Frozen Chips & Wedges',
      'Frozen Party Food',
      'Ice Cream',
      'Frozen Desserts',
    ],
  ],
  [
    'Drinks',
    [
      'Water',
      'Soft Drinks',
      'Juice & Cordial',
      'Sports & Energy',
      'Iced Tea & Kombucha',
      'Flavoured Milk',
      'Coffee Drinks',
      'Tea & Coffee',
      'Non-Alcoholic Drinks',
    ],
  ],
  [
    'Cleaning & Household',
    [
      'Laundry',
      'Household Cleaning',
      'Dishwashing',
      'Kitchen Cleaning',
      'Bathroom Cleaning',
      'Paper Products',
      'Food Storage',
      'Air Fresheners',
      'Brooms & Mops',
      'Pest Control',
    ],
  ],
  [
    'Health & Beauty',
    [
      'Vitamins & Supplements',
      'Sports Nutrition',
      'First Aid & Medicinal',
      'Dental Care',
      'Hair Care',
      'Skin Care',
      'Cosmetics',
      'Personal Care',
      'Shower & Bath',
      'Deodorant',
      'Shaving & Hair Removal',
      'Period & Continence Care',
      'Sun Protection',
    ],
  ],
  [
    'Baby',
    ['Baby Food', 'Baby Formula', 'Nappies & Wipes', 'Bottles & Feeding', 'Bath & Skincare', 'Baby Medicinal', 'Dummies & Teethers', 'Baby Clothing'],
  ],
  ['Pet', ['Cat', 'Dog', 'Birds', 'Fish', 'Small Pets']],
  ['Liquor', ['Beer', 'Wine', 'Spirits', 'Premixed Drinks']],
  [
    'Home & Garden',
    [
      'Kitchenware & Storage',
      'Dining & Entertaining',
      'Home Decor',
      'Bedding',
      'Bathroom',
      'Outdoor Living',
      'Party Supplies',
      'Stationery',
      'Reusable Bags',
    ],
  ],
  ['Electronics', ['Small Appliances', 'Electronics & Accessories']],
  ['Tobacco', ['Tobacco']],
]

export const BROWSE_CATEGORIES = TAXONOMY.map(([name, subs]) => ({
  id: slugify(name),
  name,
  subcategories: subs.map((sub) => ({ id: slugify(sub), name: sub })),
}))
