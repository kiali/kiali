package promconfig

// The valid auth strategies and values for cookie handling
const (
	// These constants are used for external services auth (Prometheus, Grafana ...) ; not for Kiali auth
	AuthTypeBasic  = "basic"
	AuthTypeBearer = "bearer"
	AuthTypeNone   = "none"
)

// PrometheusConfig describes configuration of the Prometheus component
type PrometheusConfig struct {
	URL  string `yaml:"url"`
	Auth Auth   `yaml:"auth"`
}

// Auth provides authentication data for external services
type Auth struct {
	Type               string `yaml:"type"`
	Username           string `yaml:"username"`
	Password           string `yaml:"password"`
	Token              string `yaml:"token"`
	CAFile             string `yaml:"ca_file"`
	InsecureSkipVerify bool   `yaml:"insecure_skip_verify"`
}
