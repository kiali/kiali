package get_citations

import (
	"embed"
	"encoding/json"
	"net/http"
	"sort"
	"strings"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

//go:embed documents.json
var documentsFS embed.FS

// Document represents a single document entry from documents.json
type Document struct {
	ID          string   `json:"id"`
	Keywords    []string `json:"keywords"`
	URL         string   `json:"url"`
	Title       string   `json:"title"`
	Domain      string   `json:"domain,omitempty"` // Domain is added during loading
	Description string   `json:"description,omitempty"`
}

// documentsByDomain represents the structure of documents.json
type documentsByDomain struct {
	Kiali []Document `json:"kiali,omitempty"`
	Istio []Document `json:"istio,omitempty"`
}

// GetCitationsResponse encapsulates the citations tool response.
type GetCitationsResponse struct {
	Citations []Citation `json:"citations,omitempty"`
	Errors    string     `json:"errors,omitempty"`
}

// documentMatch represents a document with its match count
type documentMatch struct {
	document   Document
	matchCount int
}

func Execute(r *http.Request, args map[string]interface{}, business *business.Layer, conf *config.Config) (interface{}, int) {
	keywordsStr := mcputil.GetStringArg(args, "keywords")
	if keywordsStr == "" {
		return GetCitationsResponse{
			Citations: []Citation{},
			Errors:    "keywords parameter is required and must be a string",
		}, http.StatusBadRequest
	}

	// Parse comma-separated keywords
	keywords := strings.Split(keywordsStr, ",")
	inputKeywords := make([]string, 0, len(keywords))
	for _, kw := range keywords {
		trimmed := strings.TrimSpace(kw)
		if trimmed != "" {
			inputKeywords = append(inputKeywords, trimmed)
		}
	}

	if len(inputKeywords) == 0 {
		return GetCitationsResponse{
			Citations: []Citation{},
			Errors:    "no valid keywords provided",
		}, http.StatusBadRequest
	}

	// Get domain parameter (optional)
	domain := ""
	if domainStr := mcputil.GetStringArg(args, "domain"); domainStr != "" {
		domain = strings.ToLower(strings.TrimSpace(domainStr))
	}

	// Load documents filtered by domain
	documents, err := loadDocuments(domain)
	if err != nil {
		log.Errorf("Failed to load documents.json: %v", err)
		return GetCitationsResponse{
			Citations: []Citation{},
			Errors:    "Failed to load documents: " + err.Error(),
		}, http.StatusInternalServerError
	}

	// Find top 3 matches
	topMatches := findTopMatches(documents, inputKeywords, 3)

	// Convert to citations
	citations := make([]Citation, len(topMatches))
	for i, doc := range topMatches {
		citations[i] = Citation{
			Link:  doc.URL,
			Title: doc.Title,
			Body:  doc.Description, // Body can be empty or populated from the document if needed
		}
	}

	resp := GetCitationsResponse{
		Citations: citations,
		Errors:    "",
	}

	return resp, http.StatusOK
}

// loadDocuments loads and parses the documents.json file, optionally filtered by domain
func loadDocuments(domain string) ([]Document, error) {
	data, err := documentsFS.ReadFile("documents.json")
	if err != nil {
		return nil, err
	}

	var docsByDomain documentsByDomain
	if err := json.Unmarshal(data, &docsByDomain); err != nil {
		return nil, err
	}

	var documents []Document

	// Add Kiali documents if domain is empty, "kiali", or "all"
	if domain == "kiali" || domain == "all" || domain == "" {
		for _, doc := range docsByDomain.Kiali {
			doc.Domain = "kiali"
			documents = append(documents, doc)
		}
	}

	// Add Istio documents if domain is empty, "istio", or "all"
	if domain == "istio" || domain == "all" || domain == "" {
		for _, doc := range docsByDomain.Istio {
			doc.Domain = "istio"
			documents = append(documents, doc)
		}
	}

	return documents, nil
}

// normalizeIDForMatching normalizes a document ID by replacing "-" with spaces for matching
func normalizeIDForMatching(id string) string {
	normalized := strings.ToLower(strings.TrimSpace(id))
	// Replace "-" with spaces
	normalized = strings.ReplaceAll(normalized, "-", " ")
	return normalized
}

// countKeywordMatches counts how many keywords from the input match the document's keywords and ID
// ID matches are weighted higher (count as 2) to prioritize documents with matching IDs
func countKeywordMatches(inputKeywords []string, documentKeywords []string, documentID string) int {
	matchCount := 0
	inputLower := make([]string, len(inputKeywords))
	for i, kw := range inputKeywords {
		inputLower[i] = strings.ToLower(strings.TrimSpace(kw))
	}

	// Normalize document ID for matching (replace "-" with spaces)
	normalizedID := normalizeIDForMatching(documentID)

	// Check for ID matches first (weighted higher - counts as 2 points)
	idMatched := false
	for _, inputKw := range inputLower {
		// Check if input keyword matches the normalized ID (exact match or substring)
		if inputKw == normalizedID || strings.Contains(normalizedID, inputKw) || strings.Contains(inputKw, normalizedID) {
			matchCount += 2 // ID matches count as 2 points to increase priority
			idMatched = true
			break // Count ID match only once per document
		}
	}

	// Check keyword matches
	docLower := make([]string, len(documentKeywords))
	for i, kw := range documentKeywords {
		docLower[i] = strings.ToLower(strings.TrimSpace(kw))
	}

	// Also include normalized ID as a keyword for matching
	docLower = append(docLower, normalizedID)

	for _, inputKw := range inputLower {
		// Skip if this keyword already matched the ID (to avoid double counting)
		if idMatched && (inputKw == normalizedID || strings.Contains(normalizedID, inputKw) || strings.Contains(inputKw, normalizedID)) {
			continue
		}
		for _, docKw := range docLower {
			// Check for exact match or if input keyword contains document keyword or vice versa
			if inputKw == docKw || strings.Contains(inputKw, docKw) || strings.Contains(docKw, inputKw) {
				matchCount++
				break // Count each input keyword only once per document
			}
		}
	}

	return matchCount
}

// findTopMatches finds the top N documents with the most keyword matches
func findTopMatches(documents []Document, inputKeywords []string, topN int) []Document {
	var matches []documentMatch

	for _, doc := range documents {
		matchCount := countKeywordMatches(inputKeywords, doc.Keywords, doc.ID)
		if matchCount > 0 {
			matches = append(matches, documentMatch{
				document:   doc,
				matchCount: matchCount,
			})
		}
	}

	// Sort by match count (descending), then by title for consistency
	sort.Slice(matches, func(i, j int) bool {
		if matches[i].matchCount != matches[j].matchCount {
			return matches[i].matchCount > matches[j].matchCount
		}
		return matches[i].document.Title < matches[j].document.Title
	})

	// Return top N matches
	resultCount := topN
	if len(matches) < topN {
		resultCount = len(matches)
	}

	result := make([]Document, resultCount)
	for i := 0; i < resultCount; i++ {
		result[i] = matches[i].document
	}

	return result
}
