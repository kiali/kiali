// status is a simple package for offering up various status information from Kiali.
package status

const (
	name             = "Kiali"
	ContainerVersion = name + " container version"
	ConsoleVersion   = name + " console version"
	CoreVersion      = name + " core version"
	MeshName         = "Mesh name"
	MeshVersion      = "Mesh version"
	IsCompatible     = "compatibility"
	CoreCommitHash   = name + " core commit hash"
	State            = name + " state"
	ClusterMTLS      = "Istio mTLS"
	StateRunning     = "running"
)

// IstioEnvironment describes the Istio implementation environment
type IstioEnvironment struct {
	// If true, the Istio implementation is a variant of Maistra.
	//
	// required: true
	IsMaistra bool `json:"isMaistra"`
}

// StatusInfo statusInfo
//
// This is used for returning a response of Kiali Status
//
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
	// An array of warningMessages
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

// Status response model
//
// This is used for returning a response of Kiali Status
//
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
}

func init() {
	info = StatusInfo{Status: make(map[string]string)}
	info.Status[State] = StateRunning
}

// Put adds or replaces status info for the provided name. Any previous setting is returned.
func Put(name, value string) (previous string, hasPrevious bool) {
	previous, hasPrevious = info.Status[name]
	info.Status[name] = value
	return previous, hasPrevious
}

// AddWarningMessages add warning messages to status
func AddWarningMessages(warningMessages string) {
	info.WarningMessages = append(info.WarningMessages, warningMessages)
}

// Get returns a copy of the current status info.
func Get() (status StatusInfo) {
	info.ExternalServices = []ExternalServiceInfo{}
	info.WarningMessages = []string{}
	getVersions()

	// we only need to get the IstioEnvironment one time - its content is static and will never change
	if info.IstioEnvironment == nil {
		isMaistra := false
		for _, esi := range info.ExternalServices {
			if isMaistraExternalService(&esi) {
				isMaistra = true
				break
			}
		}
		info.IstioEnvironment = &IstioEnvironment{
			IsMaistra: isMaistra,
		}
	}

	return info
}

// IsMaistra returns true if we are running in a Maistra environment
func IsMaistra() bool {
	if info.IstioEnvironment == nil {
		Get()
	}
	return info.IstioEnvironment.IsMaistra
}
