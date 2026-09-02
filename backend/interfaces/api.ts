/*
 * DEPRECATED -- do not add types here.
 *
 * This file used to be a hand-written sketch and had drifted from the contract
 * (it declared `subCategories: Category` singular, and wrapped list responses in
 * `{ Categories: [...] }` where the API returns a bare array). Hand-maintaining a
 * second copy of the contract is exactly what Source-of_truth_v2.md 0.12 warns about.
 *
 * The API's OpenAPI schema is now the single source of truth. Generated types live in
 * frontend/src/api/schema.d.ts, with a typed client in frontend/src/api/client.ts:
 *
 *   import { getProducts, compare, type Product } from "@/api/client";
 *
 * Regenerate after any backend change:
 *   npx openapi-typescript https://basket.taskglass.work/openapi.json -o src/api/schema.d.ts
 */
export {};
