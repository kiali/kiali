// status is a simple package for offering up various status information from Kiali.
package status

import (
	"strings"
	"sync"

	"github.com/kiali/kiali/config"
)

const (
	name             = "Kiali"
	ContainerVersion = name + " container version"
	CoreVersion      = name + " version"
	MeshName         = "Mesh name"
	MeshVersion      = "Mesh version"
	CoreCommitHash   = name + " commit hash"
	State            = name + " state"
	ClusterMTLS      = "Istio mTLS"
	StateRunning     = "running"
	DisabledFeatures = "Disabled features"
	MTLSVersion      = "mTLS Version"
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
	ExternalServices []ExternalServiceInfo `json:"externalServices"`
	// An array of warningMessages. CAUTION: Please read the doc comments the in AddWarningMessages func.
	// items.example: Istio version 0.7.1 is not supported, the version should be 0.8.0
	// swagger:allOf
	WarningMessages []string `json:"warningMessages"`
	// Information about the Istio implementation environment
	//
	// required: true
	IstioEnvironment *IstioEnvironment `json:"istioEnvironment"`
}

// info is a global var that contains information about Kiali status and what external services are available
var info StatusInfo

// global lock to prevent panic when multiple goroutines to write map
var rw sync.RWMutex

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

func init() {
	info = StatusInfo{Status: make(map[string]string)}
	info.Status[State] = StateRunning
}

// Put adds or replaces status info for the provided name. Any previous setting is returned.
func Put(name, value string) (previous string, hasPrevious bool) {
	rw.Lock()
	defer rw.Unlock()
	previous, hasPrevious = info.Status[name]
	info.Status[name] = value
	return previous, hasPrevious
}

// GetStatus get status with name, it is read safe.
func GetStatus(name string) (previous string, hasPrevious bool) {
	rw.RLock()
	defer rw.RUnlock()
	previous, hasPrevious = info.Status[name]
	return previous, hasPrevious
}

// AddWarningMessages add warning messages to status
// CAUTION: Currently, the UI assumes that the only messages passed to this
// function are the result of Istio version checks (see the istioVersion func of versions.go file)
// and the UI will show any logged warnings in the About dialog. Furthermore, the UI assumes the
// array will contain a single message.
// If in the future other kind of warnings need to be logged, please adjust UI code as needed.
func AddWarningMessages(warningMessages string) {
	info.WarningMessages = append(info.WarningMessages, warningMessages)
}

// Get returns a copy of the current status info.
func Get() (status StatusInfo) {
	info.ExternalServices = []ExternalServiceInfo{}
	info.WarningMessages = []string{}

	cfg := config.Get()
	if len(cfg.KialiFeatureFlags.DisabledFeatures) > 0 {
		Put(DisabledFeatures, strings.Join(cfg.KialiFeatureFlags.DisabledFeatures, ","))
	}

	getVersions()

	// we only need to get the IstioEnvironment one time - its content is static and will never change
	if info.IstioEnvironment == nil {
		info.IstioEnvironment = &IstioEnvironment{
			IstioAPIEnabled: cfg.ExternalServices.Istio.IstioAPIEnabled,
		}
	}

	return info
}
