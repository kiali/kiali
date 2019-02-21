package config

import (
	"encoding/json"
	"io/ioutil"
	"path/filepath"

	"github.com/kiali/kiali/log"
)

// PublicConfig is a subset of Kiali configuration that can be exposed to clients to help them interact with the system.
// !! WARNING !! MAKE SURE IT ALWAYS MATCHES DEFINITION IN kiali-ui/public/env.js to avoid nasty surprise (used in dev mode)
type PublicConfig struct {
	IstioNamespace string           `json:"istioNamespace,omitempty"`
	IstioLabels    IstioLabels      `json:"istioLabels,omitempty"`
	Prometheus     PrometheusConfig `json:"prometheus,omitempty"`
	WebRoot        string           `json:"webRoot,omitempty"`
}

// PrometheusConfig holds actual Prometheus configuration that is useful to Kiali.
// All durations are in seconds.
type PrometheusConfig struct {
	GlobalScrapeInterval int64 `json:"globalScrapeInterval,omitempty"`
	StorageTsdbRetention int64 `json:"storageTsdbRetention,omitempty"`
}

// ToEnvJS writes this PublicConfig to "console/env.js"
func (cfg *PublicConfig) ToEnvJS() error {
	log.Info("Generating env.js from config")

	jsonConfig, err := json.Marshal(cfg)
	if err != nil {
		return err
	}

	path, err := filepath.Abs("./console/env.js")
	if err != nil {
		return err
	}

	var buf []byte
	buf = append(buf, "window.serverConfig="...)
	buf = append(buf, jsonConfig...)
	buf = append(buf, ';')

	log.Debugf("The content of %s will be:\n%s", path, string(buf))

	return ioutil.WriteFile(path, buf, 0)
}
