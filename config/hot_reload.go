package config

import (
	"path/filepath"
	"reflect"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"

	"github.com/kiali/kiali/log"
)

// hotReloadDebounce is the quiet period the watcher waits for filesystem events to
// settle before reloading the config file. This avoids reading the file while an
// editor or a Kubernetes ConfigMap projection is still mid-write, and collapses a
// burst of events (e.g. write+chmod, or several rapid saves) into a single reload.
const hotReloadDebounce = 300 * time.Millisecond

// ConfigWatcher watches the on-disk YAML configuration file given via --config and
// hot-reloads a small, explicit allowlist of fields that are safe to change without a
// pod/process restart. See applyHotReloadableFields for the exact list and rationale.
//
// Everything else in the file (auth, identity, Kubernetes/deployment topology, external
// service endpoints, credentials, TLS policy, etc.) is intentionally NOT re-applied here:
// those values are read once at startup and baked into long-lived objects (client
// factories, informer caches, the Prometheus/tracing/Grafana clients, the HTTP server,
// ...), so re-publishing the whole file would silently desync those objects from
// config.Get() without actually reconfiguring them. Changing those still requires a
// restart.
type ConfigWatcher struct {
	path      string
	watcher   *fsnotify.Watcher
	done      chan struct{}
	closeOnce sync.Once
}

// NewConfigWatcher creates and starts a ConfigWatcher for the given config file path.
// The returned watcher must be stopped with Close() during shutdown.
func NewConfigWatcher(path string) (*ConfigWatcher, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	// Watch the parent directory rather than the file itself. This is required to reliably
	// detect changes when the file is replaced via an atomic rename (common with editors) or
	// when it is projected via a Kubernetes ConfigMap's "..data" symlink swap (the same
	// rotation pattern CredentialManager already handles for mounted secrets).
	dir := filepath.Dir(path)
	if err := watcher.Add(dir); err != nil {
		watcher.Close()
		return nil, err
	}

	cw := &ConfigWatcher{
		path:    path,
		watcher: watcher,
		done:    make(chan struct{}),
	}

	go cw.run()

	log.Infof("Hot reload enabled: watching config file [%s] (only kiali_feature_flags is hot-reloaded; other changes still require a restart)", path)
	return cw, nil
}

// Close stops the config file watcher. Safe to call multiple times.
func (cw *ConfigWatcher) Close() {
	cw.closeOnce.Do(func() {
		close(cw.done)
		if cw.watcher != nil {
			cw.watcher.Close()
		}
	})
}

// run is the watcher's event loop. It debounces bursts of filesystem events and
// triggers a single reload once events settle.
func (cw *ConfigWatcher) run() {
	var debounce *time.Timer
	defer func() {
		if debounce != nil {
			debounce.Stop()
		}
	}()

	reload := func() {
		if err := cw.reload(); err != nil {
			log.Errorf("Failed to hot reload config file [%s], keeping previous configuration: %v", cw.path, err)
		}
	}

	for {
		select {
		case <-cw.done:
			return
		case event, ok := <-cw.watcher.Events:
			if !ok {
				return
			}
			// Only react to events for our config file itself, or the ConfigMap "..data"
			// symlink swap used when the file is projected from a mounted ConfigMap.
			base := filepath.Base(event.Name)
			if base != filepath.Base(cw.path) && base != "..data" {
				continue
			}
			if debounce == nil {
				debounce = time.AfterFunc(hotReloadDebounce, reload)
			} else {
				debounce.Reset(hotReloadDebounce)
			}
		case err, ok := <-cw.watcher.Errors:
			if !ok {
				return
			}
			log.Errorf("Config file watcher error: %v", err)
		}
	}
}

// reload re-reads and validates the config file, then applies only the allowlisted,
// safe-to-hot-reload fields onto a fresh copy of the live configuration. The whole file
// is parsed and validated so obviously broken YAML/values are rejected and logged without
// disturbing the running config, but fields outside the allowlist are intentionally
// ignored -- see applyHotReloadableFields.
func (cw *ConfigWatcher) reload() error {
	candidate, err := LoadFromFile(cw.path)
	if err != nil {
		return err
	}
	// LoadFromFile (via Unmarshal) always builds a new CredentialManager (its own fsnotify
	// watcher goroutine) for the candidate config. We never publish the candidate itself --
	// only copy allowlisted fields off of it -- so that manager would otherwise leak. The
	// live config keeps using its own, existing CredentialManager.
	defer candidate.Close()

	if err := Validate(candidate); err != nil {
		return err
	}

	updated := Get()
	if !applyHotReloadableFields(updated, candidate) {
		log.Debug("Config file changed but no hot-reloadable fields differ; nothing to apply")
		return nil
	}
	Set(updated)

	log.Info("Hot reloaded configuration from file (kiali_feature_flags only; other settings still require a restart to take effect)")
	return nil
}

// applyHotReloadableFields copies the small set of config fields that are safe to change
// at runtime with no pod/process restart from candidate into dst, returning true if
// anything actually changed.
//
// These fields (all under kiali_feature_flags) are read fresh from config.Get() on every
// use in the request path and have no side effects on boot-time wiring. Kubernetes
// clients/informer caches, the Prometheus/tracing/Grafana clients, TLS policy, auth, and
// credentials are all constructed once at startup from the config available then, and are
// intentionally excluded here. Extending this allowlist requires auditing that the new
// field isn't captured elsewhere at boot (e.g. kiali_feature_flags.clustering IS excluded
// because it also affects client factory construction - see kubernetes/client_factory.go).
func applyHotReloadableFields(dst, candidate *Config) bool {
	old := dst.KialiFeatureFlags
	dst.KialiFeatureFlags.DisabledFeatures = candidate.KialiFeatureFlags.DisabledFeatures
	dst.KialiFeatureFlags.IstioAnnotationAction = candidate.KialiFeatureFlags.IstioAnnotationAction
	dst.KialiFeatureFlags.IstioInjectionAction = candidate.KialiFeatureFlags.IstioInjectionAction
	dst.KialiFeatureFlags.IstioUpgradeAction = candidate.KialiFeatureFlags.IstioUpgradeAction
	dst.KialiFeatureFlags.CustomWorkloadTypes = candidate.KialiFeatureFlags.CustomWorkloadTypes
	dst.KialiFeatureFlags.UIDefaults = candidate.KialiFeatureFlags.UIDefaults
	dst.KialiFeatureFlags.Validations = candidate.KialiFeatureFlags.Validations

	return !reflect.DeepEqual(old, dst.KialiFeatureFlags)
}
