package models

// PersesInfo provides information to access Perses dashboards
type PersesInfo struct {
	ExternalLinks []ExternalLink `json:"externalLinks"`
	Project       string         `json:"project,omitempty"`
}
