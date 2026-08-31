import os
import re
import requests
import time

from dotenv import load_dotenv


# Load variables from .env
load_dotenv()


# Main Coles website
BASE_URL = "https://www.coles.com.au"


# Coles categories we want to scrape
COLES_CATEGORIES = [
    "dairy-eggs-fridge",
    "fruit-vegetables",
    "bakery",
    "deli",
    "pantry",
    "meat-seafood",
    "frozen",
    "drinks",
    "cleaning-laundry",
]


# Find the current Coles Next.js build ID
def get_build_id(session, headers):

    print("Opening Coles...")

    # Try the browse page first, then homepage
    urls_to_try = [
        f"{BASE_URL}/browse",
        BASE_URL
    ]

    for url in urls_to_try:

        try:
            # Request the Coles page
            response = session.get(
                url,
                headers=headers,
                timeout=30
            )

            print(
                f"Build ID page status ({url}):",
                response.status_code
            )

            response.raise_for_status()

            # Search the page for the buildId
            match = re.search(
                r'"buildId"\s*:\s*"([^"]+)"',
                response.text
            )

            # If build ID was found
            if match:
                build_id = match.group(1)

                print(
                    "Discovered Coles build ID:",
                    build_id
                )

                return build_id

        # Handle request errors
        except requests.RequestException as error:

            print(
                "Could not use page for build ID:",
                error
            )


    # If we could not find it,
    # try reading it from .env
    build_id = os.getenv(
        "COLES_BUILD_ID"
    )

    if build_id:

        print(
            "Using fallback Coles build ID:",
            build_id
        )

        return build_id


    # If neither worked, stop
    raise ValueError(
        "Could not discover Coles build ID and "
        "COLES_BUILD_ID is not set in .env"
    )


# Scrape one Coles category
def scrape_coles_category(
    session,
    headers,
    build_id,
    category,
    max_pages=None
):

    print()
    print("=" * 60)
    print("COLES CATEGORY:", category)
    print("=" * 60)


    # Create the Next.js JSON endpoint
    api_url = (
        f"{BASE_URL}/_next/data/"
        f"{build_id}/en/browse/{category}.json"
    )


    # Store products from this category
    all_products = []


    # Remember product IDs already seen
    seen_ids = set()


    # Start on page 1
    page = 1


    # Keep scraping pages
    while True:

        print(
            f"Requesting {category} page {page}..."
        )


        # Query parameters
        params = {
            "slug": category,
            "page": page
        }


        # Request product JSON
        response = session.get(
            api_url,
            params=params,
            headers={
                "User-Agent": headers["User-Agent"],
                "Accept": "application/json"
            },
            timeout=30
        )


        print(
            "API status:",
            response.status_code
        )


        response.raise_for_status()


        # Convert response into Python dictionary
        data = response.json()


        # Get the product results
        results = (
            data
            .get("pageProps", {})
            .get("searchResults", {})
            .get("results", [])
        )


        # If there are no products,
        # we have reached the end
        if not results:

            print("No more results.")

            break


        new_products = 0


        # Go through products on this page
        for product in results:


            # Ignore anything that is not a product
            if product.get("_type") != "PRODUCT":
                continue


            # Get product ID
            product_id = str(
                product.get("id")
            )


            # Skip duplicate products
            if product_id in seen_ids:
                continue


            seen_ids.add(
                product_id
            )


            # Get pricing information
            pricing = (
                product.get("pricing")
                or {}
            )


            # Default image to None
            image = None


            # Get image URLs
            image_uris = (
                product.get("imageUris")
                or []
            )


            # Use first image if available
            if image_uris:

                image = (
                    image_uris[0]
                    .get("uri")
                )


            # Create a cleaner product dictionary
            clean_product = {

                "product_id":
                product_id,

                "name":
                product.get("name"),

                "brand":
                product.get("brand"),

                "description":
                product.get("description"),

                "price":
                pricing.get("now"),

                "was_price":
                pricing.get("was"),

                "package_size":
                product.get("size"),

                "in_stock":
                product.get("availability"),

                "image":
                image,

                "category":
                category,

                "store":
                "Coles"
            }


            # Add product to our list
            all_products.append(
                clean_product
            )


            new_products += 1


        print(
            f"Found {new_products} new products "
            f"on page {page}"
        )


        # Stop if this page added nothing new
        if new_products == 0:
            break


        # Optional testing limit
        if (
            max_pages is not None
            and page >= max_pages
        ):

            print(
                f"Reached test limit of "
                f"{max_pages} pages."
            )

            break


        # Move to next page
        page += 1


        # Wait before next request
        time.sleep(1.5)


    print(
        f"{category}: "
        f"{len(all_products)} products total"
    )


    return all_products


# Main function that scrapes all Coles categories
def scrape_coles(
    max_pages_per_category=None
):

    # Reuse one HTTP session
    session = requests.Session()


    # Browser-style request header
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


    # Find the current Coles build ID
    build_id = get_build_id(
        session,
        headers
    )


    # Store all Coles products
    all_products = []


    # Remember all IDs across every category
    all_seen_ids = set()


    # Go through each category
    for category in COLES_CATEGORIES:


        # Scrape this category
        products = scrape_coles_category(
            session,
            headers,
            build_id,
            category,
            max_pages=max_pages_per_category
        )


        # Add products to final list
        for product in products:


            # Skip products already found
            # in another category
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


    # Show final total
    print(
        f"COLES TOTAL: "
        f"{len(all_products)} "
        f"unique products"
    )


    # Return all scraped Coles products
    return all_products