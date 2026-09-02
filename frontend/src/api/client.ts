/**
 * BasketWise API client.
 *
 * Types come from schema.d.ts, which is generated from the live OpenAPI schema --
 * never hand-edit either file. Regenerate after a backend change:
 *
 *   npx openapi-typescript https://basket.taskglass.work/openapi.json -o src/api/schema.d.ts
 *
 * Set VITE_API_BASE in .env.local to point at a local backend.
 */
import type { components } from "./schema";

export type Category = components["schemas"]["Category"];
export type Subcategory = components["schemas"]["Subcategory"];
export type Product = components["schemas"]["Product"];
export type ProductDetail = components["schemas"]["ProductDetail"];
export type Offer = components["schemas"]["Offer"];
export type BasketItem = components["schemas"]["BasketItem"];
export type CompareResponse = components["schemas"]["CompareResponse"];
export type PriceHistory = components["schemas"]["PriceHistory"];
export type StoreComparison = components["schemas"]["StoreComparison"];
export type Retailer = Offer["retailer"];

const BASE: string =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE ??
  "https://basket.taskglass.work";

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function getRaw<T>(
  path: string,
  params: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<{ data: T; total: number | null }> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const url = `${BASE}${path}${qs.size ? `?${qs}` : ""}`;
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new ApiError(res.status, `GET ${path} failed: ${res.status}`);
  const total = res.headers.get("X-Total-Count");
  return { data: (await res.json()) as T, total: total === null ? null : Number(total) };
}

async function get<T>(path: string, params: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
  return (await getRaw<T>(path, params, signal)).data;
}

/** Browse navigation. Use `id` in requests, `name` for display -- never build your own label map. */
export const getCategories = (signal?: AbortSignal) => get<Category[]>("/categories", {}, signal);

export interface ProductQuery {
  essential?: boolean;
  category?: string;
  subcategory?: string;
  tag?: string;
  /** Full-text search over product names. */
  q?: string;
  special?: boolean;
  retailer?: Retailer;
  /** Only products carried by 2+ retailers, i.e. the ones Compare can actually compare. */
  multi_retailer?: boolean;
  /** Max 100. Default 24. */
  limit?: number;
  offset?: number;
}

/** Returns `[]` when nothing matches -- never throws for an empty result. */
export const getProducts = (query: ProductQuery = {}, signal?: AbortSignal) =>
  get<Product[]>("/products", query as Record<string, unknown>, signal);

/**
 * Same as getProducts, but also returns how many products match the filter overall.
 * Use it to render "24 of 1,240" and to know when to stop paging.
 */
export const getProductsPage = (query: ProductQuery = {}, signal?: AbortSignal) =>
  getRaw<Product[]>("/products", query as Record<string, unknown>, signal);

/** The 20 curated Home essentials. Small payload -- use it for first paint. */
export const getEssentials = (signal?: AbortSignal) =>
  getProducts({ essential: true, limit: 20 }, signal);

/** One product with every retailer's offer, cheapest first. */
export const getProduct = (productId: string, signal?: AbortSignal) =>
  get<ProductDetail>(`/products/${encodeURIComponent(productId)}`, {}, signal);

/**
 * Price the basket across every retailer.
 *
 * The backend owns this arithmetic -- never total a basket on the frontend, or
 * two screens will eventually disagree. Call again whenever the basket changes.
 */
export async function compare(items: BasketItem[], signal?: AbortSignal): Promise<CompareResponse> {
  const res = await fetch(`${BASE}/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ items }),
    signal,
  });
  if (!res.ok) throw new ApiError(res.status, `POST /compare failed: ${res.status}`);
  return res.json() as Promise<CompareResponse>;
}

/** Price observations per retailer, for a sparkline or a "cheapest in 30 days" badge. */
export const getPriceHistory = (productId: string, days = 30, signal?: AbortSignal) =>
  get<PriceHistory[]>(`/products/${encodeURIComponent(productId)}/price-history`, { days }, signal);

export const RETAILER_LABEL: Record<Retailer, string> = {
  coles: "Coles",
  woolworths: "Woolworths",
  aldi: "ALDI",
  harrisfarm: "Harris Farm",
};

/** "$1.55 / 100g" -- the honest way to compare a 500 g tub against a 1 kg tub. */
export function formatUnitPrice(p: Pick<Product, "unit_price" | "unit_measure">): string {
  if (p.unit_price == null || !p.unit_measure) return "";
  return `$${p.unit_price.toFixed(2)} / ${p.unit_measure.toLowerCase()}`;
}

/** Percentage off, for a "SAVE 25%" badge. Returns null when not on special. */
export function discountPercent(p: Pick<Product, "min_price" | "was_price">): number | null {
  if (p.was_price == null || p.min_price == null || p.was_price <= p.min_price) return null;
  return Math.round((1 - p.min_price / p.was_price) * 100);
}

/** "2 L", "700 g", "6 pk". Sizes are normalised to g / ml / pk / ea by the backend. */
export function formatSize(p: Pick<Product, "size_value" | "size_unit">): string {
  const { size_value: v, size_unit: u } = p;
  if (v == null || !u) return "";
  if (u === "ml" && v >= 1000) return `${+(v / 1000).toFixed(2)} L`;
  if (u === "g" && v >= 1000) return `${+(v / 1000).toFixed(2)} kg`;
  if (u === "ea") return v === 1 ? "each" : `${v} ea`;
  return `${+v.toFixed(2)} ${u}`;
}
