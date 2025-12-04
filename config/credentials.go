package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/fsnotify/fsnotify"

	"github.com/kiali/kiali/log"
)

// CredentialManager handles reading credentials from files with caching and auto-rotation support.
// It watches credential files for changes and automatically updates the cache when files are modified,
// enabling automatic credential rotation without pod restart when credentials are mounted as Kubernetes secrets.
//
// File Path Detection:
//   - Values starting with "/" are treated as absolute file paths and read from disk
//   - All other values are returned as literal credential values (backward compatibility)
//
// Auto-Rotation Behavior:
//   - When Kubernetes updates a mounted secret, the file content changes on disk (via atomic symlink swap)
//   - The manager uses fsnotify to watch for file changes and updates the cache automatically
//   - No pod restart is required - new credentials are used immediately after file update
//
// Usage:
//
//	token, err := conf.Credentials.Get(conf.ExternalServices.Prometheus.Auth.Token)
type CredentialManager struct {
	mu          sync.RWMutex
	cache       map[string]string
	watchedDirs map[string]struct{}
	watcher     *fsnotify.Watcher
	done        chan struct{}
	closeOnce   sync.Once
}

// NewCredentialManager creates a new credential manager with file watching enabled.
// Returns an error if the file watcher cannot be initialized.
func NewCredentialManager() (*CredentialManager, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("failed to create credential file watcher: %w", err)
	}

	cm := &CredentialManager{
		cache:       make(map[string]string),
		watchedDirs: make(map[string]struct{}),
		watcher:     watcher,
		done:        make(chan struct{}),
	}

	go cm.watchFiles()
	return cm, nil
}

// Close stops the file watcher and cleans up resources.
// Should be called during application shutdown.
func (cm *CredentialManager) Close() {
	if cm == nil {
		return
	}
	cm.closeOnce.Do(func() {
		close(cm.done)
		if cm.watcher != nil {
			cm.watcher.Close()
		}
	})
}

// Get reads a credential, either from a file (if value starts with "/") or returns the literal value.
//
// File paths are cached and watched for changes. When the file is modified (e.g., during Kubernetes
// secret rotation), the cache is automatically updated.
//
// Examples:
//   - Get("/kiali-secrets/prometheus-token") → reads and caches file content
//   - Get("my-static-token") → returns "my-static-token" as-is
//   - Get("") → returns ""
func (cm *CredentialManager) Get(value string) (string, error) {
	if value == "" {
		return "", nil
	}

	// Values not starting with "/" are treated as literal credentials
	if !strings.HasPrefix(value, "/") {
		return value, nil
	}

	// It's an absolute file path - use the cache
	return cm.getFromCache(value)
}

// getFromCache retrieves a credential from cache or loads it from file.
func (cm *CredentialManager) getFromCache(path string) (string, error) {
	// Check if already cached
	cm.mu.RLock()
	if value, exists := cm.cache[path]; exists {
		cm.mu.RUnlock()
		return value, nil
	}
	cm.mu.RUnlock()

	// Not in cache, read file and start watching
	content, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("failed to read credential from [%s]: %w", path, err)
	}

	value := strings.TrimSpace(string(content))

	// Ensure we can watch the parent directory. If this fails, fall back to direct reads.
	if err := cm.watchDir(path); err != nil {
		log.Warningf("Failed to watch credential directory for [%s]: %v (falling back to direct reads)", path, err)
		return value, nil
	}

	// Add to cache now that watching succeeded
	cm.mu.Lock()
	cm.cache[path] = value
	cm.mu.Unlock()

	return value, nil
}

// watchFiles monitors file changes and updates the cache.
func (cm *CredentialManager) watchFiles() {
	for {
		select {
		case <-cm.done:
			return
		case event, ok := <-cm.watcher.Events:
			if !ok {
				return
			}
			cm.handleEvent(event)
		case err, ok := <-cm.watcher.Errors:
			if !ok {
				return
			}
			log.Errorf("Credential file watcher error: %v", err)
		}
	}
}

// handleEvent processes a file system event and updates the cache accordingly.
func (cm *CredentialManager) handleEvent(event fsnotify.Event) {
	// Ignore directories or files we never cached
	cm.mu.RLock()
	_, tracked := cm.cache[event.Name]
	cm.mu.RUnlock()
	if !tracked {
		return
	}

	// Kubernetes secret rotation typically performs Remove + Create/Rename
	if event.Op&(fsnotify.Remove|fsnotify.Rename) != 0 {
		cm.invalidate(event.Name)
		return
	}

	if event.Op&(fsnotify.Write|fsnotify.Create|fsnotify.Chmod) != 0 {
		cm.updateFile(event.Name)
	}
}

// updateFile re-reads a file and updates the cache.
func (cm *CredentialManager) updateFile(path string) {
	content, err := os.ReadFile(path)
	if err != nil {
		log.Warningf("Failed to re-read credential file [%s]: %v (removing from cache)", path, err)
		cm.invalidate(path)
		return
	}

	cm.mu.Lock()
	cm.cache[path] = strings.TrimSpace(string(content))
	cm.mu.Unlock()

	log.Debugf("Credential file [%s] updated in cache", path)
}

// invalidate removes a cached credential, forcing the next read to hit the file system.
func (cm *CredentialManager) invalidate(path string) {
	cm.mu.Lock()
	delete(cm.cache, path)
	cm.mu.Unlock()
}

// watchDir ensures the directory containing the given file is being watched.
func (cm *CredentialManager) watchDir(path string) error {
	if cm.watcher == nil {
		return fmt.Errorf("watcher not initialized")
	}

	dir := filepath.Dir(path)

	cm.mu.RLock()
	_, already := cm.watchedDirs[dir]
	cm.mu.RUnlock()
	if already {
		return nil
	}

	// Attempt to watch directory before recording it to avoid false positives when Add fails
	if err := cm.watcher.Add(dir); err != nil {
		return err
	}

	cm.mu.Lock()
	cm.watchedDirs[dir] = struct{}{}
	cm.mu.Unlock()

	log.Tracef("Watching credential directory [%s] for changes", dir)
	return nil
}
