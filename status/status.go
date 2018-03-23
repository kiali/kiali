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

type StatusInfo map[string]string

var info StatusInfo

func init() {
	info = StatusInfo(make(map[string]string))
	info[State] = StateRunning
}

// Put adds or replaces status info for the provided name. Any previous setting is returned.
func Put(name, value string) (previous string, hasPrevious bool) {
	previous, hasPrevious = info[name]
	info[name] = value
	return previous, hasPrevious
}

// Get returns a copy of the current status info.
func Get() (status StatusInfo) {
	return info
}
