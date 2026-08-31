# Used to pause before retrying a failed request
import time

# Used to catch internet/Supabase connection errors
import httpx

# Connect to our Supabase database
from database import supabase

# Import the Woolworths scraper
from woolworths import scrape_woolworths

# Import the Coles scraper
from coles import scrape_coles


# Remember store IDs so we don't keep asking Supabase
STORE_ID_CACHE = {}

# Try a failed Supabase request up to 5 times
MAX_RETRIES = 5

# Save Coles products in groups of 100
BATCH_SIZE = 100


###### RETRY FAILED SUPABASE REQUESTS

def execute_with_retry(
    operation,
    description="Supabase request"
):

    # Try the request up to 5 times
    for attempt in range(
        1,
        MAX_RETRIES + 1
    ):

        try:
            # Run the Supabase request
            return operation()

        # If there is a connection problem
        except httpx.TransportError as error:

            # If we already tried 5 times, stop
            if attempt == MAX_RETRIES:

                print(
                    f"{description} failed "
                    f"after {MAX_RETRIES} attempts."
                )

                raise

            # Wait longer each time:
            # 1 second, 2 seconds, 4 seconds, 8 seconds
            wait_time = 2 ** (
                attempt - 1
            )

            print()
            print(
                f"{description} temporarily failed."
            )

            print(
                f"Error: {error}"
            )

            print(
                f"Retrying in "
                f"{wait_time} seconds..."
            )

            # Wait before trying again
            time.sleep(
                wait_time
            )



##### SPLIT PRODUCTS INTO GROUPS

def create_batches(
    items,
    batch_size=BATCH_SIZE
):

    # Split products into groups of 100
    for start in range(
        0,
        len(items),
        batch_size
    ):

        yield items[
            start:
            start + batch_size
        ]

##### GET STORE ID
def get_store_id(store_code):

    # If we already know the store ID, use it
    if store_code in STORE_ID_CACHE:

        return STORE_ID_CACHE[
            store_code
        ]

    # Otherwise, find the store in Supabase
    response = execute_with_retry(

        lambda: (
            supabase
            .table("stores")
            .select("id")
            .eq(
                "code",
                store_code
            )
            .execute()
        ),

        description=(
            f"Looking up store "
            f"{store_code}"
        )
    )

    # If the store does not exist, show an error
    if not response.data:

        raise ValueError(
            f"Store does not exist: "
            f"{store_code}"
        )

    # Get the store's ID
    store_id = (
        response.data[0]["id"]
    )

    # Remember the ID for later
    STORE_ID_CACHE[
        store_code
    ] = store_id

    return store_id



#### CREATE A PRODUCT ROW

def create_store_product_row(
    product,
    store_id
):

    # Turn scraped product data into
    # the format our Supabase table needs
    return {

        # Which store sells the product
        "store_id":
        store_id,

        # Product ID from Woolworths or Coles
        "external_product_id":
        str(
            product["product_id"]
        ),

        # Product name
        "name":
        product["name"],

        # Product brand
        "brand":
        product.get("brand"),

        # Product description
        "description":
        product.get("description"),

        # Product image
        "image_url":
        product.get("image"),

        # Example: 2L or 500g
        "package_size":
        product.get(
            "package_size"
        ),

        # Category it came from
        "source_category":
        product.get("category"),

        # We currently assume it is not sold by weight
        "is_weighted":
        False,

        # Quantity is not calculated yet
        "quantity":
        None,

        # Unit if available
        "unit":
        product.get("unit")
    }


# --------------------------------------------------
# SAVE PRODUCTS TO SUPABASE
# --------------------------------------------------

def save_store_products(
    products,
    store_code
):

    # Nothing to save
    if not products:
        return []

    # Find the ID for Woolworths or Coles
    store_id = get_store_id(
        store_code
    )

    # List of products we will send to Supabase
    rows = []

    # Convert every product into a database row
    for product in products:

        row = create_store_product_row(
            product,
            store_id
        )

        rows.append(row)

    # Save all the products together
    response = execute_with_retry(

        lambda: (
            supabase
            .table("store_products")
            .upsert(
                rows,

                # If the product already exists,
                # update it instead of adding a duplicate
                on_conflict=(
                    "store_id,"
                    "external_product_id"
                )
            )
            .execute()
        ),

        description=(
            f"Saving {len(rows)} "
            f"{store_code} products"
        )
    )

    # Make sure products were saved
    if not response.data:

        raise ValueError(
            f"Could not save "
            f"{store_code} products."
        )

    # Return the products saved by Supabase
    return response.data


# --------------------------------------------------
# SAVE PRODUCT PRICES
# --------------------------------------------------

def save_prices(
    scraped_products,
    saved_products
):

    # Nothing to do if there are no products
    if not scraped_products:
        return

    # Match the Woolworths/Coles product ID
    # with our Supabase product ID
    product_ids = {}

    for product in saved_products:

        external_id = str(
            product[
                "external_product_id"
            ]
        )

        product_ids[
            external_id
        ] = product["id"]

    # List of prices to save
    price_rows = []

    # Go through every scraped product
    for product in scraped_products:

        # Get its price
        price = product.get(
            "price"
        )

        # Skip products that have no price
        if price is None:
            continue

        # Get the Woolworths/Coles product ID
        external_id = str(
            product["product_id"]
        )

        # Find its Supabase product ID
        store_product_id = (
            product_ids.get(
                external_id
            )
        )

        # If we cannot find the product, skip it
        if store_product_id is None:

            print(
                f"Warning: could not find "
                f"saved product id for "
                f"{product['name']}"
            )

            continue

        # Create the price row
        price_rows.append({

            # Which product this price belongs to
            "store_product_id":
            store_product_id,

            # Current price
            "price":
            price
        })

    # Nothing to save
    if not price_rows:
        return

    try:

        # Save all prices together
        (
            supabase
            .table("price_history")
            .insert(
                price_rows
            )
            .execute()
        )

    # If the Supabase connection fails
    except httpx.TransportError as error:

        print()
        print(
            "WARNING: Supabase connection "
            "failed while saving price history."
        )

        print(
            f"Error: {error}"
        )

        # Do not stop the whole scraper
        print(
            "The scraper will continue."
        )

        print(
            "Some prices from this batch "
            "may or may not have been saved."
        )


# --------------------------------------------------
# SAVE PRODUCTS + PRICES
# --------------------------------------------------

def save_product_batch(
    products,
    store_code
):

    # Nothing to save
    if not products:
        return 0

    # Save product information first
    saved_products = (
        save_store_products(
            products,
            store_code
        )
    )

    # Then save their prices
    save_prices(
        products,
        saved_products
    )

    # Return number of products saved
    return len(
        saved_products
    )


# --------------------------------------------------
# WOOLWORTHS
# --------------------------------------------------

def save_woolworths_page(
    products
):

    # This runs every time Woolworths
    # finishes scraping one page

    print()

    print(
        f"Saving {len(products)} "
        f"Woolworths products "
        f"to Supabase..."
    )

    # Save this page's products and prices
    save_product_batch(
        products,
        "woolworths"
    )

    print(
        "Woolworths page saved."
    )


def import_woolworths():

    print()

    print(
        "SCRAPING WOOLWORTHS"
    )

    print(
        "===================="
    )

    # Start the Woolworths scraper
    #
    # Each finished page gets sent to
    # save_woolworths_page()
    scrape_woolworths(
        on_page=
        save_woolworths_page
    )

    print()

    print(
        "Woolworths scrape completed."
    )


# --------------------------------------------------
# COLES
# --------------------------------------------------

def import_coles():

    print()

    print(
        "SCRAPING COLES"
    )

    print(
        "=============="
    )

    # Scrape all Coles products
    products = scrape_coles()

    print()

    print(
        f"Saving {len(products)} "
        f"Coles products "
        f"to Supabase..."
    )

    # Keep track of how many we save
    total_saved = 0

    # Split Coles products into groups of 100
    for batch in create_batches(
        products
    ):

        # Save this group of products and prices
        saved_count = (
            save_product_batch(
                batch,
                "coles"
            )
        )

        # Add to the total
        total_saved += (
            saved_count
        )

        # Show progress
        print(
            f"Saved "
            f"{total_saved}/"
            f"{len(products)} "
            f"Coles products."
        )

    print()

    print(
        f"Saved {total_saved} "
        f"Coles products."
    )


# --------------------------------------------------
# START THE PROGRAM
# --------------------------------------------------

# This runs when we type:
#
# python import_products.py
if __name__ == "__main__":

    # Scrape and save Woolworths first
    import_woolworths()

    # Then scrape and save Coles
    import_coles()