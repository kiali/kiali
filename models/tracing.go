package models

import (
	"time"

	"github.com/kiali/kiali/config"
)

const (
	IstioClusterTag string = "istio.cluster_id"
)

type TracingInfo struct {
	Enabled              bool               `json:"enabled"`
	Integration          bool               `json:"integration"`
	Provider             string             `json:"provider"`
	TempoConfig          config.TempoConfig `json:"tempoConfig"`
	URL                  string             `json:"url"`
	NamespaceSelector    bool               `json:"namespaceSelector"`
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
