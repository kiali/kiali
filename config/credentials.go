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

// credentialCache caches file-based credentials and watches for changes
type credentialCache struct {
	mu          sync.RWMutex
	cache       map[string]string // filepath -> cached content
	watchedDirs map[string]struct{}
	watcher     *fsnotify.Watcher
	done        chan struct{}
}

var (
	watchedCredentialFileCache     *credentialCache
	watchedCredentialFileCacheOnce sync.Once
)

// initCache initializes the global credential cache with file watching
func initCache() {
	watchedCredentialFileCacheOnce.Do(func() {
		watcher, err := fsnotify.NewWatcher()
		if err != nil {
			log.Errorf("Failed to create credential file watcher: %v", err)
			return
		}

		watchedCredentialFileCache = &credentialCache{
			cache:       make(map[string]string),
			watchedDirs: make(map[string]struct{}),
			watcher:     watcher,
			done:        make(chan struct{}),
		}

		// Start watching for file changes
		go watchedCredentialFileCache.watchFiles()
	})
}

// watchFiles monitors file changes and updates the cache
func (c *credentialCache) watchFiles() {
	for {
		select {
		case <-c.done:
			return
		case event, ok := <-c.watcher.Events:
			if !ok {
				return
			}
			c.handleEvent(event)
		case err, ok := <-c.watcher.Errors:
			if !ok {
				return
			}
			log.Errorf("Credential file watcher error: %v", err)
		}
	}
}

// updateFile re-reads a file and updates the cache
func (c *credentialCache) updateFile(path string) {
	content, err := os.ReadFile(path)
	if err != nil {
		log.Warningf("Failed to re-read credential file [%s]: %v (removing from cache)", path, err)
		c.invalidate(path)
		return
	}

	c.mu.Lock()
	c.cache[path] = strings.TrimSpace(string(content))
	c.mu.Unlock()

	log.Debugf("Credential file [%s] updated in cache", path)
}

// invalidate removes a cached credential forcing the next read to hit the file system.
func (c *credentialCache) invalidate(path string) {
	c.mu.Lock()
	delete(c.cache, path)
	c.mu.Unlock()
}

func (c *credentialCache) handleEvent(event fsnotify.Event) {
	// Ignore directories or files we never cached.
	c.mu.RLock()
	_, tracked := c.cache[event.Name]
	c.mu.RUnlock()
	if !tracked {
		return
	}

	// Kubernetes secret rotation typically performs Remove + Create/Rename.
	if event.Op&(fsnotify.Remove|fsnotify.Rename) != 0 {
		c.invalidate(event.Name)
		return
	}

	if event.Op&(fsnotify.Write|fsnotify.Create|fsnotify.Chmod) != 0 {
		c.updateFile(event.Name)
	}
}

// get retrieves a credential from cache or loads it from file
func (c *credentialCache) get(path string) (string, error) {
	// Check if already cached
	c.mu.RLock()
	if value, exists := c.cache[path]; exists {
		c.mu.RUnlock()
		return value, nil
	}
	c.mu.RUnlock()

	// Not in cache, read file and start watching
	content, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("failed to read credential from [%s]: %w", path, err)
	}

	value := strings.TrimSpace(string(content))

	// Ensure we can watch the parent directory. If this fails, fall back to direct reads.
	if err := c.watchDir(path); err != nil {
		log.Warningf("Failed to watch credential directory for [%s]: %v (falling back to direct reads)", path, err)
		return value, nil
	}

	// Add to cache now that watching succeeded.
	c.mu.Lock()
	c.cache[path] = value
	c.mu.Unlock()

	return value, nil
}

func (c *credentialCache) watchDir(path string) error {
	if c.watcher == nil {
		return fmt.Errorf("watcher not initialized")
	}

	dir := filepath.Dir(path)

	c.mu.RLock()
	_, already := c.watchedDirs[dir]
	c.mu.RUnlock()
	if already {
		return nil
	}

	// Attempt to watch directory before recording it to avoid false positives when Add fails.
	if err := c.watcher.Add(dir); err != nil {
		return err
	}

	c.mu.Lock()
	c.watchedDirs[dir] = struct{}{}
	c.mu.Unlock()

	log.Tracef("Watching credential directory [%s] for changes", dir)
	return nil
}

// close stops the file watcher and cleans up resources
func (c *credentialCache) close() {
	if c == nil {
		return
	}
	close(c.done)
	if c.watcher != nil {
		c.watcher.Close()
	}
}

// CloseWatchedCredentials closes the global credential file watcher and cleans up resources.
// This should be called during application shutdown to properly release file system watchers
// and stop background goroutines. After calling this, the cache can be re-initialized on the
// next credential read (useful for testing or server restarts within the same process).
func CloseWatchedCredentials() {
	if watchedCredentialFileCache != nil {
		log.Debug("Closing credential file watcher")
		watchedCredentialFileCache.close()
		watchedCredentialFileCache = nil
		watchedCredentialFileCacheOnce = sync.Once{} // Reset to allow re-initialization
	}
}

// ReadCredential reads a credential from file if it's a path, otherwise returns the value directly.
// This enables automatic credential rotation without pod restart when credentials are mounted as secrets.
//
// File Path Detection Heuristic:
//   - Values starting with "/" are treated as absolute file paths and will be read from disk
//   - All other values (including relative paths) are returned as literal credential values
//   - This design ensures backward compatibility with existing configurations that use literal credentials
//
// Auto-Rotation Behavior:
//   - When Kubernetes updates a mounted secret, the file content changes on disk (via atomic symlink swap)
//   - This function uses fsnotify to watch for file changes and caches credentials for performance
//   - The cache is automatically updated when files change, eliminating per-request file I/O
//   - No pod restart is required - new credentials are used immediately after file update
//
// Performance:
//   - File content is cached after first read, avoiding I/O on every credential access
//   - File system watcher detects changes and updates cache automatically
//   - Safe for high-frequency access (e.g., thousands of Prometheus requests during graph generation)
//
// Usage Examples:
//   - File path:   ReadCredential("/kiali-override-secrets/prometheus-token/value.txt")
//     → reads and caches the file content (supports auto-rotation via fsnotify)
//   - Literal:     ReadCredential("my-static-token-value")
//     → returns "my-static-token-value" as-is (no caching or rotation)
//   - Relative:    ReadCredential("relative/path")
//     → returns "relative/path" as-is (treated as literal, not a file path)
//
// Error Handling:
//   - Returns error if file path is provided but file cannot be read
//   - File content is trimmed of leading/trailing whitespace (common when using echo/kubectl to create secrets)
func ReadCredential(value string) (string, error) {
	if value == "" {
		return "", nil
	}

	// If it looks like an absolute file path, read from cache
	if strings.HasPrefix(value, "/") {
		initCache()
		if watchedCredentialFileCache != nil {
			return watchedCredentialFileCache.get(value)
		}
		// Fallback if cache initialization failed
		content, err := os.ReadFile(value)
		if err != nil {
			return "", fmt.Errorf("failed to read credential from [%s]: %w", value, err)
		}
		return strings.TrimSpace(string(content)), nil
	}

	// Otherwise return the literal value (backward compatibility)
	return value, nil
}

// GetToken returns the token value, reading from file if a.Token is a file path.
// Supports automatic credential rotation - reads file content on each call.
func (a *Auth) GetToken() (string, error) {
	return ReadCredential(a.Token)
}

// GetPassword returns the password value, reading from file if a.Password is a file path.
// Supports automatic credential rotation - reads file content on each call.
func (a *Auth) GetPassword() (string, error) {
	return ReadCredential(a.Password)
}

// GetUsername returns the username value, reading from file if a.Username is a file path.
// Supports automatic credential rotation - reads file content on each call.
func (a *Auth) GetUsername() (string, error) {
	return ReadCredential(a.Username)
}
