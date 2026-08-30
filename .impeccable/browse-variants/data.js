// BasketWise — shared mock catalog for the 3 Browse page variants.
// Category list matches the confirmed unified taxonomy (Coles + Woolworths only).
const CATEGORIES = [
  "Fruit & Veg","Meat, Poultry & Seafood","Deli","Dairy, Eggs & Fridge","Bakery","Pantry",
  "International & Dietary Foods","Snacks & Confectionery","Lunch Box","Frozen","Drinks",
  "Beer, Wine & Spirits","Health & Beauty","Baby","Cleaning & Household","Pet","Home & Lifestyle"
];

// Subcategories are directional — modelled on Coles/Woolworths' own aisle breakdowns,
// not yet confirmed against real BasketWise data. Only the 5 categories with mock
// products below have subcategory-tagged items; the rest exist so category nav reads
// complete even though selecting them still lands on the empty state.
const SUBCATEGORIES = {
  "Fruit & Veg": ["Fresh Fruit", "Fresh Vegetables", "Herbs & Salad"],
  "Meat, Poultry & Seafood": ["Beef & Lamb", "Chicken", "Seafood", "Bacon & Deli Meats"],
  "Deli": ["Sliced Meats", "Cheese Counter", "Antipasto", "Ready Meals"],
  "Dairy, Eggs & Fridge": ["Milk", "Cheese", "Eggs", "Butter & Spreads", "Yoghurt"],
  "Bakery": ["Bread & Rolls", "Bake At Home", "Chilled Cakes & Desserts", "Instore Bakery Savoury Treats"],
  "Pantry": ["Rice & Grains", "Pasta & Sauce", "Oils & Vinegars", "Breakfast & Spreads", "Canned Goods"],
  "International & Dietary Foods": ["Asian", "Mexican & Italian", "Gluten Free", "Vegan & Plant-Based"],
  "Snacks & Confectionery": ["Chips & Crisps", "Chocolate", "Lollies", "Biscuits", "Nuts & Bars"],
  "Lunch Box": ["Muesli Bars", "Fruit Snacks", "Small Packs", "Drink Poppers"],
  "Frozen": ["Frozen Vegetables", "Frozen Meals", "Ice Cream & Desserts", "Frozen Meat & Seafood"],
  "Drinks": ["Soft Drinks", "Water", "Juice", "Coffee & Tea", "Energy & Sports"],
  "Beer, Wine & Spirits": ["Beer", "Red Wine", "White Wine", "Spirits"],
  "Health & Beauty": ["Skin Care", "Hair Care", "Oral Care", "Vitamins"],
  "Baby": ["Nappies", "Baby Food", "Formula", "Baby Care"],
  "Cleaning & Household": ["Laundry", "Dish Care", "Surface Cleaners", "Paper Products"],
  "Pet": ["Dog", "Cat", "Pet Treats", "Pet Accessories"],
  "Home & Lifestyle": ["Kitchenware", "Storage", "Stationery", "Seasonal"],
};

const PRODUCTS = {
  "Fruit & Veg": [
    { name:"Bananas", unit:"per kg", shot:"BANANAS — LOOSE", sub:"Fresh Fruit", coles:3.90, woolworths:4.20 },
    { name:"Cavendish avocado", unit:"each", shot:"AVOCADO — SINGLE", sub:"Fresh Fruit", coles:1.80, woolworths:1.80 },
    { name:"Royal Gala apples", unit:"per kg", shot:"APPLES — GALA", sub:"Fresh Fruit", coles:4.50, woolworths:4.90 },
    { name:"Roma tomatoes", unit:"per kg", shot:"TOMATOES — VINE", sub:"Fresh Vegetables", coles:5.90, woolworths:5.50 },
    { name:"Carrots", unit:"1kg bag", shot:"CARROTS — LOOSE", sub:"Fresh Vegetables", coles:2.10, woolworths:2.30 },
    { name:"Brown onions", unit:"1kg bag", shot:"ONIONS — BROWN", sub:"Fresh Vegetables", coles:2.90, woolworths:null },
    { name:"Lebanese cucumber", unit:"each", shot:"CUCUMBER — LEBANESE", sub:"Fresh Vegetables", coles:null, woolworths:1.20 },
    { name:"Baby spinach", unit:"120g bag", shot:"SPINACH — BABY LEAF", sub:"Herbs & Salad", coles:3.50, woolworths:3.80 },
  ],
  "Meat, Poultry & Seafood": [
    { name:"Chicken breast", unit:"per kg", shot:"CHICKEN — BREAST FILLET", sub:"Chicken", coles:11.00, woolworths:10.50 },
    { name:"Beef mince, 5-star", unit:"500g", shot:"BEEF — MINCE", sub:"Beef & Lamb", coles:6.50, woolworths:6.90 },
    { name:"Atlantic salmon fillet", unit:"per kg", shot:"SALMON — FILLET", sub:"Seafood", coles:32.00, woolworths:29.00 },
    { name:"Bacon rashers", unit:"200g", shot:"BACON — MIDDLE RASHER", sub:"Bacon & Deli Meats", coles:5.50, woolworths:5.20 },
  ],
  "Dairy, Eggs & Fridge": [
    { name:"Full cream milk", unit:"2L", shot:"MILK — FULL CREAM", sub:"Milk", coles:3.30, woolworths:3.30 },
    { name:"Free range eggs", unit:"12 pack", shot:"EGGS — FREE RANGE", sub:"Eggs", coles:6.50, woolworths:6.90 },
    { name:"Tasty cheese block", unit:"500g", shot:"CHEESE — TASTY BLOCK", sub:"Cheese", coles:7.00, woolworths:6.50 },
    { name:"Salted butter", unit:"500g", shot:"BUTTER — SALTED", sub:"Butter & Spreads", coles:6.80, woolworths:7.20 },
    { name:"Greek yoghurt", unit:"1kg tub", shot:"YOGHURT — GREEK", sub:"Yoghurt", coles:5.50, woolworths:5.90 },
  ],
  "Bakery": [
    { name:"White sandwich loaf", unit:"700g", shot:"BREAD — WHITE LOAF", sub:"Bread & Rolls", coles:3.60, woolworths:3.80 },
    { name:"Multigrain loaf", unit:"700g", shot:"BREAD — MULTIGRAIN", sub:"Bread & Rolls", coles:4.50, woolworths:4.30 },
    { name:"Dinner rolls", unit:"6 pack", shot:"ROLLS — DINNER", sub:"Bread & Rolls", coles:null, woolworths:3.20 },
    { name:"Bake-at-home baguette", unit:"2 pack", shot:"BAGUETTE — PAR-BAKED", sub:"Bake At Home", coles:3.80, woolworths:4.00 },
    { name:"Chocolate mud cake", unit:"each", shot:"CAKE — CHOCOLATE MUD", sub:"Chilled Cakes & Desserts", coles:9.50, woolworths:8.90 },
    { name:"Cheese & bacon rolls", unit:"4 pack", shot:"ROLLS — CHEESE & BACON", sub:"Instore Bakery Savoury Treats", coles:6.00, woolworths:null },
  ],
  "Pantry": [
    { name:"Basmati rice", unit:"1kg", shot:"RICE — BASMATI", sub:"Rice & Grains", coles:3.20, woolworths:3.50 },
    { name:"Penne pasta", unit:"500g", shot:"PASTA — PENNE", sub:"Pasta & Sauce", coles:1.60, woolworths:1.50 },
    { name:"Extra virgin olive oil", unit:"750ml", shot:"OLIVE OIL — EXTRA VIRGIN", sub:"Oils & Vinegars", coles:12.00, woolworths:11.50 },
    { name:"Rolled oats", unit:"750g", shot:"OATS — ROLLED", sub:"Breakfast & Spreads", coles:3.90, woolworths:4.10 },
    { name:"Peanut butter, crunchy", unit:"375g", shot:"PEANUT BUTTER — CRUNCHY", sub:"Breakfast & Spreads", coles:4.20, woolworths:4.50 },
    { name:"Crushed tomatoes", unit:"400g can", shot:"TOMATOES — CRUSHED", sub:"Canned Goods", coles:1.40, woolworths:1.40 },
  ],
  "Snacks & Confectionery": [
    { name:"Salt & vinegar chips", unit:"175g", shot:"CHIPS — SALT & VINEGAR", sub:"Chips & Crisps", coles:3.50, woolworths:3.70 },
    { name:"Family block chocolate", unit:"180g", shot:"CHOCOLATE — FAMILY BLOCK", sub:"Chocolate", coles:4.80, woolworths:4.50 },
    { name:"Chocolate chip cookies", unit:"200g", shot:"COOKIES — CHOC CHIP", sub:"Biscuits", coles:3.20, woolworths:null },
    { name:"Cheese & crackers snack pack", unit:"250g", shot:"CRACKERS — CHEESE PACK", sub:"Biscuits", coles:null, woolworths:3.90 },
    { name:"Mixed roasted nuts", unit:"275g", shot:"NUTS — ROASTED MIX", sub:"Nuts & Bars", coles:6.50, woolworths:6.00 },
  ],
  "Drinks": [
    { name:"Cola", unit:"1.25L bottle", shot:"COLA — 1.25L", sub:"Soft Drinks", coles:2.80, woolworths:2.60 },
    { name:"Spring water", unit:"24 x 600ml", shot:"WATER — SPRING 24PK", sub:"Water", coles:8.00, woolworths:7.50 },
    { name:"Instant coffee", unit:"200g jar", shot:"COFFEE — INSTANT", sub:"Coffee & Tea", coles:9.50, woolworths:9.90 },
    { name:"Orange juice", unit:"2L", shot:"JUICE — ORANGE", sub:"Juice", coles:5.20, woolworths:5.20 },
  ],
  "Frozen": [
    { name:"Frozen mixed vegetables", unit:"1kg", shot:"VEG — FROZEN MIXED", sub:"Frozen Vegetables", coles:3.20, woolworths:3.00 },
    { name:"Vanilla ice cream", unit:"2L tub", shot:"ICE CREAM — VANILLA", sub:"Ice Cream & Desserts", coles:6.50, woolworths:6.00 },
    { name:"Frozen crumbed fish", unit:"400g", shot:"FISH — CRUMBED FROZEN", sub:"Frozen Meat & Seafood", coles:7.20, woolworths:null },
  ],
};
