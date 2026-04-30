package models

import (
	"regexp"
	"time"

	"github.com/kiali/kiali/config"
)

const (
	IstioClusterTag string = "istio.cluster_id"

	// MaxTracingLimit is the upper bound for trace query limit parameters.
	MaxTracingLimit = 10000
)

// ValidTraceIDRe validates trace IDs: 1-32 hexadecimal characters (Jaeger/Tempo compatible).
var ValidTraceIDRe = regexp.MustCompile(`^[a-fA-F0-9]{1,32}$`)

type TracingInfo struct {
	Enabled              bool               `json:"enabled"`
	Integration          bool               `json:"integration"`
	InternalURL          string             `json:"internalURL"`
	Provider             string             `json:"provider"`
	TempoConfig          config.TempoConfig `json:"tempoConfig"`
	URL                  string             `json:"url"`
	NamespaceSelector    bool               `json:"namespaceSelector"`
	UseWaypointName      bool               `json:"useWaypointName"`
	WhiteListIstioSystem []string           `json:"whiteListIstioSystem"`
}

type TracingQuery struct {
	Start       time.Time
	End         time.Time
	Tags        map[string]string
	MinDuration time.Duration
	Limit       int
	Cluster     string
}
