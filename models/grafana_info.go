package models

import "github.com/kiali/kiali/config"

// GrafanaInfo provides information to access Grafana dashboards
type GrafanaInfo struct {
	Dashboards []GrafanaDashboardInfo `json:"dashboards"`
}

type GrafanaDashboardInfo struct {
	URL       string                        `json:"url"`
	Name      string                        `json:"name"`
	Variables config.GrafanaVariablesConfig `json:"variables"`
}
