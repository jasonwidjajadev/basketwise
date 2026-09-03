import json
import requests
import time


BASE_URL = "https://www.woolworths.com.au"


WOOLWORTHS_CATEGORIES = [
    "dairy-eggs-fridge",
    "fruit-veg",
    "bakery",
    "meat-seafood-deli",
    "pantry",
    "freezer",
    "drinks",
]


# =========================================================
# SEND REQUEST WITH RETRIES
# =========================================================

def post_with_retry(
    session,
    url,
    payload,
    headers,
    max_attempts=5
):
    """
    Send a POST request to Woolworths.

    If Woolworths closes the connection or temporarily
    fails, retry instead of crashing the entire scraper.
    """

    for attempt in range(1, max_attempts + 1):

        try:

            response = session.post(
                url,
                json=payload,
                headers=headers,
                timeout=30
            )

            # Woolworths is asking us to slow down
            if response.status_code == 429:

                delay = min(
                    5 * (2 ** (attempt - 1)),
                    60
                )

                print(
                    f"Rate limited. "
                    f"Waiting {delay} seconds..."
                )

                time.sleep(delay)

                continue

            response.raise_for_status()

            return response

        except requests.RequestException as error:

            if attempt == max_attempts:

                print()
                print(
                    f"Request failed after "
                    f"{max_attempts} attempts."
                )

                raise

            delay = min(
                5 * (2 ** (attempt - 1)),
                60
            )

            print()
            print(
                f"Request failed: {error}"
            )

            print(
                f"Retrying in {delay} seconds "
                f"(attempt {attempt}/{max_attempts})..."
            )

            time.sleep(delay)


# =========================================================
# GET WOOLWORTHS CATEGORY INFORMATION
# =========================================================

def get_category_map(session, headers):

    url = (
        f"{BASE_URL}"
        f"/apis/ui/PiesCategoriesWithSpecials"
    )

    response = session.get(
        url,
        headers=headers,
        timeout=30
    )

    print(
        "Category API status:",
        response.status_code
    )

    response.raise_for_status()

    data = response.json()

    categories = (
        data.get("categories")
        or data.get("Categories")
        or []
    )

    category_map = {}

    for category in categories:

        slug = (
            category.get("urlFriendlyName")
            or category.get("UrlFriendlyName")
        )

        node_id = (
            category.get("nodeId")
            or category.get("NodeId")
        )

        description = (
            category.get("description")
            or category.get("Description")
        )

        if slug and node_id:

            category_map[slug] = {
                "id": node_id,
                "description": description,
                "slug": slug
            }

    return category_map


# =========================================================
# SCRAPE ONE WOOLWORTHS CATEGORY
# =========================================================

def scrape_woolworths_category(
    session,
    headers,
    category,
    max_pages=None,
    on_page=None
):

    print()
    print("=" * 60)

    print(
        "WOOLWORTHS CATEGORY:",
        category["description"]
    )

    print("=" * 60)


    api_url = (
        f"{BASE_URL}/apis/ui/browse/category"
    )

    slug = category["slug"]

    category_id = category["id"]


    api_headers = {
        **headers,
        "Accept": (
            "application/json, "
            "text/plain, */*"
        ),
        "Content-Type": "application/json"
    }


    all_products = []

    seen_ids = set()

    page = 1


    # =====================================================
    # LOOP THROUGH CATEGORY PAGES
    # =====================================================

    while True:

        print()
        print(
            f"Requesting {slug} page {page}..."
        )


        location = (
            f"/shop/browse/{slug}"
        )


        payload = {

            "categoryId": category_id,

            "pageNumber": page,

            "pageSize": 36,

            "sortType": "TraderRelevance",

            "url": location,

            "location": location,

            "formatObject": json.dumps(
                {
                    "name":
                    category["description"]
                }
            ),

            "isSpecial": False,

            "isBundle": False,

            "isMobile": False,

            "filters": [],

            "token": "",

            "gpBoost": 0,

            "isHideUnavailableProducts": False,

            "isRegisteredRewardCardPromotion": False,

            "enableAdReRanking": False,

            "groupEdmVariants": True,

            "categoryVersion": "v2"
        }


        # Use retry system rather than direct POST
        response = post_with_retry(
            session,
            api_url,
            payload,
            api_headers
        )


        print(
            "HTTP status:",
            response.status_code
        )


        data = response.json()


        # Products belonging ONLY to this page
        page_products = []

        new_products = 0


        # =================================================
        # EXTRACT PRODUCTS
        # =================================================

        for bundle in data.get(
            "Bundles",
            []
        ):

            for product in bundle.get(
                "Products",
                []
            ):

                product_id = str(
                    product.get("Stockcode")
                )


                # Prevent duplicates
                if product_id in seen_ids:
                    continue


                seen_ids.add(product_id)


                clean_product = {

                    "product_id":
                    product_id,

                    "name":
                    product.get("Name"),

                    "brand":
                    product.get("Brand"),

                    "description":
                    product.get("Description"),

                    "price":
                    product.get("Price"),

                    "unit":
                    product.get("Unit"),

                    "package_size":
                    product.get(
                        "PackageSize"
                    ),

                    "barcode":
                    product.get("Barcode"),

                    "in_stock":
                    product.get(
                        "IsInStock"
                    ),

                    "image":
                    product.get(
                        "LargeImageFile"
                    ),

                    "category":
                    slug,

                    "store":
                    "Woolworths"
                }


                all_products.append(
                    clean_product
                )


                page_products.append(
                    clean_product
                )


                new_products += 1


        # =================================================
        # SAVE THIS PAGE IMMEDIATELY
        # =================================================

        if (
            on_page is not None
            and page_products
        ):

            on_page(
                page_products
            )


        print(
            f"Found {new_products} "
            f"new products on page {page}"
        )


        # No new products means end of category
        if new_products == 0:

            print(
                "No more products."
            )

            break


        # Used during testing
        if (
            max_pages is not None
            and page >= max_pages
        ):

            print(
                f"Reached test limit of "
                f"{max_pages} pages."
            )

            break


        page += 1


        # Be polite to Woolworths
        time.sleep(2)


    print()

    print(
        f"{slug}: "
        f"{len(all_products)} "
        f"products total"
    )


    return all_products


# =========================================================
# SCRAPE ALL WOOLWORTHS CATEGORIES
# =========================================================

def scrape_woolworths(
    max_pages_per_category=None,
    on_page=None
):

    session = requests.Session()


    headers = {

        "User-Agent": (
            "Mozilla/5.0 "
            "(Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 "
            "(KHTML, like Gecko) "
            "Chrome/151.0.0.0 "
            "Safari/537.36"
        )
    }


    # =====================================================
    # OPEN WOOLWORTHS FIRST TO RECEIVE COOKIES
    # =====================================================

    print(
        "Opening Woolworths..."
    )


    response = session.get(
        (
            f"{BASE_URL}"
            f"/shop/browse/dairy-eggs-fridge"
        ),
        headers=headers,
        timeout=30
    )


    response.raise_for_status()


    print(
        "Woolworths page loaded."
    )

    print(
        "Cookies received:",
        len(session.cookies)
    )


    # =====================================================
    # GET CURRENT CATEGORY IDs
    # =====================================================

    category_map = get_category_map(
        session,
        headers
    )


    all_products = []

    all_seen_ids = set()


    # =====================================================
    # SCRAPE EACH CATEGORY
    # =====================================================

    for slug in WOOLWORTHS_CATEGORIES:


        if slug not in category_map:

            print(
                f"Could not find "
                f"Woolworths category: "
                f"{slug}"
            )

            continue


        products = (
            scrape_woolworths_category(
                session,
                headers,
                category_map[slug],
                max_pages=
                    max_pages_per_category,
                on_page=
                    on_page
            )
        )


        # Remove duplicates between categories
        for product in products:

            if (
                product["product_id"]
                in all_seen_ids
            ):
                continue


            all_seen_ids.add(
                product["product_id"]
            )


            all_products.append(
                product
            )


    print()
    print("=" * 60)


    print(
        f"WOOLWORTHS TOTAL: "
        f"{len(all_products)} "
        f"unique products"
    )


    return all_products


# =========================================================
# RUN WOOLWORTHS ALONE
# =========================================================

if __name__ == "__main__":

    # None = scrape all pages
    #
    # Change to 2 if you only want
    # a test scrape.
    scrape_woolworths(
        max_pages_per_category=2
    )