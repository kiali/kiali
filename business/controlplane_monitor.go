package business

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

// ControlPlaneMonitor is an interface for the control plane monitor.
// This is an interface solely for testing purposes since we need to mock
// out portforwarding and polling.
type ControlPlaneMonitor interface {
	PollIstiodForProxyStatus(ctx context.Context)
	CanConnectToIstiod(client kubernetes.ClientInterface) (kubernetes.IstioComponentStatus, error)
	CanConnectToIstiodForRevision(client kubernetes.ClientInterface, revision string) (kubernetes.IstioComponentStatus, error)
	// RefreshIstioCache should update the kiali cache's istio related stores.
	RefreshIstioCache(ctx context.Context) error
}

func NewControlPlaneMonitor(cache cache.KialiCache, clientFactory kubernetes.ClientFactory, conf config.Config, discovery *istio.Discovery) *controlPlaneMonitor {
	return &controlPlaneMonitor{
		cache:           cache,
		clientFactory:   clientFactory,
		conf:            conf,
		discovery:       discovery,
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
	conf            config.Config
	discovery       *istio.Discovery
	pollingInterval time.Duration
}

// RefreshIstioCache will scrape the debug endpoint(s) of istiod a single time
// and update the kialiCache. The proxy status and the registry services are
// scraped from the debug endpoint.
func (p *controlPlaneMonitor) RefreshIstioCache(ctx context.Context) error {
	log.Debug("Scraping istiod for debug info")
	ctx, cancel := context.WithTimeout(ctx, p.pollingInterval)
	defer cancel()

	mesh, err := p.discovery.Mesh(ctx)
	if err != nil {
		return fmt.Errorf("unable to get mesh when refreshing istio cache: %s", err)
	}

	// Get the list of controlplanes we are polling.
	revisionsPerCluster := map[string][]models.ControlPlane{}
	for _, controlPlane := range mesh.ControlPlanes {
		clusterName := controlPlane.Cluster.Name
		revisionsPerCluster[clusterName] = append(revisionsPerCluster[clusterName], controlPlane)
	}

	// Proxy status endpoint has unique results per controlplane whereas services/config are duplicated across
	// all controlplanes for that cluster so we'll get the proxy status per controlplane e.g. from both istiod-rev-1
	// and istiod-rev-2 but the services will only be gotten from one of the istiods.
	var proxyStatus []*kubernetes.ProxyStatus
	registryStatus := make(map[string]*kubernetes.RegistryStatus)
	for cluster, controlPlanes := range revisionsPerCluster {
		client := p.clientFactory.GetSAClient(cluster)
		if client == nil {
			log.Errorf("client for cluster [%s] does not exist", cluster)
			// Even if one cluster is down we're going to continue to try and get results for the rest.
			continue
		}

		// Retry roughly once. Context set to timeout after p.interval should cancel before any subsequent retries.
		interval := p.pollingInterval / 2

		for _, controlPlane := range controlPlanes {
			pstatus, err := p.getProxyStatusWithRetry(ctx, interval, client, controlPlane.Revision, controlPlane.IstiodNamespace)
			if err != nil {
				log.Warningf("Unable to get proxy status from istiod for revision: [%s] and cluster: [%s]. Proxy status may be stale: %s", controlPlane.Revision, client.ClusterInfo().Name, err)
				continue
			}
			proxyStatus = append(proxyStatus, pstatus...)
		}

		// Services can just be done once per cluster since these are shared across revisions
		// Whereas the proxy status is per revision.
		if len(controlPlanes) > 0 {
			// Since it doesn't matter what revision we choose, just choose the first one.
			controlPlane := controlPlanes[0]
			status := &kubernetes.RegistryStatus{}
			services, err := p.getServicesWithRetry(ctx, interval, client, controlPlane.Revision, controlPlane.IstiodNamespace)
			if err != nil {
				log.Warningf("Unable to get registry services from istiod for revision: [%s] and cluster: [%s]. Registry services may be stale: %s", controlPlane.Revision, client.ClusterInfo().Name, err)
				continue
			}
			status.Services = services
			registryStatus[cluster] = status
		}
	}

	p.cache.SetRegistryStatus(registryStatus)
	p.cache.SetPodProxyStatus(proxyStatus)

	return nil
}

func (p *controlPlaneMonitor) PollIstiodForProxyStatus(ctx context.Context) {
	log.Debugf("Starting polling istiod(s) every %d seconds for proxy status", p.conf.ExternalServices.Istio.IstiodPollingIntervalSeconds)

	// Prime the pump once by calling refresh immediately here. Any errors are just logged
	// because they could be transient and we'll try again on the next interval.
	if err := p.RefreshIstioCache(ctx); err != nil {
		log.Errorf("Unable to refresh istio cache: %s", err)
	}

	go func() {
		for {
			select {
			case <-ctx.Done():
				log.Debug("Stopping polling for istiod(s) proxy status")
				return
			case <-time.After(p.pollingInterval):
				if err := p.RefreshIstioCache(ctx); err != nil {
					log.Errorf("Unable to refresh istio cache: %s", err)
				}
			}
		}
	}()
}

func (p *controlPlaneMonitor) getProxyStatusWithRetry(ctx context.Context, interval time.Duration, client kubernetes.ClientInterface, revision string, namespace string) ([]*kubernetes.ProxyStatus, error) {
	var (
		proxyStatus []*kubernetes.ProxyStatus
		err         error
	)
	retryErr := wait.PollUntilContextCancel(ctx, interval, true, func(ctx context.Context) (bool, error) {
		log.Tracef("Getting proxy status from istiod in cluster [%s] for revision [%s]", client.ClusterInfo().Name, revision)
		var err error
		proxyStatus, err = p.getProxyStatus(client, revision, namespace)
		if err != nil {
			return false, nil
		}

		return true, nil
	})
	if retryErr != nil {
		log.Warningf("Error getting proxy status from istiod. Proxy status may be stale. Err: %v", err)
		return nil, err
	}

	return proxyStatus, nil
}

func (p *controlPlaneMonitor) getServicesWithRetry(ctx context.Context, interval time.Duration, client kubernetes.ClientInterface, revision string, namespace string) ([]*kubernetes.RegistryService, error) {
	var (
		registryServices []*kubernetes.RegistryService
		err              error
	)
	retryErr := wait.PollUntilContextCancel(ctx, interval, true, func(ctx context.Context) (bool, error) {
		log.Tracef("Getting services from istiod in cluster [%s] for revision [%s]", client.ClusterInfo().Name, revision)
		var err error
		registryServices, err = p.getRegistryServices(client, revision, namespace)
		if err != nil {
			return false, nil
		}

		return true, nil
	})
	if retryErr != nil {
		log.Warningf("Error getting proxy status from istiod. Proxy status may be stale. Err: %v", err)
		return nil, err
	}

	return registryServices, nil
}

func joinURL(base, path string) string {
	base = strings.TrimSuffix(base, "/")
	path = strings.TrimPrefix(path, "/")
	return base + "/" + path
}

func getRequest(url string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("unable to read response body when getting config from remote istiod. Err: %s", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bad response when getting config from remote istiod. Status: %s. Body: %s", resp.Status, body)
	}

	return body, err
}

func (p *controlPlaneMonitor) getIstiodDebugStatus(client kubernetes.ClientInterface, revision string, namespace string, debugPath string) (map[string][]byte, error) {
	// Check if the kube-api has proxy access to pods in the istio-system
	// https://github.com/kiali/kiali/issues/3494#issuecomment-772486224
	status, err := p.canConnectToIstiodForRevision(client, revision, namespace)
	if err != nil {
		return nil, fmt.Errorf("unable to connect to Istiod pods on cluster [%s] for revision [%s]: %s", client.ClusterInfo().Name, revision, err.Error())
	}

	istiodReachable := false
	for _, istiodStatus := range status {
		if istiodStatus.Status != kubernetes.ComponentUnreachable {
			istiodReachable = true
			break
		}
	}
	if !istiodReachable {
		return nil, fmt.Errorf("unable to proxy Istiod pods. " +
			"Make sure your Kubernetes API server has access to the Istio control plane through 8080 port")
	}

	var healthyIstiods kubernetes.IstioComponentStatus
	for _, istiod := range status {
		if istiod.Status == kubernetes.ComponentHealthy {
			healthyIstiods = append(healthyIstiods, istiod)
		}
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
			res, err := client.ForwardGetRequest(namespace, name, p.conf.ExternalServices.Istio.IstiodPodMonitoringPort, debugPath)
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

// CanConnectToIstiod checks if Kiali can reach the istiod pod(s) via port
// fowarding through the k8s api server or via http if the registry is
// configured with a remote url. An error does not indicate that istiod
// cannot be reached. The kubernetes.IstioComponentStatus must be checked.
func (p *controlPlaneMonitor) CanConnectToIstiodForRevision(client kubernetes.ClientInterface, revision string) (kubernetes.IstioComponentStatus, error) {
	return p.canConnectToIstiodForRevision(client, revision, p.conf.IstioNamespace)
}

// CanConnectToIstiod checks if Kiali can reach the istiod pod(s) via port
// fowarding through the k8s api server or via http if the registry is
// configured with a remote url. An error does not indicate that istiod
// cannot be reached. The kubernetes.IstioComponentStatus must be checked.
func (p *controlPlaneMonitor) canConnectToIstiodForRevision(client kubernetes.ClientInterface, revision string, namespace string) (kubernetes.IstioComponentStatus, error) {
	if p.conf.ExternalServices.Istio.Registry != nil && p.conf.ExternalServices.Istio.Registry.IstiodURL != "" {
		istiodURL := p.conf.ExternalServices.Istio.Registry.IstiodURL
		// Being able to hit /debug doesn't necessarily mean we are authorized to hit the others.
		url := joinURL(istiodURL, "/debug")
		if _, err := getRequest(url); err != nil {
			log.Warningf("Kiali can't connect to remote Istiod: %s", err)
			return kubernetes.IstioComponentStatus{{Name: istiodURL, Status: kubernetes.ComponentUnreachable, IsCore: true}}, nil
		}
		return kubernetes.IstioComponentStatus{{Name: istiodURL, Status: kubernetes.ComponentHealthy, IsCore: true}}, nil
	}

	kubeCache, err := p.cache.GetKubeCache(client.ClusterInfo().Name)
	if err != nil {
		return nil, err
	}

	podLabels := map[string]string{
		"app":                     "istiod",
		models.IstioRevisionLabel: revision,
	}
	istiods, err := kubeCache.GetPods(namespace, labels.Set(podLabels).String())
	if err != nil {
		return nil, err
	}

	healthyIstiods := make([]*corev1.Pod, 0, len(istiods))
	for i, istiod := range istiods {
		if istiod.Status.Phase == corev1.PodRunning {
			healthyIstiods = append(healthyIstiods, &istiods[i])
		}
	}

	wg := sync.WaitGroup{}
	wg.Add(len(healthyIstiods))
	syncChan := make(chan kubernetes.ComponentStatus, len(healthyIstiods))

	for _, istiod := range healthyIstiods {
		go func(name, namespace string) {
			defer wg.Done()

			status := kubernetes.ComponentHealthy
			// The 8080 port is not accessible from outside of the pod. However, it is used for kubernetes to do the live probes.
			// Using the proxy method to make sure that K8s API has access to the Istio Control Plane namespace.
			// By proxying one Istiod, we ensure that the following connection is allowed:
			// Kiali -> K8s API (proxy) -> istiod
			// This scenario is not obvious for private clusters (like GKE private cluster)
			_, err := client.ForwardGetRequest(namespace, name, 8080, "/ready")
			if err != nil {
				log.Warningf("Unable to get ready status of istiod: %s/%s. Err: %s", namespace, name, err)
				status = kubernetes.ComponentUnreachable
			}

			syncChan <- kubernetes.ComponentStatus{
				Name:      name,
				Namespace: namespace,
				Status:    status,
				IsCore:    true,
			}
		}(istiod.Name, istiod.Namespace)
	}

	wg.Wait()
	close(syncChan)
	ics := kubernetes.IstioComponentStatus{}
	for componentStatus := range syncChan {
		ics.Merge(kubernetes.IstioComponentStatus{componentStatus})
	}

	return ics, nil
}

func (p *controlPlaneMonitor) CanConnectToIstiod(client kubernetes.ClientInterface) (kubernetes.IstioComponentStatus, error) {
	if p.conf.ExternalServices.Istio.Registry != nil && p.conf.ExternalServices.Istio.Registry.IstiodURL != "" {
		istiodURL := p.conf.ExternalServices.Istio.Registry.IstiodURL
		// Being able to hit /debug doesn't necessarily mean we are authorized to hit the others.
		url := joinURL(istiodURL, "/debug")
		if _, err := getRequest(url); err != nil {
			log.Warningf("Kiali can't connect to remote Istiod: %s", err)
			return kubernetes.IstioComponentStatus{{Name: istiodURL, Status: kubernetes.ComponentUnreachable, IsCore: true}}, nil
		}
		return kubernetes.IstioComponentStatus{{Name: istiodURL, Status: kubernetes.ComponentHealthy, IsCore: true}}, nil
	}

	kubeCache, err := p.cache.GetKubeCache(client.ClusterInfo().Name)
	if err != nil {
		return nil, err
	}

	// Find the rev label for the controlplane that is set in the config.
	istiod, err := kubeCache.GetDeployment(p.conf.IstioNamespace, p.conf.ExternalServices.Istio.IstiodDeploymentName)
	if err != nil {
		return nil, err
	}

	return p.CanConnectToIstiodForRevision(client, istiod.Labels[models.IstioRevisionLabel])
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

func (p *controlPlaneMonitor) getProxyStatus(client kubernetes.ClientInterface, revision string, namespace string) ([]*kubernetes.ProxyStatus, error) {
	const synczPath = "/debug/syncz"
	var result map[string][]byte

	if externalConf := p.conf.ExternalServices.Istio.Registry; externalConf != nil && externalConf.IstiodURL != "" {
		url := joinURL(externalConf.IstiodURL, synczPath)
		r, err := getRequest(url)
		if err != nil {
			log.Errorf("Failed to get Istiod info from remote endpoint %s error: %s", synczPath, err)
			return nil, err
		}
		result = map[string][]byte{"remote": r}
	} else {
		debugStatus, err := p.getIstiodDebugStatus(client, revision, namespace, synczPath)
		if err != nil {
			log.Errorf("Failed to call Istiod endpoint %s error: %s", synczPath, err)
			return nil, err
		}
		result = debugStatus
	}
	return parseProxyStatus(result)
}

func (p *controlPlaneMonitor) getRegistryServices(client kubernetes.ClientInterface, revision string, namespace string) ([]*kubernetes.RegistryService, error) {
	const registryzPath = "/debug/registryz"
	var result map[string][]byte

	if externalConf := p.conf.ExternalServices.Istio.Registry; externalConf != nil && externalConf.IstiodURL != "" {
		url := joinURL(externalConf.IstiodURL, registryzPath)
		r, err := getRequest(url)
		if err != nil {
			log.Errorf("Failed to get Istiod info from remote endpoint %s error: %s", registryzPath, err)
			return nil, err
		}
		result = map[string][]byte{"remote": r}
	} else {
		debugStatus, err := p.getIstiodDebugStatus(client, revision, namespace, registryzPath)
		if err != nil {
			log.Errorf("Failed to call Istiod endpoint %s error: %s", registryzPath, err)
			return nil, err
		}
		result = debugStatus
	}
	return parseRegistryServices(result)
}

func parseRegistryServices(registries map[string][]byte) ([]*kubernetes.RegistryService, error) {
	var fullRegistryServices []*kubernetes.RegistryService
	isRegistryLoaded := false
	for pilot, registry := range registries {
		// skip reading registry configs multiple times in a case of multiple istiod pods
		if isRegistryLoaded {
			break
		}
		var rr []*kubernetes.RegistryService
		err := json.Unmarshal(registry, &rr)
		if err != nil {
			log.Errorf("Error parsing RegistryServices results: %s", err)
			return nil, err
		}
		for _, r := range rr {
			r.Pilot = pilot
		}
		fullRegistryServices = append(fullRegistryServices, rr...)
		if len(rr) > 0 {
			isRegistryLoaded = true
		}
	}
	return fullRegistryServices, nil
}

// Interface guards
var _ ControlPlaneMonitor = &controlPlaneMonitor{}
