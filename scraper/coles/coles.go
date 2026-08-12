package coles

import (
	"database/sql"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"time"

	"basketwise/scraper/internal/shared"
	"golang.org/x/time/rate"
)

const DEFAULT_LISTING_PAGE_CHECK_INTERVAL = 1 * time.Minute

type Coles struct {
	baseURL                   string
	client                    *shared.RLHTTPClient
	cookieJar                 *cookiejar.Jar
	db                        *sql.DB
	colesAPIVersion           string
	productMaxAge             time.Duration
	listingPageUpdateInterval time.Duration
	filteredDepartmentIDsSet  map[string]bool
	filterDepartments         bool
}

func (c *Coles) Init(baseURL string, dbPath string, productMaxAge time.Duration) error {
	var err error
	c.colesAPIVersion = DEFAULT_API_VERSION
	c.baseURL = baseURL

	c.cookieJar, err = cookiejar.New(nil)
	if err != nil {
		return fmt.Errorf("error creating cookie jar: %v", err)
	}
	c.client = &shared.RLHTTPClient{
		Client: &http.Client{
			Jar:     c.cookieJar,
			Timeout: 30 * time.Second,
		},
		Ratelimiter: rate.NewLimiter(rate.Every(1000*time.Millisecond), 1),
	}
	c.productMaxAge = productMaxAge
	err = c.initDB(dbPath)
	if err != nil {
		return err
	}
	c.listingPageUpdateInterval = DEFAULT_LISTING_PAGE_CHECK_INTERVAL
	c.filteredDepartmentIDsSet = map[string]bool{
		"fruit-vegetables":  true,
		"dairy-eggs-fridge": true,
		"bakery":            true,
		"deli":              true,
		"pantry":            true,
		"meat-seafood":      true,
		"frozen":            true,
		"drinks":            true,
		"household":         true,
	}
	c.filterDepartments = true

	if err := c.updateAPIVersion(); err != nil {
		slog.Error("error updating API version", "error", err)
	}

	return nil
}

func (c *Coles) Run(cancel chan struct{}) {
	departmentPageChannel := make(chan departmentPage)

	go c.productListPageWorker(departmentPageChannel)
	go c.newDepartmentInfoWorker()
	go c.departmentPageUpdateQueueWorker(departmentPageChannel, c.productMaxAge)

	for range cancel {
		return
	}
}

func (c *Coles) GetSharedProductsUpdatedAfter(t time.Time, count int) ([]shared.ProductInfo, error) {
	var products []shared.ProductInfo
	var deptDescription sql.NullString
	rows, err := c.db.Query(`
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
		p.ID = COLES_ID_PREFIX + p.ID
		p.Store = "Coles"
		products = append(products, p)
	}
	return products, nil
}

func (c *Coles) GetTotalProductCount() (int, error) {
	var count int
	err := c.db.QueryRow("SELECT COUNT(*) FROM products").Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to query product count: %w", err)
	}
	return count, nil
}
