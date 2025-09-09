// status is a simple package for offering up various status information from Kiali.
package status

import (
	"context"
	"strings"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
)

const (
	name             = "Kiali"
	containerVersion = name + " container version"
	coreVersion      = name + " version"
	coreCommitHash   = name + " commit hash"
	state            = name + " state"
	stateRunning     = "running"
	disabledFeatures = "Disabled features"
)

// IstioEnvironment describes the Istio implementation environment
type IstioEnvironment struct {
	// Is api enabled
	IstioAPIEnabled bool `json:"istioAPIEnabled"`
}

// StatusInfo statusInfo
// This is used for returning a response of Kiali Status
// swagger:model StatusInfo
type StatusInfo struct {
	// The state of Kiali
	// A hash of key,values with versions of Kiali and state
	//
	// required: true
	Status map[string]string `json:"status"`
	// An array of external services installed
	//
	// required: true
	// swagger:allOf
	ExternalServices []models.ExternalServiceInfo `json:"externalServices"`
	// An array of warningMessages. CAUTION: Please read the doc comments the in AddWarningMessages func.
	// items.example: Istio version 0.7.1 is not supported, the version should be 0.8.0
	// swagger:allOf
	WarningMessages []string `json:"warningMessages"`
	// Information about the Istio implementation environment
	//
	// required: true
	IstioEnvironment *IstioEnvironment `json:"istioEnvironment"`
}

// addWarningMessages add warning messages to status
// CAUTION: Currently, the UI assumes that the only messages passed to this
// function are the result of Istio version checks (see the istioVersion func of versions.go file)
// and the UI will show any logged warnings in the About dialog. Furthermore, the UI assumes the
// array will contain a single message.
// If in the future other kind of warnings need to be logged, please adjust UI code as needed.
// func addWarningMessages(warningMessages string) {
// 	info.WarningMessages = append(info.WarningMessages, warningMessages)
// }

// Get returns a copy of the current status info.
func Get(ctx context.Context, conf *config.Config, clientFactory kubernetes.ClientFactory, cache cache.KialiCache, grafana *grafana.Service, perses *perses.Service, prom prometheus.ClientInterface) StatusInfo {
	buildInfo := cache.GetBuildInfo()
	info := StatusInfo{
		ExternalServices: []models.ExternalServiceInfo{},
		IstioEnvironment: &IstioEnvironment{
			IstioAPIEnabled: conf.ExternalServices.Istio.IstioAPIEnabled,
		},
		Status: map[string]string{
			containerVersion: buildInfo.ContainerVersion,
			coreVersion:      buildInfo.Version,
			coreCommitHash:   buildInfo.CommitHash,
			disabledFeatures: strings.Join(conf.KialiFeatureFlags.DisabledFeatures, ","),
			state:            stateRunning,
		},
		// TODO: Do we need warning messages anymore?
		WarningMessages: []string{},
	}

	info.ExternalServices = getVersions(ctx, conf, clientFactory, grafana, perses, prom)

	return info
}
