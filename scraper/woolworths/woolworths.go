package woolworths

import (
	"database/sql"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"time"

	"basketwise/scraper/internal/shared"
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/time/rate"
)

const WOOLWORTHS_PRODUCT_URL_FORMAT = "%s/api/v3/ui/schemaorg/product/%s"
const PRODUCT_INFO_WORKER_COUNT = 2
const DEFAULT_LISTING_PAGE_CHECK_INTERVAL = 1 * time.Minute

type Woolworths struct {
	baseURL                   string
	client                    *shared.RLHTTPClient
	cookieJar                 *cookiejar.Jar
	db                        *sql.DB
	productMaxAge             time.Duration
	listingPageUpdateInterval time.Duration
	filterDepartments         bool
	filteredDepartmentIDsSet  map[departmentID]bool
}

func (w *Woolworths) Init(baseURL string, dbPath string, productMaxAge time.Duration) error {
	var err error
	w.filterDepartments = true

	w.cookieJar, err = cookiejar.New(nil)
	if err != nil {
		return fmt.Errorf("error creating cookie jar: %v", err)
	}
	w.baseURL = baseURL
	w.client = &shared.RLHTTPClient{
		Client: &http.Client{
			Jar:     w.cookieJar,
			Timeout: 30 * time.Second,
		},
		Ratelimiter: rate.NewLimiter(rate.Every(100*time.Millisecond), 1),
	}
	w.productMaxAge = productMaxAge
	if err = w.initDB(dbPath); err != nil {
		return err
	}
	w.filteredDepartmentIDsSet = map[departmentID]bool{
		"1-E5BEE36E": true, // Fruit & Veg
		"1_DEB537E":  true, // Bakery
		"1_D5A2236":  true, // Meat
		"1_6E4F4E4":  true, // Dairy, Eggs & Fridge
		"1_39FD49C":  true, // Pantry
		"1_ACA2FC2":  true, // Freezer
		"1_5AF3A0A":  true, // Drinks
		"1_8E4DA6F":  true, // Liquor
		"1_717A94B":  true, // Baby
	}
	w.listingPageUpdateInterval = DEFAULT_LISTING_PAGE_CHECK_INTERVAL
	return nil
}

func (w *Woolworths) GetSharedProductsUpdatedAfter(t time.Time, count int) ([]shared.ProductInfo, error) {
	var products []shared.ProductInfo
	var deptDescription sql.NullString
	rows, err := w.db.Query(`
		SELECT
			productID, products.name, products.description,
			departments.description, priceCents, previousPriceCents,
			weightGrams, products.updated
		FROM products
		LEFT JOIN departments ON products.departmentID = departments.departmentID
		WHERE products.updated > ? AND name != '' LIMIT ?`, t, count)
	if err != nil {
		return products, fmt.Errorf("failed to query products: %w", err)
	}
	for rows.Next() {
		var p shared.ProductInfo
		err = rows.Scan(&p.ID, &p.Name, &p.Description, &deptDescription,
			&p.PriceCents, &p.PreviousPriceCents, &p.WeightGrams, &p.Timestamp)
		if err != nil {
			return products, fmt.Errorf("failed to scan product: %w", err)
		}
		if deptDescription.Valid {
			p.Department = deptDescription.String
		}
		p.ID = WOOLWORTHS_ID_PREFIX + p.ID
		p.Store = "Woolworths"
		products = append(products, p)
	}
	return products, nil
}

func (w *Woolworths) GetTotalProductCount() (int, error) {
	var count int
	err := w.db.QueryRow("SELECT COUNT(*) FROM products").Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to query product count: %w", err)
	}
	return count, nil
}
