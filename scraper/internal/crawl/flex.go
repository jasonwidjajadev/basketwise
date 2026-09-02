package crawl

import (
	"encoding/json"
	"strconv"
	"strings"
)

// FlexString decodes JSON string/number/bool/null into a string.
type FlexString string

func (f *FlexString) UnmarshalJSON(b []byte) error {
	t := strings.TrimSpace(string(b))
	if t == "null" {
		*f = ""
		return nil
	}
	if len(t) > 0 && t[0] == '"' {
		var s string
		if err := json.Unmarshal(b, &s); err != nil {
			return err
		}
		*f = FlexString(s)
		return nil
	}
	*f = FlexString(t)
	return nil
}

func (f FlexString) String() string { return string(f) }

func (f FlexString) Float() float64 {
	v, _ := strconv.ParseFloat(strings.TrimSpace(string(f)), 64)
	return v
}

// FlexFloat decodes number/string/null into float64.
type FlexFloat float64

func (f *FlexFloat) UnmarshalJSON(b []byte) error {
	t := strings.Trim(strings.TrimSpace(string(b)), `"`)
	if t == "null" || t == "" {
		*f = 0
		return nil
	}
	v, err := strconv.ParseFloat(t, 64)
	if err != nil {
		*f = 0
		return nil
	}
	*f = FlexFloat(v)
	return nil
}

// FlexInt decodes number/string/null into int.
type FlexInt int

func (f *FlexInt) UnmarshalJSON(b []byte) error {
	var ff FlexFloat
	if err := ff.UnmarshalJSON(b); err != nil {
		return err
	}
	*f = FlexInt(int(ff))
	return nil
}

// FirstJSONString parses a JSON-encoded string array and returns element 0.
func FirstJSONString(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	var arr []string
	if err := json.Unmarshal([]byte(s), &arr); err == nil && len(arr) > 0 {
		return arr[0]
	}
	return ""
}
