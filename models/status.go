package models

import (
	"github.com/kiali/kiali/config"
)

// Status response model
// This is used for returning a response of Kiali Status
// swagger:model externalServiceInfo
type ExternalServiceInfo struct {
	// The name of the service
	//
	// required: true
	// example: Istio
	Name string `json:"name"`

	// The installed version of the service
	//
	// required: false
	// example: 0.8.0
	Version string `json:"version,omitempty"`

	// The service url
	//
	// required: false
	// example: jaeger-query-istio-system.127.0.0.1.nip.io
	Url string `json:"url,omitempty"`

	TempoConfig config.TempoConfig `json:"tempoConfig,omitempty"`
}
