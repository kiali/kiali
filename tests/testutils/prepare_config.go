package testutils

import (
	"testing"

	"github.com/kiali/kiali/config"
)

// GetConfigFromYaml provides a way for tests to write config as yaml. This gives a chance for tests to exercise the Unmarshal functionality.
// This also provides an easy way for tests to set up the config object correctly. This comes into play when, for example,
// you want cluster_wide_access set to false with discovery selectors set - the unmarshalling code this function utilizes will prepare the
// accessible namespaces thus freeing the test authors from having to remember to do that explicitly in the test code.
// This will provide easy-to-read failure log messages if the given yaml is malformed in some way (for easier debugging of test code).
func GetConfigFromYaml(t *testing.T, yaml string) *config.Config {
	if cfg, err := config.Unmarshal(yaml); err != nil {
		// mark the test as a failure; we'll keep going so the log will show what test failed
		t.Helper()
		t.Fatalf("Test provided invalid config YAML.\nERROR: %v\nYAML:%v", err, yaml)
		return &config.Config{InstallationTag: "TEST FAILED DUE TO INVALID YAML"}
	} else {
		return cfg
	}
}
