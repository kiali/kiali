package models

import (
	kmodel "github.com/kiali/k-charted/model"
)

// GrafanaInfo provides information to access Grafana dashboards
type GrafanaInfo struct {
	ExternalLinks []kmodel.ExternalLink `json:"externalLinks"`
}
