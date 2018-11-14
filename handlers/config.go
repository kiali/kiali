package handlers

import (
	"net/http"

	"github.com/kiali/kiali/config"
)

// PublicConfig is a subset of Kiali configuration that can be exposed to clients to
// help them interact with the system.
type PublicConfig struct {
	AuthStrategy   string             `json:"authStrategy,omitempty"`
	IstioNamespace string             `json:"istioNamespace,omitempty"`
	IstioLabels    config.IstioLabels `json:"istioLabels,omitempty"`
}

// GraphNamespace is a REST http.HandlerFunc handling namespace-wide graph
// config generation.
func Config(w http.ResponseWriter, r *http.Request) {
	defer handlePanic(w)

	config := config.Get()
	publicConfig := PublicConfig{
		AuthStrategy:   config.AuthStrategy,
		IstioNamespace: config.IstioNamespace,
		IstioLabels:    config.IstioLabels,
	}

	RespondWithJSONIndent(w, http.StatusOK, publicConfig)
}
