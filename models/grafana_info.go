package models

// GrafanaInfo provides information to access Grafana dashboards
type GrafanaInfo struct {
	ExternalLinks []ExternalLink `json:"externalLinks"`
}
