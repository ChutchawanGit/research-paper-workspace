package pdf

import (
	"bytes"
	"io"
	"os"
	"regexp"
	"strconv"
)

var (
	pageRegex  = regexp.MustCompile(`/Type\s*/Page[^s]`)
	countRegex = regexp.MustCompile(`/Count\s+(\d+)`)
)

func EstimatePageCount(filePath string) (int, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return 1, err
	}
	defer file.Close()

	buf := make([]byte, 1024*1024) // Read first 1MB
	n, _ := file.Read(buf)
	data := buf[:n]

	// Check /Count in catalog
	matches := countRegex.FindSubmatch(data)
	if len(matches) > 1 {
		count, err := strconv.Atoi(string(matches[1]))
		if err == nil && count > 0 {
			return count, nil
		}
	}

	// Seek to end to check trailer
	stat, err := file.Stat()
	if err == nil && stat.Size() > 1024*1024 {
		_, _ = file.Seek(-1024*1024, io.SeekEnd)
		n, _ = file.Read(buf)
		data = buf[:n]
		matches = countRegex.FindSubmatch(data)
		if len(matches) > 1 {
			count, err := strconv.Atoi(string(matches[1]))
			if err == nil && count > 0 {
				return count, nil
			}
		}
	}

	// Fallback: scan whole file for /Type /Page
	_, _ = file.Seek(0, io.SeekStart)
	all, err := io.ReadAll(file)
	if err != nil {
		return 1, nil
	}
	pageMatches := pageRegex.FindAll(all, -1)
	if len(pageMatches) > 0 {
		return len(pageMatches), nil
	}

	// Double check count in all data
	allMatches := countRegex.FindAllSubmatch(all, -1)
	for i := len(allMatches) - 1; i >= 0; i-- {
		if len(allMatches[i]) > 1 {
			count, err := strconv.Atoi(string(allMatches[i][1]))
			if err == nil && count > 0 {
				return count, nil
			}
		}
	}

	return 1, nil
}

// CleanTitle generates a clean title from filename if title is missing
func CleanTitle(filename string) string {
	b := []byte(filename)
	b = bytes.TrimSuffix(b, []byte(".pdf"))
	b = bytes.ReplaceAll(b, []byte("_"), []byte(" "))
	b = bytes.ReplaceAll(b, []byte("-"), []byte(" "))
	return string(bytes.TrimSpace(b))
}
