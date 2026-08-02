package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/kiali/kiali/util/polltest"
)

// writeTestConfigFile writes the given YAML content to a new temp file and returns its path.
func writeTestConfigFile(t *testing.T, content string) string {
	t.Helper()
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "kiali-config.yaml")
	if err := os.WriteFile(tmpFile, []byte(content), 0o600); err != nil {
		t.Fatalf("Failed to write temp config file: %v", err)
	}
	return tmpFile
}

func TestConfigWatcher_AppliesDisabledFeaturesOnChange(t *testing.T) {
	path := writeTestConfigFile(t, "login_token:\n  signing_key: \"0123456789abcdef\"\nkiali_feature_flags:\n  disabled_features: []\n")

	initial, err := LoadFromFile(path)
	if err != nil {
		t.Fatalf("Failed to load initial config: %v", err)
	}
	t.Cleanup(initial.Close)
	Set(initial)

	watcher, err := NewConfigWatcher(path)
	if err != nil {
		t.Fatalf("Failed to create ConfigWatcher: %v", err)
	}
	t.Cleanup(watcher.Close)

	if got := Get().KialiFeatureFlags.DisabledFeatures; len(got) != 0 {
		t.Fatalf("Expected no disabled features initially, got: %v", got)
	}

	if err := os.WriteFile(path, []byte("login_token:\n  signing_key: \"0123456789abcdef\"\nkiali_feature_flags:\n  disabled_features: [\"logs-tab\"]\n"), 0o600); err != nil {
		t.Fatalf("Failed to update config file: %v", err)
	}

	updated := polltest.PollForCondition(t, 2*time.Second, func() bool {
		flags := Get().KialiFeatureFlags.DisabledFeatures
		return len(flags) == 1 && flags[0] == "logs-tab"
	})
	if !updated {
		t.Errorf("Expected hot reload to pick up updated disabled_features, got: %v", Get().KialiFeatureFlags.DisabledFeatures)
	}
}

func TestConfigWatcher_IgnoresNonHotReloadableFieldChanges(t *testing.T) {
	path := writeTestConfigFile(t, "login_token:\n  signing_key: \"0123456789abcdef\"\nauth:\n  strategy: token\n")

	initial, err := LoadFromFile(path)
	if err != nil {
		t.Fatalf("Failed to load initial config: %v", err)
	}
	t.Cleanup(initial.Close)
	Set(initial)

	// Keep a reference to the live CredentialManager: it must survive reloads.
	liveCreds := Get().Credentials

	watcher, err := NewConfigWatcher(path)
	if err != nil {
		t.Fatalf("Failed to create ConfigWatcher: %v", err)
	}
	t.Cleanup(watcher.Close)

	// Changing a non-allowlisted field (server.web_root) should NOT be applied by the watcher --
	// it requires a restart. Give the watcher a chance to (not) act, then assert no change.
	if err := os.WriteFile(path, []byte("login_token:\n  signing_key: \"0123456789abcdef\"\nauth:\n  strategy: token\nserver:\n  web_root: /new-root\n"), 0o600); err != nil {
		t.Fatalf("Failed to update config file: %v", err)
	}

	// There's nothing to poll for since we expect no change, so just wait past the debounce
	// window and confirm the live config (and its CredentialManager) are unaffected.
	time.Sleep(hotReloadDebounce + 200*time.Millisecond)

	if got := Get().Server.WebRoot; got == "/new-root" {
		t.Errorf("Expected server.web_root to NOT be hot-reloaded (restart required to change it), got [%s]", got)
	}
	if Get().Credentials != liveCreds {
		t.Errorf("Expected the live CredentialManager to be preserved across a hot reload attempt")
	}
}

func TestConfigWatcher_InvalidFileIsIgnored(t *testing.T) {
	path := writeTestConfigFile(t, "login_token:\n  signing_key: \"0123456789abcdef\"\nkiali_feature_flags:\n  disabled_features: []\n")

	initial, err := LoadFromFile(path)
	if err != nil {
		t.Fatalf("Failed to load initial config: %v", err)
	}
	t.Cleanup(initial.Close)
	Set(initial)

	watcher, err := NewConfigWatcher(path)
	if err != nil {
		t.Fatalf("Failed to create ConfigWatcher: %v", err)
	}
	t.Cleanup(watcher.Close)

	if err := os.WriteFile(path, []byte("not: valid: yaml: [structure"), 0o600); err != nil {
		t.Fatalf("Failed to write invalid config file: %v", err)
	}

	// Give the watcher a chance to try (and fail) to reload; the previously applied
	// configuration should be untouched.
	time.Sleep(hotReloadDebounce + 200*time.Millisecond)

	if got := Get().KialiFeatureFlags.DisabledFeatures; len(got) != 0 {
		t.Errorf("Expected disabled_features to remain empty after an invalid file was written, got: %v", got)
	}
}
