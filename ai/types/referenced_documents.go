package types

// ReferencedDoc is an item in end.referenced_documents.
type ReferencedDoc struct {
	DocTitle string `json:"doc_title"`
	DocURL   string `json:"doc_url"`
}
