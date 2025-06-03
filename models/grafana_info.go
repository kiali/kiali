package models

// GrafanaInfo provides information to access Grafana dashboards
type GrafanaInfo struct {
	DatasourceUID string         `json:"datasourceUID,omitempty"`
	ExternalLinks []ExternalLink `json:"externalLinks"`
}
