import os

from dotenv import load_dotenv
from supabase import create_client


load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")


if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL is missing from .env")

if not SUPABASE_KEY:
    raise ValueError("SUPABASE_KEY is missing from .env")


supabase = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)


def setup_stores():
    stores = [
        {
            "code": "woolworths",
            "name": "Woolworths"
        },
        {
            "code": "coles",
            "name": "Coles"
        }
    ]

    for store in stores:
        existing = (
            supabase
            .table("stores")
            .select("*")
            .eq("code", store["code"])
            .execute()
        )

        if existing.data:
            print(store["name"], "already exists")
        else:
            supabase.table("stores").insert(store).execute()
            print("Created:", store["name"])


if __name__ == "__main__":
    setup_stores()