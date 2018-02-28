package models

// GrafanaInfo provides information to access Grafana dashboards
type GrafanaInfo struct {
	URL             string `json:"url"`
	VariablesSuffix string `json:"variablesSuffix"`
}
