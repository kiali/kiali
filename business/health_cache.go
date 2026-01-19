package business

import (
	"context"
	"fmt"
	"time"

	"github.com/rs/zerolog"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
)

// HealthCacheMonitor is an interface for the health cache background job.
// This is an interface for testing purposes.
type HealthCacheMonitor interface {
	// Start starts the background health refresh job.
	Start(ctx context.Context)
	// RefreshHealthCache performs a single refresh of the health cache.
	RefreshHealthCache(ctx context.Context) error
}

// FakeHealthCacheMonitor is a no-op implementation for testing.
type FakeHealthCacheMonitor struct{}

func (f *FakeHealthCacheMonitor) Start(ctx context.Context)                    {}
func (f *FakeHealthCacheMonitor) RefreshHealthCache(ctx context.Context) error { return nil }

// NewHealthCacheMonitor creates a new HealthCacheMonitor.
func NewHealthCacheMonitor(
	cache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	conf *config.Config,
	discovery istio.MeshDiscovery,
	prom prometheus.ClientInterface,
) *healthCacheMonitor {
	return &healthCacheMonitor{
		cache:         cache,
		clientFactory: clientFactory,
		conf:          conf,
		discovery:     discovery,
		lastRun:       time.Time{},
		logger:        log.Logger().With().Str("component", "health-cache-monitor").Logger(),
		prom:          prom,
	}
}

// healthCacheMonitor pre-computes health for all namespaces and caches the results.
type healthCacheMonitor struct {
	cache         cache.KialiCache
	clientFactory kubernetes.ClientFactory
	conf          *config.Config
	discovery     istio.MeshDiscovery
	lastRun       time.Time
	logger        zerolog.Logger
	prom          prometheus.ClientInterface
}

// Start starts the background health refresh loop.
func (m *healthCacheMonitor) Start(ctx context.Context) {
	interval := m.conf.HealthConfig.Compute.RefreshInterval
	m.logger.Info().Msgf("Starting health cache monitor with refresh interval: %s", interval)

	// Prime the cache with an initial refresh
	if err := m.RefreshHealthCache(ctx); err != nil {
		m.logger.Error().Err(err).Msg("Initial health cache refresh failed")
	}

	go func() {
		for {
			select {
			case <-ctx.Done():
				m.logger.Info().Msg("Stopping health cache monitor")
				return
			case <-time.After(interval):
				if err := m.RefreshHealthCache(ctx); err != nil {
					m.logger.Error().Err(err).Msg("Health cache refresh failed")
				}
			}
		}
	}()
}

// RefreshHealthCache performs a single refresh of the entire health cache.
func (m *healthCacheMonitor) RefreshHealthCache(ctx context.Context) error {
	startTime := time.Now()
	m.logger.Debug().Msg("Starting health cache refresh")

	// Calculate rate interval
	healthDuration := m.calculateDuration()

	// Get clusters from cache
	clusters := m.cache.GetClusters()
	if len(clusters) == 0 {
		m.logger.Warn().Msg("No clusters found, skipping health refresh")
		return nil
	}

	totalNamespaces := 0
	totalErrors := 0

	for _, cluster := range clusters {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		nsCount, errCount := m.refreshClusterHealth(ctx, cluster.Name, healthDuration)
		totalNamespaces += nsCount
		totalErrors += errCount
	}

	m.lastRun = startTime
	elapsed := time.Since(startTime)

	m.logger.Info().
		Int("clusters", len(clusters)).
		Int("namespaces", totalNamespaces).
		Int("errors", totalErrors).
		Dur("elapsed", elapsed).
		Str("healthDuration", healthDuration).
		Msg("Health cache refresh completed")

	return nil
}

// refreshClusterHealth refreshes health for all namespaces in a cluster.
// Returns the number of namespaces processed and the number of errors.
func (m *healthCacheMonitor) refreshClusterHealth(ctx context.Context, cluster, duration string) (int, int) {
	log := m.logger.With().Str("cluster", cluster).Logger()
	log.Debug().Msg("Refreshing health for cluster")

	// Get SA client for this cluster
	client := m.clientFactory.GetSAClient(cluster)
	if client == nil {
		log.Error().Msg("No SA client for cluster")
		return 0, 1
	}

	// Get namespaces accessible to Kiali's service account
	namespaces, err := m.getNamespacesForCluster(ctx, cluster)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get namespaces for cluster")
		return 0, 1
	}

	errorCount := 0
	for _, ns := range namespaces {
		if ctx.Err() != nil {
			return len(namespaces), errorCount
		}

		if err := m.refreshNamespaceHealth(ctx, cluster, ns.Name, duration); err != nil {
			log.Warn().Err(err).Str("namespace", ns.Name).Msg("Failed to refresh health for namespace")
			errorCount++
		}
	}

	return len(namespaces), errorCount
}

// getNamespacesForCluster returns namespaces accessible to Kiali's service account.
func (m *healthCacheMonitor) getNamespacesForCluster(ctx context.Context, cluster string) ([]models.Namespace, error) {
	// Get namespaces from discovery (uses SA client)
	// This respects any namespace filtering configured in Kiali
	client := m.clientFactory.GetSAClient(cluster)
	if client == nil {
		return nil, fmt.Errorf("no SA client for cluster %s", cluster)
	}

	// Get all namespaces via the SA client
	nsList, err := client.GetNamespaces("")
	if err != nil {
		return nil, fmt.Errorf("failed to get namespaces: %w", err)
	}

	// Convert to models.Namespace
	namespaces := make([]models.Namespace, 0, len(nsList))
	for _, ns := range nsList {
		namespaces = append(namespaces, models.Namespace{
			Cluster: cluster,
			Name:    ns.Name,
		})
	}

	return namespaces, nil
}

// refreshNamespaceHealth computes and caches health for a single namespace.
func (m *healthCacheMonitor) refreshNamespaceHealth(ctx context.Context, cluster, namespace, duration string) error {
	log := m.logger.With().
		Str("cluster", cluster).
		Str("namespace", namespace).
		Logger()
	log.Debug().Msg("Computing health for namespace")

	queryTime := time.Now()

	// Create a Layer using SA clients for this computation
	saClients := m.clientFactory.GetSAClients()
	userClients := m.clientFactory.GetSAClientsAsUserClientInterfaces()

	// Create a temporary Layer for health computation
	layer, err := newLayerWithSAClientsForHealth(
		m.conf,
		m.cache,
		m.prom,
		userClients,
		saClients,
		m.discovery,
	)
	if err != nil {
		return fmt.Errorf("failed to create layer: %w", err)
	}

	criteria := NamespaceHealthCriteria{
		Cluster:        cluster,
		IncludeMetrics: true,
		Namespace:      namespace,
		QueryTime:      queryTime,
		RateInterval:   duration,
	}

	// Compute health for apps, services, and workloads
	appHealth, appErr := layer.Health.GetNamespaceAppHealth(ctx, criteria)
	serviceHealth, svcErr := layer.Health.GetNamespaceServiceHealth(ctx, criteria)
	workloadHealth, wkErr := layer.Health.GetNamespaceWorkloadHealth(ctx, criteria)

	// If all failed, return error
	if appErr != nil && svcErr != nil && wkErr != nil {
		return fmt.Errorf("all health computations failed: app=%v, svc=%v, wk=%v", appErr, svcErr, wkErr)
	}

	// Log individual errors but continue
	if appErr != nil {
		log.Warn().Err(appErr).Msg("App health computation failed")
	}
	if svcErr != nil {
		log.Warn().Err(svcErr).Msg("Service health computation failed")
	}
	if wkErr != nil {
		log.Warn().Err(wkErr).Msg("Workload health computation failed")
	}

	// Store in cache
	cachedData := &models.CachedHealthData{
		AppHealth:      appHealth,
		Cluster:        cluster,
		ComputedAt:     queryTime,
		Namespace:      namespace,
		Duration:       duration,
		ServiceHealth:  serviceHealth,
		WorkloadHealth: workloadHealth,
	}

	m.cache.SetHealth(cluster, namespace, cachedData)
	return nil
}

// calculateDuration calculates the health duration based on configuration.
// If Duration is 0, it calculates based on elapsed time since last run.
func (m *healthCacheMonitor) calculateDuration() string {
	configuredInterval := m.conf.HealthConfig.Compute.Duration

	// If configured interval is non-zero, use it
	if configuredInterval > 0 {
		return formatDuration(configuredInterval)
	}

	// Auto-calculate based on elapsed time since last run
	if m.lastRun.IsZero() {
		// First run - use 2x the refresh interval as a reasonable default
		return formatDuration(m.conf.HealthConfig.Compute.RefreshInterval * 2)
	}

	elapsed := time.Since(m.lastRun)
	// Add a small buffer (10%) to ensure we cover the entire period
	interval := time.Duration(float64(elapsed) * 1.1)

	// Minimum of 1 minute
	if interval < time.Minute {
		interval = time.Minute
	}

	return formatDuration(interval)
}

// formatDuration formats a duration for Prometheus queries (e.g., "2m", "5m").
func formatDuration(d time.Duration) string {
	// Convert to seconds and format
	seconds := int(d.Seconds())
	if seconds >= 60 && seconds%60 == 0 {
		return fmt.Sprintf("%dm", seconds/60)
	}
	return fmt.Sprintf("%ds", seconds)
}

// newLayerWithSAClientsForHealth creates a Layer for health computation using SA clients.
// This is a simplified version that only initializes the services needed for health.
func newLayerWithSAClientsForHealth(
	conf *config.Config,
	kialiCache cache.KialiCache,
	prom prometheus.ClientInterface,
	userClients map[string]kubernetes.UserClientInterface,
	saClients map[string]kubernetes.ClientInterface,
	discovery istio.MeshDiscovery,
) (*Layer, error) {
	layer := &Layer{}

	// Initialize only the services needed for health computation
	layer.Health = NewHealthService(layer, conf, prom, userClients)
	layer.Namespace = NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)
	layer.Svc = SvcService{conf: conf, kialiCache: kialiCache, businessLayer: layer, prom: prom, userClients: userClients}
	layer.Workload = *NewWorkloadService(kialiCache, conf, nil, saClients, layer, prom, userClients)
	layer.App = NewAppService(layer, conf, prom, nil, userClients)

	return layer, nil
}
