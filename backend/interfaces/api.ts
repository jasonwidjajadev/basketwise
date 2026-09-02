/*

The purpose of this file is to define the 
EXACT INPUT AND OUTPUT types for each api.

*/



// Shared Types


// Recursive???
interface Category {
    name: string,
    id: string,
    subCategories: Category
}
/**
 * Get categories:
 * 
 * 
 * [
  { "id": "fruit-vegetables", "name": "Fruit & Vegetables" },
  { "id": "meat-seafood", "name": "Meat & Seafood" },
  { "id": "dairy-eggs-fridge", "name": "Dairy, Eggs & Fridge" }
]
 */

interface GetCategoriesRequest {
    // Empty
}

interface GetCategoriesResponse {
    Categories: Category[]
}


// Get Product

interface GetProductsRequest {
    // Empty
}

interface GetProductsResponse {
    Categories: Category[]
}

