#!/usr/bin/env python3
"""Create a tiny store db (schema from internal/crawl/schema.sql) with fake rows for testing."""
import sqlite3, sys, json
from pathlib import Path
SCHEMA = Path(__file__).resolve().parent.parent/"internal"/"crawl"/"schema.sql"
def make(path, store, rows):
    p=Path(path); p.unlink(missing_ok=True)
    c=sqlite3.connect(p)
    for stmt in SCHEMA.read_text().split(";"):
        if stmt.strip(): c.execute(stmt)
    for i in range(rows):
        bc=f"93000000{i:05d}" if i%2==0 else ""
        c.execute("INSERT INTO products (store,product_id,name,brand,size,price_cents,was_price_cents,barcode,dept,category_path,image_urls,nutrition,detail_fetched_at,first_seen,last_seen,ingredients) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          (store,str(1000+i),f"Test Milk {i}","Brand" if i%3 else "Coles","1L",250+i,300 if i%4==0 else 0,bc,"Dairy","Dairy > Milk",json.dumps(["http://x/%d.jpg"%i]),json.dumps({"rows":[{"name":"Energy","per_100":"200kJ"}]}) if i%2 else None,"2026-09-02T00:00:00Z" if i%2 else None,"2026-09-02T00:00:00Z","2026-09-02T00:00:00Z","Milk"))
        c.execute("INSERT INTO price_history VALUES (?,?,?,?,?)",(store,str(1000+i),"2026-09-02T00:00:00Z",250+i,0))
    c.execute("INSERT INTO categories VALUES (?,?,?,?,?,?,?,?)",(store,"cat1","/dairy","Dairy",rows,1,1,"2026-09-02T00:00:00Z"))
    c.commit(); c.close(); print("wrote",path,rows,"rows")
if __name__=="__main__":
    make(sys.argv[1] if len(sys.argv)>1 else "data/hyper_coles.db","coles",30)
    make(sys.argv[2] if len(sys.argv)>2 else "data/hyper_woolworths.db","woolworths",25)
