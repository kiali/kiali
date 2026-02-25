package business

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

// ControlPlaneMonitor is an interface for the control plane monitor.
// This is an interface solely for testing purposes since we need to mock
// out portforwarding and polling.
type ControlPlaneMonitor interface {
	PollIstiodForProxyStatus(ctx context.Context)
	// RefreshIstioCache should update the kiali cache's istio related stores.
	RefreshIstioCache(ctx context.Context) error
}

func NewControlPlaneMonitor(cache cache.KialiCache, clientFactory kubernetes.ClientFactory, conf *config.Config, discovery istio.MeshDiscovery) *controlPlaneMonitor {
	return &controlPlaneMonitor{
		cache:           cache,
		clientFactory:   clientFactory,
		conf:            conf,
		discovery:       discovery,
		logger:          log.Logger().With().Str("component", "controlplane-monitor").Logger(),
		pollingInterval: time.Duration(conf.ExternalServices.Istio.IstiodPollingIntervalSeconds) * time.Second,
	}
}

// controlPlaneMonitor will periodically scrape the debug endpoint(s) of istiod.
// It scrapes a single pod from each controlplane. The list of controlplanes
// comes from the kialiCache. It will update the kialiCache with the info
// that it scrapes.
type controlPlaneMonitor struct {
	// Where we store the proxy status.
	cache cache.KialiCache
	// Used for getting the Kiali Service Account clients for all clusters.
	// Since these can change when clusters are added/removed we want to get
	// these directly from the client factory rather than passing in a static list.
	clientFactory   kubernetes.ClientFactory
	conf            *config.Config
	logger          zerolog.Logger
	discovery       istio.MeshDiscovery
	pollingInterval time.Duration
}

// RefreshIstioCache will scrape the debug endpoint(s) of istiod a single time
// and update the kialiCache with proxy status from /debug/syncz.
func (p *controlPlaneMonitor) RefreshIstioCache(ctx context.Context) error {
	p.logger.Debug().Msg("Scraping istiod for debug info")
	ctx, cancel := context.WithTimeout(ctx, p.pollingInterval)
	defer cancel()

	mesh, err := p.discovery.Mesh(ctx)
	if err != nil {
		return fmt.Errorf("unable to get mesh when refreshing istio cache: %s", err)
	}

	revisionsPerCluster := map[string][]models.ControlPlane{}
	for _, controlPlane := range mesh.ControlPlanes {
		clusterName := controlPlane.Cluster.Name
		revisionsPerCluster[clusterName] = append(revisionsPerCluster[clusterName], controlPlane)
	}

	var proxyStatus []*kubernetes.ProxyStatus
	for cluster, controlPlanes := range revisionsPerCluster {
		log := p.logger.With().Str("cluster", cluster).Logger()
		client := p.clientFactory.GetSAClient(cluster)
		if client == nil {
			log.Error().Msg("client for cluster does not exist")
			continue
		}

		interval := p.pollingInterval / 2

		for _, controlPlane := range controlPlanes {
			log := log.With().Str("revision", controlPlane.Revision).Logger()
			if controlPlane.Status != kubernetes.ComponentHealthy {
				log.Warn().Msg("Skipping controlplane because it is not healthy.")
				if controlPlane.Status == kubernetes.ComponentUnreachable {
					log.Warn().Msg("unable to proxy Istiod pods. " +
						"Make sure your Kubernetes API server has access to the Istio control plane through 8080 port")
				}
				continue
			}

			pstatus, err := p.getProxyStatusWithRetry(log.WithContext(ctx), interval, client, controlPlane)
			if err != nil {
				log.Warn().Msgf("Unable to get proxy status from istiod. Proxy status may be stale: %s", err)
				continue
			}
			proxyStatus = append(proxyStatus, pstatus...)
		}
	}

	p.cache.SetPodProxyStatus(proxyStatus)

	return nil
}

func (p *controlPlaneMonitor) PollIstiodForProxyStatus(ctx context.Context) {
	log := p.logger
	log.Debug().Msgf("Starting polling istiod(s) every %d seconds for proxy status", p.conf.ExternalServices.Istio.IstiodPollingIntervalSeconds)

	// Prime the pump once by calling refresh immediately here. Any errors are just logged
	// because they could be transient and we'll try again on the next interval.
	if err := p.RefreshIstioCache(ctx); err != nil {
		log.Error().Msgf("Unable to refresh istio cache: %s", err)
	}

	go func() {
		for {
			select {
			case <-ctx.Done():
				log.Debug().Msg("Stopping polling for istiod(s) proxy status")
				return
			case <-time.After(p.pollingInterval):
				if err := p.RefreshIstioCache(ctx); err != nil {
					log.Error().Msgf("Unable to refresh istio cache: %s", err)
				}
			}
		}
	}()
}

func (p *controlPlaneMonitor) getProxyStatusWithRetry(ctx context.Context, interval time.Duration, client kubernetes.ClientInterface, controlPlane models.ControlPlane) ([]*kubernetes.ProxyStatus, error) {
	log := zerolog.Ctx(ctx)
	var (
		proxyStatus []*kubernetes.ProxyStatus
		err         error
	)
	retryErr := wait.PollUntilContextCancel(ctx, interval, true, func(ctx context.Context) (bool, error) {
		log.Debug().Msgf("Getting proxy status from istiod")
		proxyStatus, err = p.getProxyStatus(ctx, client, controlPlane)
		if err != nil {
			return false, nil
		}

		return true, nil
	})
	if retryErr != nil {
		// Inner error may not be set if the operation timed out.
		if err == nil {
			err = retryErr
		}
		log.Warn().Msgf("Error getting proxy status from istiod. Proxy status may be stale. Err: %v", err)
		return nil, err
	}

	return proxyStatus, nil
}

func joinURL(base, path string) string {
	base = strings.TrimSuffix(base, "/")
	path = strings.TrimPrefix(path, "/")
	return base + "/" + path
}

func (p *controlPlaneMonitor) getIstiodDebugStatus(client kubernetes.ClientInterface, controlPlane models.ControlPlane, debugPath string) (map[string][]byte, error) {
	kubeCache, err := p.cache.GetKubeCache(client.ClusterInfo().Name)
	if err != nil {
		return nil, err
	}

	healthyIstiods, err := istio.GetHealthyIstiodPods(kubeCache, controlPlane.Revision, controlPlane.IstiodNamespace)
	if err != nil {
		return nil, err
	}

	wg := sync.WaitGroup{}
	wg.Add(len(healthyIstiods))
	errChan := make(chan error, len(healthyIstiods))
	syncChan := make(chan map[string][]byte, len(healthyIstiods))

	result := map[string][]byte{}
	for _, istiod := range healthyIstiods {
		go func(name, namespace string) {
			defer wg.Done()

			// The 15014 port on Istiod is open for control plane monitoring.
			// Here's the Istio doc page about the port usage by istio:
			// https://istio.io/latest/docs/ops/deployment/requirements/#ports-used-by-istio
			res, err := client.ForwardGetRequest(namespace, name, controlPlane.MonitoringPort, debugPath)
			if err != nil {
				errChan <- fmt.Errorf("%s: %s", name, err.Error())
			} else {
				syncChan <- map[string][]byte{name: res}
			}
		}(istiod.Name, istiod.Namespace)
	}

	wg.Wait()
	close(errChan)
	close(syncChan)

	errs := ""
	for err := range errChan {
		if errs != "" {
			errs = errs + "; "
		}
		errs = errs + err.Error()
	}
	errs = "Error fetching the proxy-status in the following pods: " + errs

	for status := range syncChan {
		for pilot, sync := range status {
			result[pilot] = sync
		}
	}

	if len(result) > 0 {
		return result, nil
	} else {
		return nil, errors.New(errs)
	}
}

func parseProxyStatus(statuses map[string][]byte) ([]*kubernetes.ProxyStatus, error) {
	var fullStatus []*kubernetes.ProxyStatus
	for pilot, status := range statuses {
		var ss []*kubernetes.ProxyStatus
		err := json.Unmarshal(status, &ss)
		if err != nil {
			return nil, err
		}
		for _, s := range ss {
			s.Pilot = pilot
		}
		fullStatus = append(fullStatus, ss...)
	}
	return fullStatus, nil
}

func (p *controlPlaneMonitor) getProxyStatus(ctx context.Context, client kubernetes.ClientInterface, controlPlane models.ControlPlane) ([]*kubernetes.ProxyStatus, error) {
	log := zerolog.Ctx(ctx)
	const synczPath = "/debug/syncz"

	debugStatus, err := p.getIstiodDebugStatus(client, controlPlane, synczPath)
	if err != nil {
		log.Error().Msgf("Failed to call Istiod endpoint %s error: %s", synczPath, err)
		return nil, err
	}
	return parseProxyStatus(debugStatus)
}

// Interface guards
var _ ControlPlaneMonitor = &controlPlaneMonitor{}
