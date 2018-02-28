package models

// GrafanaInfo provides information to access Grafana dashboards
type GrafanaInfo struct {
	URL              string `json:"url"`
	VariablesSuffix  string `json:"variablesSuffix"`
	Dashboard        string `json:"dashboard"`
	VarServiceSource string `json:"varServiceSource"`
	VarServiceDest   string `json:"varServiceDest"`
}
