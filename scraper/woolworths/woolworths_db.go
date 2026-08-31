package woolworths

import (
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"time"

	"basketwise/scraper/internal/shared"
	"github.com/shopspring/decimal"
)

const DB_SCHEMA_VERSION = 7

func (w *Woolworths) initBlankDB() error {
	for _, table := range []string{"schema", "departments", "products"} {
		_, err := w.db.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", table))
		if err != nil {
			return err
		}
	}
	_, err := w.db.Exec("CREATE TABLE IF NOT EXISTS schema (version INTEGER PRIMARY KEY)")
	if err != nil {
		return err
	}
	_, err = w.db.Exec("INSERT INTO schema (version) VALUES (?)", DB_SCHEMA_VERSION)
	if err != nil {
		return err
	}
	_, err = w.db.Exec("CREATE TABLE IF NOT EXISTS departments (departmentID TEXT UNIQUE, description TEXT, productCount INTEGER, updated DATETIME)")
	if err != nil {
		return err
	}
	_, err = w.db.Exec(`CREATE TABLE IF NOT EXISTS products (
		productID TEXT UNIQUE, name TEXT, description TEXT, barcode TEXT,
		priceCents INTEGER, previousPriceCents INTEGER, weightGrams INTEGER,
		productJSON TEXT, departmentID TEXT DEFAULT "", updated DATETIME)`)
	return err
}

func (w *Woolworths) backupDB(dbPath string, oldSchema int) error {
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

func (w *Woolworths) initDB(dbPath string) error {
	var err error
	w.db, err = openDB(dbPath)
	if err != nil {
		return fmt.Errorf("failed to open DB: %w", err)
	}
	var version int
	err = w.db.QueryRow("SELECT version FROM schema").Scan(&version)
	if err != nil || version != DB_SCHEMA_VERSION {
		slog.Warn("DB schema mismatch", "path", dbPath, "currentVersion", DB_SCHEMA_VERSION, "detectedVersion", version)
		if version != 0 {
			if err = w.db.Close(); err != nil {
				return fmt.Errorf("failed to close DB before backup: %w", err)
			}
			if err = w.backupDB(dbPath, version); err != nil {
				return err
			}
			if w.db, err = openDB(dbPath); err != nil {
				return fmt.Errorf("failed to open DB: %w", err)
			}
		}
		if err = w.initBlankDB(); err != nil {
			return fmt.Errorf("failed to create blank DB: %w", err)
		}
		slog.Info("New blank DB created")
	}
	return nil
}

func (w *Woolworths) saveProductInfo(tx *sql.Tx, productInfo woolworthsProductInfo) error {
	result, err := tx.Exec(`
		INSERT INTO products (productID, name, description, barcode, priceCents, previousPriceCents, weightGrams, productJSON, departmentID, updated)
		VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
		ON CONFLICT(productID) DO UPDATE SET
			name=excluded.name, description=excluded.description, barcode=excluded.barcode,
			priceCents=excluded.priceCents, previousPriceCents=priceCents,
			weightGrams=excluded.weightGrams, productJSON=excluded.productJSON,
			departmentID=excluded.departmentID, updated=excluded.updated`,
		productInfo.ID, productInfo.Info.DisplayName, productInfo.Info.Description, productInfo.Info.Barcode,
		productInfo.Info.Price.Mul(decimal.NewFromInt(100)).IntPart(),
		productInfo.Info.UnitWeightInGrams, productInfo.RawJSON, productInfo.departmentID, productInfo.Updated)
	if err != nil {
		return fmt.Errorf("failed to upsert product: %w", err)
	}
	if rows, err := result.RowsAffected(); err == nil && rows == 0 {
		slog.Warn("Product info not updated.")
	}
	return nil
}

func (w *Woolworths) saveProductInfoNoTx(productInfo woolworthsProductInfo) error {
	tx, err := w.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()
	if err = w.saveProductInfo(tx, productInfo); err != nil {
		return err
	}
	return tx.Commit()
}

func (w *Woolworths) saveDepartment(dept departmentInfo) error {
	result, err := w.db.Exec(`
		INSERT INTO departments (departmentID, description, productCount, updated)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(departmentID) DO UPDATE SET
			description=excluded.description, productCount=excluded.productCount, updated=excluded.updated`,
		dept.NodeID, dept.Description, dept.ProductCount, dept.Updated)
	if err != nil {
		return fmt.Errorf("failed to upsert department: %w", err)
	}
	if rows, err := result.RowsAffected(); err == nil && rows == 0 {
		slog.Warn("Department not upserted")
	}
	return nil
}

func (w *Woolworths) loadProductInfo(productID productID) (woolworthsProductInfo, error) {
	var p woolworthsProductInfo
	var deptDesc sql.NullString
	err := w.db.QueryRow(`
		SELECT productID, name, products.description, barcode, priceCents, previousPriceCents,
			weightGrams, productJSON, products.departmentID, departments.description, products.updated
		FROM products
		LEFT JOIN departments ON products.departmentID = departments.departmentID
		WHERE productID = ? LIMIT 1`, productID).Scan(
		&p.ID, &p.Info.DisplayName, &p.Info.Description, &p.Info.Barcode,
		&p.Info.Price, &p.PreviousPrice, &p.Info.UnitWeightInGrams,
		&p.RawJSON, &p.departmentID, &deptDesc, &p.Updated)
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

func (w *Woolworths) loadDepartmentInfoList() ([]departmentInfo, error) {
	var depts []departmentInfo
	rows, err := w.db.Query("SELECT departmentID, description, productCount, updated FROM departments")
	if err != nil {
		return depts, fmt.Errorf("failed to query departments: %w", err)
	}
	for rows.Next() {
		var d departmentInfo
		if err = rows.Scan(&d.NodeID, &d.Description, &d.ProductCount, &d.Updated); err != nil {
			return depts, fmt.Errorf("failed to scan department: %w", err)
		}
		depts = append(depts, d)
	}
	return depts, nil
}
