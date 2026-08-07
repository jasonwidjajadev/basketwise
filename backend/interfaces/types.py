from datetime import date
import typing

"""

9:52 types defined

9:57 - two Khushi jira backend task


Khushis Two Apis:

* Subsitute:
-> For a specific Item:
-> return which location has a cheaper ITEM.




PRO TIP:
-> tell chatgpt to use a function, that generates 1000 fake mock datas for your schema.
-> 


Clarifiucations:

* 2L in general = 
    Catgegory + cateogrty definition
    Cateogry Specific Filtering: Sorting by cheapestr $/L 

* Specific Item
    https://www.woolworths.com.au/shop/productdetails/807383/woolworths-whole-milk-full-cream-milk
    Woolwoirths whole milk Two Litres


"""





"""

Woolies Or Coles
"""


from enum import Enum
class Franchise(Enum):
    Woolworths = 1
    Coles = 2


# class Brand:
#     def __init__(self):
#         pass
"""
Store Class:

* Store Name
* Stored_ID (interal)
* Store_ID (public woolies / coles)
* Location
    -> Address
    -> Lat, Longitude
    -> OPENING_HOURS
    -> Services:
        click&collect: bool
* id
* 

Challenge: O(1) 
* Check if a store has a product, (given the store)
* Check closest store with product 
"""
class Store:
    def __init__(self, franchise: Franchise):
        self.franchise: Franchise = franchise


class StockRecord:
    def __init__(self, stock_date, stock_count, discount) -> None:
        self.date: date = stock_date

        self.stock_count: int = stock_count
        self.in_stock: bool = stock_count == 0


        self.discount: int = discount

        # self.


class Item:
    def __init__(self, price, name, product_id) -> None:
        self.price: float = price
        self.name: str = name
        self.url: int = product_id

        self.stock_records: list[StockRecord]

        # In Stock:
        # Stock current_day
        # Stock date we recorded this stock
        # Which store was this stock from?


class Category:
    def __init__(self) -> None:
        pass
