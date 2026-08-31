package utils

import "os"

func WriteEntireFile(path string, data []byte) error {
	return os.WriteFile(path, data, 0644)
}

func ReadEntireFile(path string) ([]byte, error) {
	return os.ReadFile(path)
}
