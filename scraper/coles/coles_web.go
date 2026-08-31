package coles

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"basketwise/scraper/internal/utils"
)

const DEFAULT_API_VERSION = "20240827.02_v4.7.7"
const BROWSE_JSON_URL_FORMAT = "%s/_next/data/%s/en/browse.json"
const BROWSE_HOMEPAGE_URL_FORMAT = "%s/browse"
const CATEGORY_URL_FORMAT = "%s/_next/data/%s/en/browse/%s.json"
const SCRAPE_TRAP_STRING = "Pardon Our Interruption"

var ErrHitScrapeTrap = errors.New("caught in a scrape trap")

func (c *Coles) updateAPIVersion() error {
	body, err := c.getBrowseHomepage()
	if err != nil {
		return fmt.Errorf("failed to get homepage: %w", err)
	}
	newAPI, err := extractAPIVersion(body)
	if err != nil {
		if writeErr := utils.WriteEntireFile("failed_coles_homepage.html", body); writeErr != nil {
			slog.Error("Failed to write failed homepage to file", "error", writeErr)
		}
		return fmt.Errorf("failed to extract API version: %w", err)
	}
	if newAPI != c.colesAPIVersion {
		slog.Info("Updated API version", "old_version", c.colesAPIVersion, "version", newAPI)
		c.colesAPIVersion = newAPI
	}
	return nil
}

func (c *Coles) getBrowseHomepage() ([]byte, error) {
	url := fmt.Sprintf(BROWSE_HOMEPAGE_URL_FORMAT, c.baseURL)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0")
	req.Header.Set("Accept", "text/html")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get homepage: %s", resp.Status)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if checkForScrapeTrap(body) {
		return body, ErrHitScrapeTrap
	}
	return body, nil
}

func extractAPIVersion(body []byte) (string, error) {
	r := regexp.MustCompile(`"buildId":"([^"]+)"`)
	matches := r.FindSubmatch(body)
	if len(matches) != 2 {
		return "", fmt.Errorf("failed to find API version in body")
	}
	return string(matches[1]), nil
}

func (c *Coles) getBrowseJSON() ([]byte, error) {
	url := fmt.Sprintf(BROWSE_JSON_URL_FORMAT, c.baseURL, c.colesAPIVersion)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0")
	req.Header.Set("Accept", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get browse JSON: %s", resp.Status)
	}
	return io.ReadAll(resp.Body)
}

func (c *Coles) getCategoryJSON(category string, page int) ([]byte, error) {
	url := fmt.Sprintf(CATEGORY_URL_FORMAT, c.baseURL, c.colesAPIVersion, category)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	q := req.URL.Query()
	q.Add("slug", category)
	q.Add("page", strconv.Itoa(page))
	req.URL.RawQuery = q.Encode()

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0")
	req.Header.Set("Accept", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get category %s page %d: %s", category, page, resp.Status)
	}
	return io.ReadAll(resp.Body)
}

func checkForScrapeTrap(body []byte) bool {
	return bytes.Contains(body, []byte(SCRAPE_TRAP_STRING))
}

func (c *Coles) getCategoryContents(category string, page int) (categoryPage, error) {
	body, err := c.getCategoryJSON(category, page)
	if err != nil {
		return categoryPage{}, err
	}
	var catPage categoryPage
	if err = json.Unmarshal(body, &catPage); err != nil {
		return categoryPage{}, fmt.Errorf("failed to unmarshal category page: %w", err)
	}
	return catPage, nil
}

func (c *Coles) getProductsAndTotalCountForCategoryPage(dp departmentPage) ([]colesProductInfo, int, error) {
	catPage, err := c.getCategoryContents(dp.ID, dp.page)
	if err != nil {
		return nil, 0, err
	}
	var products []colesProductInfo
	for _, result := range catPage.PageProps.SearchResults.Results {
		if result.Type == "PRODUCT" {
			product := colesProductInfo{
				Info:         result,
				departmentID: dp.ID,
				ID:           productID(strconv.Itoa(result.ID)),
				Updated:      time.Now(),
			}
			product.RawJSON, err = json.Marshal(result)
			if err != nil {
				slog.Warn("Failed to marshal product info for storage", "error", err)
			}
			products = append(products, product)
		}
	}
	return products, catPage.PageProps.SearchResults.NoOfResults, nil
}

func (c *Coles) getDepartmentInfos() ([]departmentInfo, error) {
	body, err := c.getBrowseJSON()
	if err != nil {
		return nil, err
	}
	var browseJSON browsePage
	if err = json.Unmarshal(body, &browseJSON); err != nil {
		return nil, fmt.Errorf("failed to unmarshal browse JSON: %w", err)
	}
	return browseJSON.PageProps.AllProductCategories.CatalogGroupView, nil
}
