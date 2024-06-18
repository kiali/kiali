package models

// OutboundPolicy contains information egress traffic permissions
type OutboundPolicy struct {
	Mode string `yaml:"mode" json:"mode"`
}
