package business

import (
	"context"
	"fmt"
	"time"

	prom "github.com/prometheus/client_golang/prometheus"
	"github.com/rs/zerolog"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// HealthMonitor is an interface for the health background job.
// This is an interface for testing purposes.
type HealthMonitor interface {
	// Start starts the background health refresh job.
	Start(ctx context.Context)
	// RefreshHealth performs a single refresh of the health cache.
	RefreshHealth(ctx context.Context) error
}

// FakeHealthMonitor is a no-op implementation for testing.
type FakeHealthMonitor struct{}

func (f *FakeHealthMonitor) Start(ctx context.Context)               {}
func (f *FakeHealthMonitor) RefreshHealth(ctx context.Context) error { return nil }

// NewHealthMonitor creates a new HealthMonitor.
func NewHealthMonitor(
	cache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	conf *config.Config,
	discovery istio.MeshDiscovery,
	prom prometheus.ClientInterface,
) *healthMonitor {
	return &healthMonitor{
		cache:         cache,
		clientFactory: clientFactory,
		conf:          conf,
		discovery:     discovery,
		lastRun:       time.Time{},
		logger:        log.Logger().With().Str("component", "health-monitor").Logger(),
		prom:          prom,
	}
}

// healthMonitor pre-computes health for all namespaces and caches the results.
type healthMonitor struct {
	cache         cache.KialiCache
	clientFactory kubernetes.ClientFactory
	conf          *config.Config
	discovery     istio.MeshDiscovery
	lastRun       time.Time
	logger        zerolog.Logger
	prom          prometheus.ClientInterface
}

// Start starts the background health refresh loop.
func (m *healthMonitor) Start(ctx context.Context) {
	interval, err := m.conf.HealthConfig.Compute.RefreshInterval.ToDuration()
	if err != nil {
		m.logger.Warn().Err(err).Str("refreshInterval", string(m.conf.HealthConfig.Compute.RefreshInterval)).Msg("Invalid refresh interval, using 2m")
		interval = 3 * time.Minute
	}
	timeout, err := m.conf.HealthConfig.Compute.Timeout.ToDuration()
	if err != nil {
		m.logger.Warn().Err(err).Str("timeout", string(m.conf.HealthConfig.Compute.Timeout)).Msg("Invalid timeout, using 5m")
		timeout = 10 * time.Minute
	}
	m.logger.Info().Msgf("Starting health monitor with refresh interval: %s, timeout: %s", m.conf.HealthConfig.Compute.RefreshInterval, m.conf.HealthConfig.Compute.Timeout)

	// Prime the cache with an initial refresh (with timeout)
	refreshCtx, cancel := context.WithTimeout(ctx, timeout)
	if err := m.RefreshHealth(refreshCtx); err != nil {
		m.logger.Error().Err(err).Msg("Initial health refresh failed")
	}
	cancel()

	go func() {
		for {
			select {
			case <-ctx.Done():
				m.logger.Info().Msg("Stopping health monitor")
				return
			case <-time.After(interval):
				refreshCtx, cancel := context.WithTimeout(ctx, timeout)
				if err := m.RefreshHealth(refreshCtx); err != nil {
					m.logger.Error().Err(err).Msg("Health refresh failed")
				}
				cancel()
			}
		}
	}()
}

// RefreshHealth performs a single refresh of the entire health cache.
func (m *healthMonitor) RefreshHealth(ctx context.Context) error {
	startTime := time.Now()
	m.logger.Debug().Msg("Starting health refresh")

	// Calculate rate interval
	healthDuration := m.calculateDuration()

	// Get clusters from cache
	clusters := m.cache.GetClusters()
	if len(clusters) == 0 {
		m.logger.Warn().Msg("No clusters found, skipping health refresh")
		return nil
	}

	// Create a single Layer for the entire refresh cycle (reused across all namespaces)
	layer, err := m.createHealthLayer()
	if err != nil {
		return fmt.Errorf("failed to create layer for health refresh: %w", err)
	}

	totalNamespaces := 0
	totalErrors := 0

	for _, cluster := range clusters {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		nsCount, errCount := m.refreshClusterHealth(ctx, layer, cluster.Name, healthDuration)
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
		Msg("Health refresh completed")

	return nil
}

// createHealthLayer creates a full Layer for health computation using SA clients.
// This Layer is reused for all namespace health computations in a refresh cycle.
func (m *healthMonitor) createHealthLayer() (*Layer, error) {
	userClients := m.clientFactory.GetSAClientsAsUserClientInterfaces()
	discovery, ok := m.discovery.(*istio.Discovery)
	if !ok {
		return nil, fmt.Errorf("unsupported discovery type for health monitor: %T", m.discovery)
	}

	// Use the existing NewLayerWithSAClients which creates a complete Layer
	// Pass nil for tracing client and grafana since health computation doesn't need them
	// Pass FakeControlPlaneMonitor since health computation doesn't need control plane monitoring
	return NewLayerWithSAClients(
		m.conf,
		m.cache,
		m.prom,
		nil, // traceClient - not needed for health
		&FakeControlPlaneMonitor{},
		nil, // grafana - not needed for health
		discovery,
		userClients,
	)
}

// refreshClusterHealth refreshes health for all namespaces in a cluster.
// Returns the number of namespaces processed and the number of errors.
func (m *healthMonitor) refreshClusterHealth(ctx context.Context, layer *Layer, cluster, duration string) (int, int) {
	log := m.logger.With().Str("cluster", cluster).Logger()
	log.Debug().Msg("Refreshing health for cluster")

	// Track cluster refresh duration if metrics are enabled
	var timer *prom.Timer
	if m.conf.Server.Observability.Metrics.Enabled {
		timer = internalmetrics.GetHealthRefreshDurationTimer(cluster)
		defer timer.ObserveDuration()
	}

	// Verify we have access to this cluster
	if m.clientFactory.GetSAClient(cluster) == nil {
		log.Error().Msg("No SA client for cluster")
		return 0, 1
	}

	// Get namespaces accessible to Kiali using the Layer's NamespaceService
	// This respects Kiali's namespace filtering configuration
	namespaces, err := layer.Namespace.GetClusterNamespaces(ctx, cluster)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get namespaces for cluster")
		return 0, 1
	}

	errorCount := 0
	for _, ns := range namespaces {
		if ctx.Err() != nil {
			return len(namespaces), errorCount
		}

		if err := m.refreshNamespaceHealth(ctx, layer, cluster, ns.Name, duration); err != nil {
			log.Warn().Err(err).Str("namespace", ns.Name).Msg("Failed to refresh health for namespace")
			errorCount++
		}
	}

	return len(namespaces), errorCount
}

// refreshNamespaceHealth computes and caches health for a single namespace.
func (m *healthMonitor) refreshNamespaceHealth(ctx context.Context, layer *Layer, cluster, namespace, duration string) error {
	log := m.logger.With().
		Str("cluster", cluster).
		Str("namespace", namespace).
		Logger()
	log.Debug().Msg("Computing health for namespace")

	queryTime := time.Now()

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

	// Export health status metrics if enabled
	if m.conf.Server.Observability.Metrics.Enabled {
		m.exportHealthStatusMetrics(cluster, namespace, appHealth, serviceHealth, workloadHealth)
	}

	return nil
}

// exportHealthStatusMetrics exports health status for each individual item as Prometheus metrics
// using the state cardinality pattern (one metric per state, exactly one set to 1).
// Uses the pre-calculated Status field from the health data.
func (m *healthMonitor) exportHealthStatusMetrics(
	cluster, namespace string,
	appHealth models.NamespaceAppHealth,
	serviceHealth models.NamespaceServiceHealth,
	workloadHealth models.NamespaceWorkloadHealth,
) {
	// Export app health metrics using pre-calculated status
	for appName, health := range appHealth {
		if health.Status != nil {
			internalmetrics.SetHealthStatusForItem(cluster, namespace, internalmetrics.HealthTypeApp, appName, string(health.Status.Status))
		}
	}

	// Export service health metrics using pre-calculated status
	for svcName, health := range serviceHealth {
		if health.Status != nil {
			internalmetrics.SetHealthStatusForItem(cluster, namespace, internalmetrics.HealthTypeService, svcName, string(health.Status.Status))
		}
	}

	// Export workload health metrics using pre-calculated status
	for wkName, health := range workloadHealth {
		if health.Status != nil {
			internalmetrics.SetHealthStatusForItem(cluster, namespace, internalmetrics.HealthTypeWorkload, wkName, string(health.Status.Status))
		}
	}
}

// calculateDuration calculates the health duration based on configuration and elapsed time.
// On first run, it uses the configured duration. On subsequent runs, if the elapsed time
// since the last run exceeds the configured duration, it extends the interval to cover
// the elapsed period (with a 10% buffer).
func (m *healthMonitor) calculateDuration() string {
	configuredDuration, err := m.conf.HealthConfig.Compute.Duration.ToDuration()
	if err != nil {
		m.logger.Warn().Err(err).Str("duration", string(m.conf.HealthConfig.Compute.Duration)).Msg("Invalid duration, using 5m")
		return "5m"
	}

	// First run - use the configured duration
	if m.lastRun.IsZero() {
		return string(m.conf.HealthConfig.Compute.Duration)
	}

	elapsed := time.Since(m.lastRun)

	// If elapsed time is within the configured duration, use the configured duration
	if elapsed <= configuredDuration {
		return string(m.conf.HealthConfig.Compute.Duration)
	}

	// Elapsed time exceeds configured duration - extend the interval
	// Add a small buffer (10%) to ensure we cover the entire period
	interval := time.Duration(float64(elapsed) * 1.1)

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
