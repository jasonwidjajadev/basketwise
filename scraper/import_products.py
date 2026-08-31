# import time so we can wait before retrying failed requests
import time

# httpx is used underneath supabase
# we use it to catch temporary network errors
import httpx

# import the supabase connection
from database import supabase

# import the woolworths scraper
from woolworths import scrape_woolworths

# import the coles scraper
from coles import scrape_coles


# store ids we have already looked up
# this stops us querying supabase for the same store repeatedly
STORE_ID_CACHE = {}


# maximum number of times to retry a temporary supabase failure
MAX_RETRIES = 5


# number of products to save in one database request
BATCH_SIZE = 100


# --------------------------------------------------
# SUPABASE RETRY HELPER
# --------------------------------------------------

def execute_with_retry(
    operation,
    description="Supabase request"
):
    """
    Run a Supabase operation.

    If a temporary network error occurs,
    retry the request using exponential backoff.
    """

    for attempt in range(
        1,
        MAX_RETRIES + 1
    ):

        try:

            return operation()

        except httpx.TransportError as error:

            # if this was the final attempt,
            # raise the error normally
            if attempt == MAX_RETRIES:

                print(
                    f"{description} failed "
                    f"after {MAX_RETRIES} attempts."
                )

                raise

            # wait longer after every failure
            # 1, 2, 4, 8 seconds
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

            time.sleep(
                wait_time
            )


# --------------------------------------------------
# BATCH HELPER
# --------------------------------------------------

def create_batches(
    items,
    batch_size=BATCH_SIZE
):
    """
    Split a list into smaller batches.
    """

    for start in range(
        0,
        len(items),
        batch_size
    ):

        yield items[
            start:
            start + batch_size
        ]


# --------------------------------------------------
# STORE
# --------------------------------------------------

def get_store_id(store_code):
    """
    Get the internal Supabase id
    for Woolworths or Coles.
    """

    # use cached value if we already found it
    if store_code in STORE_ID_CACHE:

        return STORE_ID_CACHE[
            store_code
        ]

    # search stores table
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

    # make sure store exists
    if not response.data:

        raise ValueError(
            f"Store does not exist: "
            f"{store_code}"
        )

    store_id = (
        response.data[0]["id"]
    )

    # remember it so we don't query again
    STORE_ID_CACHE[
        store_code
    ] = store_id

    return store_id


# --------------------------------------------------
# PRODUCT ROW
# --------------------------------------------------

def create_store_product_row(
    product,
    store_id
):
    """
    Convert a scraped product
    into a row for store_products.
    """

    return {

        "store_id":
        store_id,

        "external_product_id":
        str(
            product["product_id"]
        ),

        "name":
        product["name"],

        "brand":
        product.get("brand"),

        "description":
        product.get("description"),

        "image_url":
        product.get("image"),

        "package_size":
        product.get(
            "package_size"
        ),

        "source_category":
        product.get("category"),

        "is_weighted":
        False,

        "quantity":
        None,

        "unit":
        product.get("unit")
    }


# --------------------------------------------------
# SAVE PRODUCTS
# --------------------------------------------------

def save_store_products(
    products,
    store_code
):
    """
    Save a batch of products
    using ONE Supabase upsert.

    Returns the products returned
    by Supabase.
    """

    if not products:

        return []

    store_id = get_store_id(
        store_code
    )

    # create all product rows
    rows = []

    for product in products:

        row = create_store_product_row(
            product,
            store_id
        )

        rows.append(row)

    # bulk upsert all products
    response = execute_with_retry(

        lambda: (
            supabase
            .table("store_products")
            .upsert(
                rows,
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

    if not response.data:

        raise ValueError(
            f"Could not save "
            f"{store_code} products."
        )

    return response.data


# --------------------------------------------------
# SAVE PRICES
# --------------------------------------------------

def save_prices(
    scraped_products,
    saved_products
):
    """
    Save prices for a batch of products.

    All prices for the batch are inserted
    using ONE Supabase request.
    """

    if not scraped_products:

        return

    # create lookup:
    #
    # external product id -> supabase product id

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

    price_rows = []

    # create all price history rows
    for product in scraped_products:

        price = product.get(
            "price"
        )

        # skip products with no price
        if price is None:

            continue

        external_id = str(
            product["product_id"]
        )

        store_product_id = (
            product_ids.get(
                external_id
            )
        )

        # this should normally never happen
        if store_product_id is None:

            print(
                f"Warning: could not find "
                f"saved product id for "
                f"{product['name']}"
            )

            continue

        price_rows.append({

            "store_product_id":
            store_product_id,

            "price":
            price
        })

    # nothing to insert
    if not price_rows:

        return

    # IMPORTANT:
    #
    # We do NOT automatically retry this insert.
    #
    # Product upserts are safe to retry because
    # duplicates are handled using on_conflict.
    #
    # price_history is a normal INSERT.
    # If Supabase saved the prices but the connection
    # died before Python received the response,
    # retrying could create duplicate history rows.

    try:

        (
            supabase
            .table("price_history")
            .insert(
                price_rows
            )
            .execute()
        )

    except httpx.TransportError as error:

        print()
        print(
            "WARNING: Supabase connection "
            "failed while saving price history."
        )

        print(
            f"Error: {error}"
        )

        print(
            "The scraper will continue."
        )

        print(
            "Some prices from this batch "
            "may or may not have been saved."
        )


# --------------------------------------------------
# SAVE ONE COMPLETE BATCH
# --------------------------------------------------

def save_product_batch(
    products,
    store_code
):
    """
    Save products and their prices.
    """

    if not products:

        return 0

    # save/update all products at once
    saved_products = (
        save_store_products(
            products,
            store_code
        )
    )

    # save all their prices at once
    save_prices(
        products,
        saved_products
    )

    return len(
        saved_products
    )


# --------------------------------------------------
# WOOLWORTHS
# --------------------------------------------------

def save_woolworths_page(
    products
):
    """
    Called by the Woolworths scraper
    after each Woolworths page.
    """

    print()

    print(
        f"Saving {len(products)} "
        f"Woolworths products "
        f"to Supabase..."
    )

    save_product_batch(
        products,
        "woolworths"
    )

    print(
        "Woolworths page saved."
    )


def import_woolworths():
    """
    Scrape Woolworths and save
    each page to Supabase.
    """

    print()

    print(
        "SCRAPING WOOLWORTHS"
    )

    print(
        "===================="
    )

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
    """
    Scrape Coles and save products
    to Supabase in batches.
    """

    print()

    print(
        "SCRAPING COLES"
    )

    print(
        "=============="
    )

    products = scrape_coles()

    print()

    print(
        f"Saving {len(products)} "
        f"Coles products "
        f"to Supabase..."
    )

    total_saved = 0

    # save Coles products in batches
    # instead of sending thousands at once
    for batch in create_batches(
        products
    ):

        saved_count = (
            save_product_batch(
                batch,
                "coles"
            )
        )

        total_saved += (
            saved_count
        )

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
# MAIN
# --------------------------------------------------

if __name__ == "__main__":

    # scrape Woolworths first
    import_woolworths()

    # then scrape Coles
    import_coles()
