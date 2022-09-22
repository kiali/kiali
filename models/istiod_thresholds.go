package models

// IstiodThresholds contains the resource limits configured in Istiod
type IstiodThresholds struct {
	Memory float64 `json:"memory"`
	CPU    float64 `json:"cpu"`
}
