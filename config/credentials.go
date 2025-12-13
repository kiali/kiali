package config

import (
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"

	"github.com/kiali/kiali/log"
)

// CredentialManager handles reading credentials from files with caching and auto-rotation support.
// It watches credential files for changes and automatically updates the cache when files are modified,
// enabling automatic credential rotation without pod restart when credentials are mounted as Kubernetes secrets.
//
// Additionally, it manages a certificate pool that combines system CAs with custom CA bundles,
// which is also automatically rebuilt when the CA bundle files change.
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
// Kubernetes Secret Mount Structure:
//
// When a Secret is mounted as a volume, Kubernetes creates this symlink structure:
//
//	/secret-mount-path/
//	├── ..data -> ..2024_01_15_10_30_00.123456   # Symlink to timestamped directory
//	├── ..2024_01_15_10_30_00.123456/            # Directory with actual secret data
//	│   ├── token                                # Actual file content
//	│   └── ca-bundle.crt                        # Actual file content
//	├── token -> ..data/token                    # Symlink through ..data
//	└── ca-bundle.crt -> ..data/ca-bundle.crt    # Symlink through ..data
//
// During secret rotation, Kubernetes:
//  1. Creates a new timestamped directory with updated content
//  2. Atomically swaps the ..data symlink to point to the new directory
//  3. Deletes the old timestamped directory
//
// The individual file symlinks (token, ca-bundle.crt) don't change - only ..data changes.
// This is why the manager watches for ..data changes to detect secret rotation.
//
// Certificate Pool:
//   - Pass caBundlePaths to NewCredentialManager() to include custom CA bundles
//   - Use GetCertPool() to get a clone of the managed certificate pool
//   - CA bundle files are watched and the pool is rebuilt automatically on changes
//
// Usage:
//
//	token, err := conf.Credentials.Get(conf.ExternalServices.Prometheus.Auth.Token)
//	certPool := conf.Credentials.GetCertPool()
//
// Internal Data Structures:
//   - cache: maps absolute file path → credential content (trimmed string)
//   - watchedDirs: maps directory path → unused struct{} (used as a set of watched directories)
type CredentialManager struct {
	mu          sync.RWMutex
	cache       map[string]string
	watchedDirs map[string]struct{}
	watcher     *fsnotify.Watcher
	done        chan struct{}
	closeOnce   sync.Once

	// Certificate pool management
	certPool         *x509.CertPool
	caBundlePaths    []string
	hasCustomCAsFlag bool // true if custom CAs were loaded; false when using only system CAs
}

// NewCredentialManager creates a new credential manager with file watching enabled.
// The caBundlePaths parameter specifies additional CA bundle files to include in the
// certificate pool (beyond system CAs). Pass nil or empty slice if no custom CAs are needed.
// Returns an error only if the file watcher cannot be initialized. Invalid CA bundles are
// logged but do not prevent creation - file watching remains active for auto-recovery.
func NewCredentialManager(caBundlePaths []string) (*CredentialManager, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("failed to create credential file watcher: %w", err)
	}

	cm := &CredentialManager{
		cache:         make(map[string]string),
		watchedDirs:   make(map[string]struct{}),
		watcher:       watcher,
		done:          make(chan struct{}),
		caBundlePaths: caBundlePaths,
	}

	go cm.watchFiles()

	// Initialize the certificate pool with system CAs and any configured custom CA bundles.
	// If CA bundles are invalid, log the error but continue with system CAs.
	// File watching remains active so rotation can recover when valid certs are deployed.
	if err := cm.rebuildCertPool(); err != nil {
		log.Errorf("Failed to build initial certificate pool (continuing with system CAs): %v", err)
		cm.auditRotation("ca_bundle", "startup", false, err.Error())
	}

	return cm, nil
}

// Close stops the file watcher and cleans up resources.
// Should be called during application shutdown.
func (cm *CredentialManager) Close() {
	cm.closeOnce.Do(func() {
		close(cm.done)
		if cm.watcher != nil {
			cm.watcher.Close()
			// Note: Don't set cm.watcher = nil here
			// The watchFiles goroutine may still be accessing cm.watcher.Events
			// Closing the watcher closes its channels, causing watchFiles to exit gracefully
		}
	})
}

// rebuildCertPool rebuilds the certificate pool from system CAs and configured CA bundles.
// Uses best-effort loading: invalid bundles are logged but don't prevent loading valid bundles.
// Falls back to system CAs only if no valid custom CAs can be loaded from any bundle.
func (cm *CredentialManager) rebuildCertPool() error {
	// Load system CAs
	systemPool, err := x509.SystemCertPool()
	if err != nil {
		log.Warningf("Unable to load system cert pool. Falling back to empty cert pool. Error: %s", err)
		systemPool = x509.NewCertPool()
	}

	// Clone the system pool to build the combined pool with custom CAs
	combinedPool := systemPool.Clone()

	cm.mu.RLock()
	paths := cm.caBundlePaths
	cm.mu.RUnlock()

	// Track whether ANY valid CA was loaded across ALL bundles
	customCAsLoaded := false

	// Process each bundle with best-effort approach
	for _, path := range paths {
		if path == "" {
			continue
		}

		// Try to read the bundle (warn and continue on failure)
		data, err := cm.readCABundle(path)
		if err != nil {
			log.Warningf("Unable to read CA bundle [%s]: %v", path, err)
			continue
		}

		if len(data) == 0 {
			continue
		}

		// Parse certificates from this bundle
		certs := parseCertificates(data)
		if len(certs) == 0 {
			log.Warningf("No valid PEM certificates found in [%s]", path)
			continue
		}

		// Validate and append each certificate individually
		validCertsFromThisBundle := 0
		for i, certPEM := range certs {
			if err := cm.validateCertificate(certPEM); err != nil {
				log.Warningf("Skipping invalid certificate #%d in [%s]: %v", i+1, path, err)
				continue
			}
			if !combinedPool.AppendCertsFromPEM(certPEM) {
				log.Warningf("Failed to append certificate #%d from [%s]", i+1, path)
			} else {
				validCertsFromThisBundle++
				customCAsLoaded = true
			}
		}

		// Log bundle-level results
		if validCertsFromThisBundle == 0 {
			log.Warningf("All certificates in [%s] failed validation", path)
		} else {
			log.Infof("Loaded [%d] valid CA certificate(s) from [%s]", validCertsFromThisBundle, path)
		}
	}

	// Update pool and flag atomically based on overall result
	cm.mu.Lock()
	if customCAsLoaded {
		cm.certPool = combinedPool
		cm.hasCustomCAsFlag = true
	} else {
		cm.certPool = systemPool
		cm.hasCustomCAsFlag = false
	}
	cm.mu.Unlock()

	return nil
}

// readCABundle reads a CA bundle file, using the credential cache for absolute paths
// and direct file reading for relative paths.
func (cm *CredentialManager) readCABundle(path string) ([]byte, error) {
	if strings.HasPrefix(path, "/") {
		// Absolute path - use credential manager for caching and watching
		value, err := cm.Get(path)
		if err != nil {
			return nil, err
		}
		return []byte(value), nil
	}

	// Relative path - read directly from file (typically for tests)
	log.Tracef("CA bundle [%s] is a relative path - bypassing cache and reading directly from file (this should only happen in tests)", path)
	return os.ReadFile(path)
}

// GetCertPool returns a clone of the current certificate pool.
func (cm *CredentialManager) GetCertPool() *x509.CertPool {
	cm.mu.RLock()
	pool := cm.certPool
	cm.mu.RUnlock()

	if pool == nil {
		log.Error("GetCertPool called but certPool is nil - report this as a bug in CredentialManager.")
		return x509.NewCertPool()
	}

	return pool.Clone()
}

// HasCustomCAs returns true if custom CA certificates were successfully loaded into the pool.
// This indicates whether custom CAs (beyond the system CAs) are present and active.
func (cm *CredentialManager) HasCustomCAs() bool {
	// Note: While boolean reads are atomic in Go, we use RLock here for consistency with other
	// methods, to satisfy the race detector, and because the cost is negligible (~20ns) compared
	// to the actual HTTP operations this gates. This is a read-heavy workload where RWMutex excels.
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	return cm.hasCustomCAsFlag
}

// validateCertificate ensures a certificate is safe to add to the trust store.
// It checks expiration, key usage, and key strength using commonly accepted security minimums.
func (cm *CredentialManager) validateCertificate(certPEM []byte) error {
	block, _ := pem.Decode(certPEM)
	if block == nil {
		return fmt.Errorf("failed to decode PEM block")
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return fmt.Errorf("failed to parse certificate: %w", err)
	}

	// Reject non-CA certificates
	if !cert.IsCA {
		return fmt.Errorf("certificate is not a CA certificate (IsCA=false)")
	}

	// Check expiration (reject expired, but allow not-yet-valid for pre-staging)
	now := time.Now()
	if now.After(cert.NotAfter) {
		return fmt.Errorf("certificate expired on [%v]", cert.NotAfter)
	}

	// Allow certificates that aren't valid yet (for pre-staging)
	// but log a warning if they won't be valid soon
	if now.Before(cert.NotBefore) {
		daysUntilValid := cert.NotBefore.Sub(now).Hours() / 24
		if daysUntilValid > 30 {
			log.Warningf("Certificate won't be valid for [%.0f] days (until [%v])",
				daysUntilValid, cert.NotBefore)
		} else {
			log.Infof("Certificate will become valid in [%.0f] days (on [%v])",
				daysUntilValid, cert.NotBefore)
		}
		// Don't reject - allow pre-staging
	}

	// Check if it's actually a CA certificate with proper key usage
	// Only validate KeyUsage if it's explicitly set (non-zero) - many valid CA certs
	// don't have a KeyUsage extension at all, which results in KeyUsage = 0
	if cert.IsCA && cert.KeyUsage != 0 {
		if cert.KeyUsage&x509.KeyUsageCertSign == 0 {
			return fmt.Errorf("CA certificate has KeyUsage extension but missing CertSign")
		}
	}

	// Check key strength - using commonly accepted minimums for security
	switch cert.PublicKeyAlgorithm {
	case x509.RSA:
		rsaKey, ok := cert.PublicKey.(*rsa.PublicKey)
		if !ok {
			return fmt.Errorf("failed to extract RSA public key from certificate")
		}
		if rsaKey.N.BitLen() < 2048 {
			return fmt.Errorf("RSA key size [%d] bits too weak, must be 2048 or greater", rsaKey.N.BitLen())
		}
	case x509.ECDSA:
		ecdsaKey, ok := cert.PublicKey.(*ecdsa.PublicKey)
		if !ok {
			return fmt.Errorf("failed to extract ECDSA public key from certificate")
		}
		if ecdsaKey.Curve.Params().BitSize < 256 {
			return fmt.Errorf("ECDSA curve size [%d] bits too weak, must be 256 or greater",
				ecdsaKey.Curve.Params().BitSize)
		}
	case x509.Ed25519:
		// Ed25519 is always 256 bits - no validation needed
		// But still verify we can extract the key
		if _, ok := cert.PublicKey.(ed25519.PublicKey); !ok {
			return fmt.Errorf("failed to extract Ed25519 public key from certificate")
		}
	case x509.DSA:
		// DSA certificates are not supported due to limited functionality and declining usage
		return fmt.Errorf("DSA certificates are not supported - please use RSA, ECDSA, or Ed25519")
	default:
		// Unknown or unsupported key algorithm
		return fmt.Errorf("unsupported public key algorithm: [%v]", cert.PublicKeyAlgorithm)
	}

	return nil
}

// auditRotation logs a credential rotation event using Kiali's structured logging.
// Only logs when audit logging is enabled via server.audit_log config.
func (cm *CredentialManager) auditRotation(rotationType, path string, success bool, errorMsg string) {
	if !Get().Server.AuditLog {
		return
	}

	zl := log.WithGroup("credential-rotation")

	if success {
		zl.Info().
			Str("operation", "ROTATE").
			Str("type", rotationType). // "credential" or "ca_bundle"
			Str("path", path).
			Msgf("%s rotation successful", rotationType)
	} else {
		zl.Error().
			Str("operation", "ROTATE_FAILED").
			Str("type", rotationType).
			Str("path", path).
			Str("error", errorMsg).
			Msgf("%s rotation failed", rotationType)
	}
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
	// Fast path: check if already cached
	cm.mu.RLock()
	if value, exists := cm.cache[path]; exists {
		cm.mu.RUnlock()
		return value, nil
	}
	cm.mu.RUnlock()

	// Not in cache - we need to load it
	// Upgrade to write lock to prevent multiple goroutines from loading the same file
	cm.mu.Lock()

	// Double-check: another goroutine might have loaded it while we waited for the lock
	if value, exists := cm.cache[path]; exists {
		cm.mu.Unlock()
		return value, nil
	}

	// Still not in cache, we're the one to load it
	// Read the file while holding the lock to ensure atomicity with cache operations
	content, err := os.ReadFile(path)
	if err != nil {
		cm.mu.Unlock()
		return "", fmt.Errorf("failed to read credential from [%s]: %w", path, err)
	}

	value := strings.TrimSpace(string(content))

	// Add to cache before releasing lock to ensure no other goroutine sees a cache miss
	cm.cache[path] = value
	cm.mu.Unlock()

	// Watch the directory after releasing the lock (watching can be slow and doesn't need the lock)
	if err := cm.watchParentDir(path); err != nil {
		log.Warningf("Failed to watch credential directory for [%s] (falling back to direct reads): %v", path, err)
	}

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
	// Check if this event affects any of our CA bundle paths FIRST
	// (before credential cache logic, since CA bundles might not be in the cache)
	cm.mu.RLock()
	isCAbundle := false
	for _, path := range cm.caBundlePaths {
		if path == event.Name || filepath.Dir(path) == event.Name ||
			(filepath.Base(event.Name) == "..data" && filepath.Dir(event.Name) == filepath.Dir(path)) {
			isCAbundle = true
			break
		}
	}
	cm.mu.RUnlock()

	if isCAbundle {
		log.Infof("CA bundle file change detected [%s], rebuilding certificate pool", event.Name)
		// Invalidate cache for CA bundle paths so rebuildCertPool gets fresh data
		cm.mu.Lock()
		for _, path := range cm.caBundlePaths {
			delete(cm.cache, path)
		}
		cm.mu.Unlock()

		if err := cm.rebuildCertPool(); err != nil {
			cm.auditRotation("ca_bundle", event.Name, false, err.Error())
			log.Errorf("Failed to rebuild certificate pool: %v", err)
			// Don't return - let normal credential cache logic handle this file
			// This ensures the cache gets restored even if cert pool rebuild fails
		} else {
			cm.auditRotation("ca_bundle", event.Name, true, "")
			log.Info("Certificate pool successfully rebuilt")
			// Success - cert pool rebuilt and Get() re-cached all paths
			// No need to process this event again for credential cache
			return
		}
	}

	// Now handle credential cache updates
	cm.mu.RLock()
	_, tracked := cm.cache[event.Name]
	cm.mu.RUnlock()

	// If the changed file is not in our cache, check if it's the special ..data symlink.
	// During Kubernetes secret rotation, the ..data symlink is swapped to point to a new
	// timestamped directory, but the per-file symlinks (e.g., token, tls.crt) remain unchanged.
	// Our cache keys are the credential file paths (e.g., /secret/token), not ..data itself,
	// so we detect rotation by watching for ..data changes and then refresh all cached files
	// in that directory. If it's neither a cached file nor ..data, ignore the event.
	if !tracked {
		if filepath.Base(event.Name) == "..data" {
			// Pass the secret mount directory (parent of ..data), not ..data itself
			cm.refreshDir(filepath.Dir(event.Name))
		}
		return
	}

	// Kubernetes secret rotation typically performs Remove + Create/Rename
	if event.Op&(fsnotify.Remove|fsnotify.Rename) != 0 {
		cm.evictFromCache(event.Name)
		return
	}

	if event.Op&(fsnotify.Write|fsnotify.Create|fsnotify.Chmod) != 0 {
		cm.refreshCachedFile(event.Name)
	}
}

// refreshDir updates all cached files that reside under the given directory.
// Used to handle Kubernetes secret rotation where the ..data symlink flips to a new target.
//
// The dir parameter should be the secret mount directory (e.g., /kiali-secrets), not ..data itself.
// It is the parent directory that contains the credential files and the ..data symlink.
//
// Although our cache keys are file paths like /secret/token (not ..data), those paths are
// symlinks that resolve through ..data (e.g., /secret/token -> ..data/token -> ..xxxxx/token).
// When ..data is swapped to point to a new timestamped directory, re-reading the same path
// (e.g., /secret/token) automatically returns the new content because the symlink chain
// now resolves to the new directory. This function finds all cached paths in the affected
// directory and re-reads them to pick up the rotated secret values.
func (cm *CredentialManager) refreshDir(dir string) {
	// Collect all cached file paths whose parent directory matches dir (the secret mount directory)
	cm.mu.RLock()
	paths := make([]string, 0)
	for path := range cm.cache {
		if filepath.Dir(path) == dir {
			paths = append(paths, path)
		}
	}
	cm.mu.RUnlock()

	// Re-read each file - the symlink chain now resolves to the new ..data target
	for _, path := range paths {
		cm.refreshCachedFile(path)
	}
}

// refreshCachedFile re-reads a file and updates the cache.
func (cm *CredentialManager) refreshCachedFile(path string) {
	// Hold write lock during file read to ensure atomicity with cache operations
	// This prevents other goroutines from seeing a cache miss and reading the file
	// while it's being updated (which could result in reading an empty/partial file)
	cm.mu.Lock()
	defer cm.mu.Unlock()

	content, err := os.ReadFile(path)
	if err != nil {
		cm.auditRotation("credential", path, false, err.Error())
		log.Warningf("Failed to re-read credential file [%s] (removing from cache): %v", path, err)
		delete(cm.cache, path)
		return
	}

	value := strings.TrimSpace(string(content))

	// Don't update cache with empty values during refresh - this can happen when
	// os.WriteFile truncates the file before writing new content (non-atomic operation).
	// Keep the existing cached value; the next event after write completes will refresh.
	// Real credentials are never empty, so empty indicates a transient write state.
	// Note: This won't occur in Kubernetes since secret rotation uses atomic symlink swaps;
	// but it's a good defensive check in case something directly writes a file (like the tests do).
	if value == "" {
		log.Debugf("Credential file [%s] is empty during refresh (likely mid-write), keeping cached value", path)
		return
	}

	cm.cache[path] = value
	cm.auditRotation("credential", path, true, "")
	log.Debugf("Credential file [%s] updated in cache", path)
}

// evictFromCache removes a cached credential, forcing the next read to hit the file system.
// File watching is not canceled, so future changes to the file will still be detected.
func (cm *CredentialManager) evictFromCache(path string) {
	cm.mu.Lock()
	delete(cm.cache, path)
	cm.mu.Unlock()
}

// watchParentDir ensures the parent directory of the given file path is being watched.
func (cm *CredentialManager) watchParentDir(path string) error {
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

	log.Tracef("Watching credential directory [%s] for changes to [%s]", dir, path)
	return nil
}

// parseCertificates splits a PEM bundle into individual certificates.
// Returns a slice of PEM-encoded certificates, one per certificate in the bundle.
// Each certificate is re-encoded as a standalone PEM block to ensure proper
// validation and processing of individual certificates within a bundle.
func parseCertificates(pemData []byte) [][]byte {
	var certs [][]byte
	for {
		block, rest := pem.Decode(pemData)
		if block == nil {
			break
		}
		if block.Type == "CERTIFICATE" {
			// Re-encode each cert as a standalone PEM block
			certs = append(certs, pem.EncodeToMemory(block))
		}
		pemData = rest
	}
	return certs
}
