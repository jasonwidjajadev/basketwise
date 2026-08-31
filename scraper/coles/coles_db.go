package coles

import (
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"time"

	"basketwise/scraper/internal/shared"
	"github.com/shopspring/decimal"
	_ "github.com/mattn/go-sqlite3"
)

const DB_SCHEMA_VERSION = 1

func (c *Coles) initBlankDB() error {
	for _, table := range []string{"schema", "departments", "products"} {
		_, err := c.db.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", table))
		if err != nil {
			return err
		}
	}
	_, err := c.db.Exec("CREATE TABLE IF NOT EXISTS schema (version INTEGER PRIMARY KEY)")
	if err != nil {
		return err
	}
	_, err = c.db.Exec("INSERT INTO schema (version) VALUES (?)", DB_SCHEMA_VERSION)
	if err != nil {
		return err
	}
	_, err = c.db.Exec("CREATE TABLE IF NOT EXISTS departments (departmentID TEXT UNIQUE, description TEXT, productCount INTEGER, updated DATETIME)")
	if err != nil {
		return err
	}
	_, err = c.db.Exec(`CREATE TABLE IF NOT EXISTS products (
		productID TEXT UNIQUE, name TEXT, description TEXT, barcode TEXT,
		priceCents INTEGER, previousPriceCents INTEGER, weightGrams INTEGER,
		productJSON TEXT, departmentID TEXT DEFAULT "", updated DATETIME)`)
	return err
}

func (c *Coles) backupDB(dbPath string, oldSchema int) error {
	backupName := fmt.Sprintf("%s.%d.%s", dbPath, oldSchema, time.Now().Format("2006-01-02T15:04:05"))
	if err := os.Rename(dbPath, backupName); err != nil {
		return fmt.Errorf("failed to backup existing DB: %w", err)
	}
	slog.Info("Backed up old DB", "old", dbPath, "new", backupName)
	return nil
}

func openDB(dbPath string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", dbPath+"?cache=shared")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	return db, nil
}

func (c *Coles) initDB(dbPath string) error {
	var err error
	c.db, err = openDB(dbPath)
	if err != nil {
		return fmt.Errorf("failed to open DB: %w", err)
	}
	var version int
	err = c.db.QueryRow("SELECT version FROM schema").Scan(&version)
	if err != nil || version != DB_SCHEMA_VERSION {
		slog.Warn("DB schema mismatch", "path", dbPath, "currentVersion", DB_SCHEMA_VERSION, "detectedVersion", version)
		if version != 0 {
			if err = c.db.Close(); err != nil {
				return fmt.Errorf("failed to close DB before backup: %w", err)
			}
			if err = c.backupDB(dbPath, version); err != nil {
				return err
			}
			if c.db, err = openDB(dbPath); err != nil {
				return fmt.Errorf("failed to open DB: %w", err)
			}
		}
		if err = c.initBlankDB(); err != nil {
			return fmt.Errorf("failed to create blank DB: %w", err)
		}
		slog.Info("New blank DB created")
	}
	return nil
}

func (c *Coles) saveProductInfoes(products []colesProductInfo) error {
	tx, err := c.db.Begin()
	defer tx.Rollback()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	for _, product := range products {
		if err := c.saveProductInfo(tx, product); err != nil {
			return fmt.Errorf("failed to save product info: %w", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}

func calcWeightInGrams(productInfo colesProductInfo) (int, error) {
	scalar := 0.0
	switch productInfo.Info.Pricing.Unit.OfMeasureUnits {
	case "g":
		scalar = 1.0
	case "kg":
		scalar = 1000.0
	case "ml":
		scalar = 1.0
	case "l":
		scalar = 1000.0
	default:
		return 0, fmt.Errorf("cannot convert unit `%s` to grams", productInfo.Info.Pricing.Unit.OfMeasureUnits)
	}
	return int(float64(productInfo.Info.Pricing.Unit.Quantity) * scalar), nil
}

func (c *Coles) saveProductInfo(tx *sql.Tx, productInfo colesProductInfo) error {
	productInfo.WeightGrams, _ = calcWeightInGrams(productInfo)

	result, err := tx.Exec(`
		INSERT INTO products (productID, name, description, barcode, priceCents, previousPriceCents, weightGrams, productJSON, departmentID, updated)
		VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
		ON CONFLICT(productID) DO UPDATE SET
			name=excluded.name, description=excluded.description, barcode=excluded.barcode,
			priceCents=excluded.priceCents, previousPriceCents=priceCents,
			weightGrams=excluded.weightGrams, productJSON=excluded.productJSON,
			departmentID=excluded.departmentID, updated=excluded.updated`,
		productInfo.ID, productInfo.Info.Name, productInfo.Info.Description, 0,
		productInfo.Info.Pricing.Now.Mul(decimal.NewFromInt(100)).IntPart(),
		productInfo.WeightGrams, productInfo.RawJSON, productInfo.departmentID, productInfo.Updated)
	if err != nil {
		return fmt.Errorf("failed to upsert product: %w", err)
	}
	if rows, err := result.RowsAffected(); err == nil && rows == 0 {
		slog.Warn("Product info not updated.")
	}
	return nil
}

func (c *Coles) loadProductInfo(productID productID) (colesProductInfo, error) {
	var p colesProductInfo
	var deptDesc sql.NullString
	err := c.db.QueryRow(`
		SELECT productID, name, products.description, priceCents, previousPriceCents,
			weightGrams, productJSON, products.departmentID, departments.description, products.updated
		FROM products
		LEFT JOIN departments ON products.departmentID = departments.departmentID
		WHERE productID = ? LIMIT 1`, productID).Scan(
		&p.ID, &p.Info.Name, &p.Info.Description, &p.Info.Pricing.Now,
		&p.PreviousPrice, &p.WeightGrams, &p.RawJSON, &p.departmentID, &deptDesc, &p.Updated)
	if err == sql.ErrNoRows {
		return p, shared.ErrProductMissing
	}
	if err != nil {
		return p, fmt.Errorf("failed to query product: %w", err)
	}
	if deptDesc.Valid {
		p.departmentDescription = deptDesc.String
	}
	return p, nil
}

func (c *Coles) saveDepartment(dept departmentInfo) error {
	result, err := c.db.Exec(`
		INSERT INTO departments (departmentID, description, productCount, updated)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(departmentID) DO UPDATE SET
			description=excluded.description, productCount=excluded.productCount, updated=excluded.updated`,
		dept.SeoToken, dept.Name, dept.ProductCount, dept.Updated)
	if err != nil {
		return fmt.Errorf("failed to upsert department: %w", err)
	}
	if rows, err := result.RowsAffected(); err == nil && rows == 0 {
		slog.Warn("Department not upserted")
	}
	return nil
}

func (c *Coles) loadDepartmentInfoList() ([]departmentInfo, error) {
	var depts []departmentInfo
	rows, err := c.db.Query("SELECT departmentID, description, productCount, updated FROM departments")
	if err != nil {
		return depts, fmt.Errorf("failed to query departments: %w", err)
	}
	for rows.Next() {
		var d departmentInfo
		if err = rows.Scan(&d.SeoToken, &d.Name, &d.ProductCount, &d.Updated); err != nil {
			return depts, fmt.Errorf("failed to scan department: %w", err)
		}
		depts = append(depts, d)
	}
	return depts, nil
}
