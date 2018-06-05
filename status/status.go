// status is a simple package for offering up various status information from Kiali.
package status

const (
	name           = "Kiali"
	ConsoleVersion = name + " console version"
	CoreVersion    = name + " core version"
	CoreCommitHash = name + " core commit hash"
	State          = name + " state"
	StateRunning   = "running"
)

type StatusInfo struct {
	Status           map[string]string     `json:"status"`
	ExternalServices []ExternalServiceInfo `json:"externalServices"`
	WarningMessages  []string              `json:"warningMessages"`
}

var info StatusInfo

type ExternalServiceInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
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

// Get returns a copy of the current status info.
func Get() (status StatusInfo) {
	info.ExternalServices = []ExternalServiceInfo{}
	info.WarningMessages = []string{}
	getVersions()
	return info
}
