package business

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"

	"gopkg.in/yaml.v2"
	extentions_v1alpha1 "istio.io/client-go/pkg/apis/extensions/v1alpha1"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"
	"istio.io/client-go/pkg/apis/telemetry/v1alpha1"
	api_errors "k8s.io/apimachinery/pkg/api/errors"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	api_types "k8s.io/apimachinery/pkg/types"
	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
)

const allResources string = "*"

type IstioConfigService struct {
	userClients   map[string]kubernetes.ClientInterface
	config        config.Config
	kialiCache    cache.KialiCache
	businessLayer *Layer
}

type IstioConfigCriteria struct {
	// When AllNamespaces is true the IstioConfigService will use the Istio registry to return the configuration
	// from all namespaces directly from the Istio registry instead of the individual API
	// This usecase should be reserved for validations use cases only where cross-namespace validation may create a
	// penalty
	AllNamespaces                 bool
	Namespace                     string
	Cluster                       string
	IncludeGateways               bool
	IncludeK8sGateways            bool
	IncludeK8sHTTPRoutes          bool
	IncludeVirtualServices        bool
	IncludeDestinationRules       bool
	IncludeServiceEntries         bool
	IncludeSidecars               bool
	IncludeAuthorizationPolicies  bool
	IncludePeerAuthentications    bool
	IncludeWorkloadEntries        bool
	IncludeWorkloadGroups         bool
	IncludeRequestAuthentications bool
	IncludeEnvoyFilters           bool
	IncludeWasmPlugins            bool
	IncludeTelemetry              bool
	LabelSelector                 string
	WorkloadSelector              string
}

func (icc IstioConfigCriteria) Include(resource string) bool {
	// Flag used to skip object that are not used in a query when a WorkloadSelector is present
	isWorkloadSelector := icc.WorkloadSelector != ""
	switch resource {
	case kubernetes.Gateways:
		return icc.IncludeGateways
	case kubernetes.K8sGateways:
		return icc.IncludeK8sGateways
	case kubernetes.K8sHTTPRoutes:
		return icc.IncludeK8sHTTPRoutes
	case kubernetes.VirtualServices:
		return icc.IncludeVirtualServices && !isWorkloadSelector
	case kubernetes.DestinationRules:
		return icc.IncludeDestinationRules && !isWorkloadSelector
	case kubernetes.ServiceEntries:
		return icc.IncludeServiceEntries && !isWorkloadSelector
	case kubernetes.Sidecars:
		return icc.IncludeSidecars
	case kubernetes.AuthorizationPolicies:
		return icc.IncludeAuthorizationPolicies
	case kubernetes.PeerAuthentications:
		return icc.IncludePeerAuthentications
	case kubernetes.WorkloadEntries:
		return icc.IncludeWorkloadEntries && !isWorkloadSelector
	case kubernetes.WorkloadGroups:
		return icc.IncludeWorkloadGroups && !isWorkloadSelector
	case kubernetes.RequestAuthentications:
		return icc.IncludeRequestAuthentications
	case kubernetes.EnvoyFilters:
		return icc.IncludeEnvoyFilters
	case kubernetes.WasmPlugins:
		return icc.IncludeWasmPlugins
	case kubernetes.Telemetries:
		return icc.IncludeTelemetry
	}
	return false
}

// IstioConfig types used in the IstioConfig New Page Form
// networking.istio.io
var newNetworkingConfigTypes = []string{
	kubernetes.Sidecars,
	kubernetes.Gateways,
	kubernetes.ServiceEntries,
}

// gateway.networking.k8s.io
var newK8sNetworkingConfigTypes = []string{
	kubernetes.K8sGateways,
}

// security.istio.io
var newSecurityConfigTypes = []string{
	kubernetes.AuthorizationPolicies,
	kubernetes.PeerAuthentications,
	kubernetes.RequestAuthentications,
}

// GetIstioConfigList returns a list of Istio routing objects, Mixer Rules, (etc.)
// per a given Namespace.
func (in *IstioConfigService) GetIstioConfigList(ctx context.Context, criteria IstioConfigCriteria) (models.IstioConfigList, error) {
	istioConfigList := models.IstioConfigList{}
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	for cluster := range in.userClients {
		singleClusterConfigList, err := in.GetIstioConfigListPerCluster(ctx, criteria, cluster)
		if err != nil {
			if cluster == kubernetes.HomeClusterName && len(in.userClients) == 1 {
				return models.IstioConfigList{}, err
			}

			if api_errors.IsNotFound(err) || api_errors.IsForbidden(err) {
				// If a cluster is not found or not accessible, then we skip it
				log.Debugf("Error while accessing to cluster [%s]: %s", cluster, err.Error())
				continue
			}

			log.Errorf("Unable to get config list from cluster: %s. Err: %s. Skipping", cluster, err)
			continue
		}

		istioConfigList.DestinationRules = append(istioConfigList.DestinationRules, singleClusterConfigList.DestinationRules...)
		istioConfigList.EnvoyFilters = append(istioConfigList.EnvoyFilters, singleClusterConfigList.EnvoyFilters...)
		istioConfigList.Gateways = append(istioConfigList.Gateways, singleClusterConfigList.Gateways...)
		istioConfigList.K8sGateways = append(istioConfigList.K8sGateways, singleClusterConfigList.K8sGateways...)
		istioConfigList.K8sHTTPRoutes = append(istioConfigList.K8sHTTPRoutes, singleClusterConfigList.K8sHTTPRoutes...)
		istioConfigList.VirtualServices = append(istioConfigList.VirtualServices, singleClusterConfigList.VirtualServices...)
		istioConfigList.ServiceEntries = append(istioConfigList.ServiceEntries, singleClusterConfigList.ServiceEntries...)
		istioConfigList.Sidecars = append(istioConfigList.Sidecars, singleClusterConfigList.Sidecars...)
		istioConfigList.WorkloadEntries = append(istioConfigList.WorkloadEntries, singleClusterConfigList.WorkloadEntries...)
		istioConfigList.WorkloadGroups = append(istioConfigList.WorkloadGroups, singleClusterConfigList.WorkloadGroups...)
		istioConfigList.AuthorizationPolicies = append(istioConfigList.AuthorizationPolicies, singleClusterConfigList.AuthorizationPolicies...)
		istioConfigList.PeerAuthentications = append(istioConfigList.PeerAuthentications, singleClusterConfigList.PeerAuthentications...)
		istioConfigList.RequestAuthentications = append(istioConfigList.RequestAuthentications, singleClusterConfigList.RequestAuthentications...)
		istioConfigList.WasmPlugins = append(istioConfigList.WasmPlugins, singleClusterConfigList.WasmPlugins...)
		istioConfigList.Telemetries = append(istioConfigList.Telemetries, singleClusterConfigList.Telemetries...)
		istioConfigList.Namespace = singleClusterConfigList.Namespace
		istioConfigList.IstioValidations = istioConfigList.IstioValidations.MergeValidations(singleClusterConfigList.IstioValidations)
	}

	return istioConfigList, nil
}

func (in *IstioConfigService) GetIstioConfigListPerCluster(ctx context.Context, criteria IstioConfigCriteria, cluster string) (models.IstioConfigList, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetIstioConfigList",
		observability.Attribute("package", "business"),
	)
	defer end()

	if criteria.Namespace == "" && !criteria.AllNamespaces {
		return models.IstioConfigList{}, errors.New("GetIstioConfigList needs a non empty Namespace")
	}
	istioConfigList := models.IstioConfigList{
		Namespace: models.Namespace{Name: criteria.Namespace},

		DestinationRules: []*networking_v1beta1.DestinationRule{},
		EnvoyFilters:     []*networking_v1alpha3.EnvoyFilter{},
		Gateways:         []*networking_v1beta1.Gateway{},
		VirtualServices:  []*networking_v1beta1.VirtualService{},
		ServiceEntries:   []*networking_v1beta1.ServiceEntry{},
		Sidecars:         []*networking_v1beta1.Sidecar{},
		WorkloadEntries:  []*networking_v1beta1.WorkloadEntry{},
		WorkloadGroups:   []*networking_v1beta1.WorkloadGroup{},
		WasmPlugins:      []*extentions_v1alpha1.WasmPlugin{},
		Telemetries:      []*v1alpha1.Telemetry{},

		K8sGateways:   []*k8s_networking_v1beta1.Gateway{},
		K8sHTTPRoutes: []*k8s_networking_v1beta1.HTTPRoute{},

		AuthorizationPolicies:  []*security_v1beta1.AuthorizationPolicy{},
		PeerAuthentications:    []*security_v1beta1.PeerAuthentication{},
		RequestAuthentications: []*security_v1beta1.RequestAuthentication{},
	}

	// Use the Istio Registry when AllNamespaces is present
	if criteria.AllNamespaces && in.config.ExternalServices.Istio.IstioAPIEnabled {
		registryCriteria := RegistryCriteria{
			AllNamespaces: true,
		}
		if _, ok := in.businessLayer.RegistryStatuses[cluster]; !ok {
			return istioConfigList, fmt.Errorf("Registry Cache for Cluster [%s] is not found or is not accessible for Kiali", cluster)
		}
		registryStatus := in.businessLayer.RegistryStatuses[cluster]
		registryConfiguration, err := registryStatus.GetRegistryConfiguration(registryCriteria)
		if err != nil {
			return istioConfigList, err
		}
		if registryConfiguration == nil {
			log.Warningf("RegistryConfiguration is nil. This is an unexpected case. Is the Kiali cache disabled ?")
			return istioConfigList, nil
		}
		// AllNamespaces will return an empty namespace
		istioConfigList.Namespace.Name = ""

		if criteria.Include(kubernetes.DestinationRules) {
			istioConfigList.DestinationRules = registryConfiguration.DestinationRules
		}
		if criteria.Include(kubernetes.EnvoyFilters) {
			istioConfigList.EnvoyFilters = registryConfiguration.EnvoyFilters
		}
		if criteria.Include(kubernetes.Gateways) {
			istioConfigList.Gateways = kubernetes.FilterSupportedGateways(registryConfiguration.Gateways)
		}
		if criteria.Include(kubernetes.K8sGateways) {
			istioConfigList.K8sGateways = kubernetes.FilterSupportedK8sGateways(registryConfiguration.K8sGateways)
		}
		if criteria.Include(kubernetes.K8sHTTPRoutes) {
			istioConfigList.K8sHTTPRoutes = registryConfiguration.K8sHTTPRoutes
		}
		if criteria.Include(kubernetes.VirtualServices) {
			istioConfigList.VirtualServices = registryConfiguration.VirtualServices
		}
		if criteria.Include(kubernetes.ServiceEntries) {
			istioConfigList.ServiceEntries = registryConfiguration.ServiceEntries
		}
		if criteria.Include(kubernetes.Sidecars) {
			istioConfigList.Sidecars = registryConfiguration.Sidecars
		}
		if criteria.Include(kubernetes.WorkloadEntries) {
			istioConfigList.WorkloadEntries = registryConfiguration.WorkloadEntries
		}
		if criteria.Include(kubernetes.WorkloadGroups) {
			istioConfigList.WorkloadGroups = registryConfiguration.WorkloadGroups
		}
		if criteria.Include(kubernetes.WasmPlugins) {
			istioConfigList.WasmPlugins = registryConfiguration.WasmPlugins
		}
		if criteria.Include(kubernetes.Telemetries) {
			istioConfigList.Telemetries = registryConfiguration.Telemetries
		}
		if criteria.Include(kubernetes.AuthorizationPolicies) {
			istioConfigList.AuthorizationPolicies = registryConfiguration.AuthorizationPolicies
		}
		if criteria.Include(kubernetes.PeerAuthentications) {
			istioConfigList.PeerAuthentications = registryConfiguration.PeerAuthentications
		}
		if criteria.Include(kubernetes.RequestAuthentications) {
			istioConfigList.RequestAuthentications = registryConfiguration.RequestAuthentications
		}

		return istioConfigList, nil
	}
	kubeCache := in.kialiCache.GetKubeCaches()[cluster]
	if kubeCache == nil {
		return istioConfigList, fmt.Errorf("K8s Cache [%s] is not found or is not accessible for Kiali", cluster)
	}
	userClient := in.userClients[cluster]
	if userClient == nil {
		return istioConfigList, fmt.Errorf("K8s Client [%s] is not found or is not accessible for Kiali", cluster)
	}

	if !criteria.AllNamespaces {
		// Check if user has access to the namespace (RBAC) in cache scenarios and/or
		// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
		if _, err := in.businessLayer.Namespace.GetNamespaceByCluster(ctx, criteria.Namespace, cluster); err != nil {
			return models.IstioConfigList{}, err
		}
	}

	isWorkloadSelector := criteria.WorkloadSelector != ""
	workloadSelector := ""
	if isWorkloadSelector {
		workloadSelector = criteria.WorkloadSelector
	}

	errChan := make(chan error, 15)

	var wg sync.WaitGroup
	wg.Add(15)

	listOpts := meta_v1.ListOptions{LabelSelector: criteria.LabelSelector}

	go func(ctx context.Context, errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.DestinationRules) {
			var err error
			// Check if namespace is cached
			// @TODO better way to check IsResourceCached per kubeCache
			if IsResourceCached(criteria.Namespace, kubernetes.DestinationRules) {
				istioConfigList.DestinationRules, err = kubeCache.GetDestinationRules(criteria.Namespace, criteria.LabelSelector)
			} else {
				drl, e := userClient.Istio().NetworkingV1beta1().DestinationRules(criteria.Namespace).List(ctx, listOpts)
				istioConfigList.DestinationRules = drl.Items
				err = e
			}
			if err != nil {
				errChan <- err
			}
		}
	}(ctx, errChan)

	go func(ctx context.Context, errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.EnvoyFilters) {
			var err error
			if IsResourceCached(criteria.Namespace, kubernetes.EnvoyFilters) {
				istioConfigList.EnvoyFilters, err = kubeCache.GetEnvoyFilters(criteria.Namespace, criteria.LabelSelector)
			} else {
				efl, e := userClient.Istio().NetworkingV1alpha3().EnvoyFilters(criteria.Namespace).List(ctx, listOpts)
				istioConfigList.EnvoyFilters = efl.Items
				err = e
			}
			if err == nil {
				if isWorkloadSelector {
					istioConfigList.EnvoyFilters = kubernetes.FilterEnvoyFiltersBySelector(workloadSelector, istioConfigList.EnvoyFilters)
				}
			} else {
				errChan <- err
			}
		}
	}(ctx, errChan)

	go func(ctx context.Context, errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.Gateways) {
			var err error
			// Check if namespace is cached
			if IsResourceCached(criteria.Namespace, kubernetes.Gateways) {
				istioConfigList.Gateways, err = kubeCache.GetGateways(criteria.Namespace, criteria.LabelSelector)
			} else {
				log.Debugf("Listing Gateways for namespace [%s] with labelSelector [%s]", criteria.Namespace, criteria.LabelSelector)
				gwl, e := userClient.Istio().NetworkingV1beta1().Gateways(criteria.Namespace).List(ctx, listOpts)
				istioConfigList.Gateways = gwl.Items
				err = e
			}
			if err == nil {
				if isWorkloadSelector {
					istioConfigList.Gateways = kubernetes.FilterGatewaysBySelector(workloadSelector, istioConfigList.Gateways)
				}
			} else {
				errChan <- err
			}
		}
	}(ctx, errChan)

	go func(ctx context.Context, errChan chan error) {
		defer wg.Done()
		if userClient.IsGatewayAPI() && criteria.Include(kubernetes.K8sGateways) {
			var err error
			// ignore an error as system could not be configured to support K8s Gateway API
			// Check if namespace is cached
			if IsResourceCached(criteria.Namespace, kubernetes.K8sGateways) {
				istioConfigList.K8sGateways, err = kubeCache.GetK8sGateways(criteria.Namespace, criteria.LabelSelector)
			}
			// TODO gwl.Items, there is conflict itself in Gateway API between returned types referenced or not
			//else {
			//	if gwl, e := userClient.GatewayAPI().GatewayV1beta1().Gateways(criteria.Namespace).List(ctx, listOpts); e == nil {
			//		istioConfigList.K8sGateways = gwl.Items
			//	}
			//}
			if err != nil {
				errChan <- err
			}
		}
	}(ctx, errChan)

	go func(ctx context.Context, errChan chan error) {
		defer wg.Done()
		if userClient.IsGatewayAPI() && criteria.Include(kubernetes.K8sHTTPRoutes) {
			var err error
			// ignore an error as system could not be configured to support K8s Gateway API
			// Check if namespace is cached
			if IsResourceCached(criteria.Namespace, kubernetes.K8sHTTPRoutes) {
				istioConfigList.K8sHTTPRoutes, err = kubeCache.GetK8sHTTPRoutes(criteria.Namespace, criteria.LabelSelector)
			}
			// TODO gwl.Items, there is conflict itself in Gateway API between returned types referenced or not
			//else {
			//	if gwl, e := userClient.GatewayAPI().GatewayV1beta1().HTTPRoutes(criteria.Namespace).List(ctx, listOpts); e == nil {
			//		istioConfigList.K8sHTTPRoutes = gwl.Items
			//	}
			//}
			if err != nil {
				errChan <- err
			}
		}
	}(ctx, errChan)

	go func(ctx context.Context, errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.ServiceEntries) {
			var err error
			// Check if namespace is cached
			if IsResourceCached(criteria.Namespace, kubernetes.ServiceEntries) {
				istioConfigList.ServiceEntries, err = kubeCache.GetServiceEntries(criteria.Namespace, criteria.LabelSelector)
			} else {
				sel, e := userClient.Istio().NetworkingV1beta1().ServiceEntries(criteria.Namespace).List(ctx, listOpts)
				istioConfigList.ServiceEntries = sel.Items
				err = e
			}
			if err != nil {
				errChan <- err
			}
		}
	}(ctx, errChan)

	go func(ctx context.Context, errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.Sidecars) {
			var err error
			if IsResourceCached(criteria.Namespace, kubernetes.Sidecars) {
				istioConfigList.Sidecars, err = kubeCache.GetSidecars(criteria.Namespace, criteria.LabelSelector)
			} else {
				scl, e := userClient.Istio().NetworkingV1beta1().Sidecars(criteria.Namespace).List(ctx, listOpts)
				istioConfigList.Sidecars = scl.Items
				err = e
			}
			if err == nil {
				if isWorkloadSelector {
					istioConfigList.Sidecars = kubernetes.FilterSidecarsBySelector(workloadSelector, istioConfigList.Sidecars)
				}
			} else {
				errChan <- err
			}
		}
	}(ctx, errChan)

	go func(ctx context.Context, errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.VirtualServices) {
			var err error
			// Check if namespace is cached
			if IsResourceCached(criteria.Namespace, kubernetes.VirtualServices) {
				istioConfigList.VirtualServices, err = kubeCache.GetVirtualServices(criteria.Namespace, criteria.LabelSelector)
			} else {
				vsl, e := userClient.Istio().NetworkingV1beta1().VirtualServices(criteria.Namespace).List(ctx, listOpts)
				istioConfigList.VirtualServices = vsl.Items
				err = e
			}
			if err != nil {
				errChan <- err
			}
		}
	}(ctx, errChan)

	go func(ctx context.Context, errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.WorkloadEntries) {
			var err error
			if IsResourceCached(criteria.Namespace, kubernetes.WorkloadEntries) {
				istioConfigList.WorkloadEntries, err = kubeCache.GetWorkloadEntries(criteria.Namespace, criteria.LabelSelector)
			} else {
				wel, e := userClient.Istio().NetworkingV1beta1().WorkloadEntries(criteria.Namespace).List(ctx, listOpts)
				istioConfigList.WorkloadEntries = wel.Items
				err = e
			}
			if err != nil {
				errChan <- err
			}
		}
	}(ctx, errChan)

	go func(ctx context.Context, errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.WorkloadGroups) {
			var err error
			if IsResourceCached(criteria.Namespace, kubernetes.WorkloadGroups) {
				istioConfigList.WorkloadGroups, err = kubeCache.GetWorkloadGroups(criteria.Namespace, criteria.LabelSelector)
			} else {
				wgl, e := userClient.Istio().NetworkingV1beta1().WorkloadGroups(criteria.Namespace).List(ctx, listOpts)
				istioConfigList.WorkloadGroups = wgl.Items
				err = e
			}
			if err != nil {
				errChan <- err
			}
		}
	}(ctx, errChan)

	go func(ctx context.Context, errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.WasmPlugins) {
			var err error
			if IsResourceCached(criteria.Namespace, kubernetes.WasmPlugins) {
				istioConfigList.WasmPlugins, err = kubeCache.GetWasmPlugins(criteria.Namespace, criteria.LabelSelector)
			} else {
				wgl, e := userClient.Istio().ExtensionsV1alpha1().WasmPlugins(criteria.Namespace).List(ctx, listOpts)
				istioConfigList.WasmPlugins = wgl.Items
				err = e
			}
			if err != nil {
				errChan <- err
			}
		}
	}(ctx, errChan)

	go func(ctx context.Context, errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.Telemetries) {
			var err error
			if IsResourceCached(criteria.Namespace, kubernetes.Telemetries) {
				istioConfigList.Telemetries, err = kubeCache.GetTelemetries(criteria.Namespace, criteria.LabelSelector)
			} else {
				wgl, e := userClient.Istio().TelemetryV1alpha1().Telemetries(criteria.Namespace).List(ctx, listOpts)
				istioConfigList.Telemetries = wgl.Items
				err = e
			}
			if err != nil {
				errChan <- err
			}
		}
	}(ctx, errChan)

	go func(ctx context.Context, errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.AuthorizationPolicies) {
			var err error
			if IsResourceCached(criteria.Namespace, kubernetes.AuthorizationPolicies) {
				istioConfigList.AuthorizationPolicies, err = kubeCache.GetAuthorizationPolicies(criteria.Namespace, criteria.LabelSelector)
			} else {
				apl, e := userClient.Istio().SecurityV1beta1().AuthorizationPolicies(criteria.Namespace).List(ctx, listOpts)
				istioConfigList.AuthorizationPolicies = apl.Items
				err = e
			}
			if err == nil {
				if isWorkloadSelector {
					istioConfigList.AuthorizationPolicies = kubernetes.FilterAuthorizationPoliciesBySelector(workloadSelector, istioConfigList.AuthorizationPolicies)
				}
			} else {
				errChan <- err
			}
		}
	}(ctx, errChan)

	go func(ctx context.Context, errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.PeerAuthentications) {
			var err error
			if IsResourceCached(criteria.Namespace, kubernetes.PeerAuthentications) {
				istioConfigList.PeerAuthentications, err = kubeCache.GetPeerAuthentications(criteria.Namespace, criteria.LabelSelector)
			} else {
				pal, e := userClient.Istio().SecurityV1beta1().PeerAuthentications(criteria.Namespace).List(ctx, listOpts)
				istioConfigList.PeerAuthentications = pal.Items
				err = e
			}
			if err == nil {
				if isWorkloadSelector {
					istioConfigList.PeerAuthentications = kubernetes.FilterPeerAuthenticationsBySelector(workloadSelector, istioConfigList.PeerAuthentications)
				}
			} else {
				errChan <- err
			}
		}
	}(ctx, errChan)

	go func(ctx context.Context, errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.RequestAuthentications) {
			var err error
			if IsResourceCached(criteria.Namespace, kubernetes.RequestAuthentications) {
				istioConfigList.RequestAuthentications, err = kubeCache.GetRequestAuthentications(criteria.Namespace, criteria.LabelSelector)
			} else {
				ral, e := userClient.Istio().SecurityV1beta1().RequestAuthentications(criteria.Namespace).List(ctx, listOpts)
				istioConfigList.RequestAuthentications = ral.Items
				err = e
			}
			if err == nil {
				if isWorkloadSelector {
					istioConfigList.RequestAuthentications = kubernetes.FilterRequestAuthenticationsBySelector(workloadSelector, istioConfigList.RequestAuthentications)
				}
			} else {
				errChan <- err
			}
		}
	}(ctx, errChan)

	wg.Wait()

	close(errChan)
	for e := range errChan {
		if e != nil { // Check that default value wasn't returned
			err := e // To update the Kiali metric
			return models.IstioConfigList{}, err
		}
	}

	return istioConfigList, nil
}

// GetIstioConfigDetails returns a specific Istio configuration object.
// It uses following parameters:
// - "namespace": 		namespace where configuration is stored
// - "objectType":		type of the configuration
// - "object":			name of the configuration
func (in *IstioConfigService) GetIstioConfigDetails(ctx context.Context, cluster, namespace, objectType, object string) (models.IstioConfigDetails, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetIstioConfigDetails",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", cluster),
		observability.Attribute("namespace", namespace),
		observability.Attribute("objectType", objectType),
		observability.Attribute("object", object),
	)
	defer end()

	var err error

	istioConfigDetail := models.IstioConfigDetails{}
	istioConfigDetail.Namespace = models.Namespace{Name: namespace}
	istioConfigDetail.ObjectType = objectType

	if _, ok := in.userClients[cluster]; !ok {
		return istioConfigDetail, fmt.Errorf("Cluster [%s] is not found or is not accessible for Kiali", cluster)
	}
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.businessLayer.Namespace.GetNamespaceByCluster(ctx, namespace, cluster); err != nil {
		return istioConfigDetail, err
	}

	var wg sync.WaitGroup
	wg.Add(1)

	go func(ctx context.Context) {
		defer wg.Done()
		canCreate, canUpdate, canDelete := getPermissions(ctx, in.userClients[cluster], cluster, namespace, objectType)
		istioConfigDetail.Permissions = models.ResourcePermissions{
			Create: canCreate,
			Update: canUpdate,
			Delete: canDelete,
		}
	}(ctx)

	getOpts := meta_v1.GetOptions{}

	switch objectType {
	case kubernetes.DestinationRules:
		istioConfigDetail.DestinationRule, err = in.userClients[cluster].Istio().NetworkingV1beta1().DestinationRules(namespace).Get(ctx, object, getOpts)
		if err == nil {
			istioConfigDetail.DestinationRule.Kind = kubernetes.DestinationRuleType
			istioConfigDetail.DestinationRule.APIVersion = kubernetes.ApiNetworkingVersionV1Beta1
		}
	case kubernetes.EnvoyFilters:
		istioConfigDetail.EnvoyFilter, err = in.userClients[cluster].Istio().NetworkingV1alpha3().EnvoyFilters(namespace).Get(ctx, object, getOpts)
		if err == nil {
			istioConfigDetail.EnvoyFilter.Kind = kubernetes.EnvoyFilterType
			istioConfigDetail.EnvoyFilter.APIVersion = kubernetes.ApiNetworkingVersionV1Alpha3
		}
	case kubernetes.Gateways:
		istioConfigDetail.Gateway, err = in.userClients[cluster].Istio().NetworkingV1beta1().Gateways(namespace).Get(ctx, object, getOpts)
		if err == nil {
			istioConfigDetail.Gateway.Kind = kubernetes.GatewayType
			istioConfigDetail.Gateway.APIVersion = kubernetes.ApiNetworkingVersionV1Beta1
		}
	case kubernetes.K8sGateways:
		istioConfigDetail.K8sGateway, err = in.userClients[cluster].GatewayAPI().GatewayV1beta1().Gateways(namespace).Get(ctx, object, getOpts)
		if err == nil {
			istioConfigDetail.K8sGateway.Kind = kubernetes.K8sActualGatewayType
			istioConfigDetail.K8sGateway.APIVersion = kubernetes.K8sApiNetworkingVersionV1Beta1
		}
	case kubernetes.K8sHTTPRoutes:
		istioConfigDetail.K8sHTTPRoute, err = in.userClients[cluster].GatewayAPI().GatewayV1beta1().HTTPRoutes(namespace).Get(ctx, object, getOpts)
		if err == nil {
			istioConfigDetail.K8sHTTPRoute.Kind = kubernetes.K8sActualHTTPRouteType
			istioConfigDetail.K8sHTTPRoute.APIVersion = kubernetes.K8sApiNetworkingVersionV1Beta1
		}
	case kubernetes.ServiceEntries:
		istioConfigDetail.ServiceEntry, err = in.userClients[cluster].Istio().NetworkingV1beta1().ServiceEntries(namespace).Get(ctx, object, getOpts)
		if err == nil {
			istioConfigDetail.ServiceEntry.Kind = kubernetes.ServiceEntryType
			istioConfigDetail.ServiceEntry.APIVersion = kubernetes.ApiNetworkingVersionV1Beta1
		}
	case kubernetes.Sidecars:
		istioConfigDetail.Sidecar, err = in.userClients[cluster].Istio().NetworkingV1beta1().Sidecars(namespace).Get(ctx, object, getOpts)
		if err == nil {
			istioConfigDetail.Sidecar.Kind = kubernetes.SidecarType
			istioConfigDetail.Sidecar.APIVersion = kubernetes.ApiNetworkingVersionV1Beta1
		}
	case kubernetes.VirtualServices:
		istioConfigDetail.VirtualService, err = in.userClients[cluster].Istio().NetworkingV1beta1().VirtualServices(namespace).Get(ctx, object, getOpts)
		if err == nil {
			istioConfigDetail.VirtualService.Kind = kubernetes.VirtualServiceType
			istioConfigDetail.VirtualService.APIVersion = kubernetes.ApiNetworkingVersionV1Beta1
		}
	case kubernetes.WorkloadEntries:
		istioConfigDetail.WorkloadEntry, err = in.userClients[cluster].Istio().NetworkingV1beta1().WorkloadEntries(namespace).Get(ctx, object, getOpts)
		if err == nil {
			istioConfigDetail.WorkloadEntry.Kind = kubernetes.WorkloadEntryType
			istioConfigDetail.WorkloadEntry.APIVersion = kubernetes.ApiNetworkingVersionV1Beta1
		}
	case kubernetes.WorkloadGroups:
		istioConfigDetail.WorkloadGroup, err = in.userClients[cluster].Istio().NetworkingV1beta1().WorkloadGroups(namespace).Get(ctx, object, getOpts)
		if err == nil {
			istioConfigDetail.WorkloadGroup.Kind = kubernetes.WorkloadGroupType
			istioConfigDetail.WorkloadGroup.APIVersion = kubernetes.ApiNetworkingVersionV1Beta1
		}
	case kubernetes.WasmPlugins:
		istioConfigDetail.WasmPlugin, err = in.userClients[cluster].Istio().ExtensionsV1alpha1().WasmPlugins(namespace).Get(ctx, object, getOpts)
		if err == nil {
			istioConfigDetail.WasmPlugin.Kind = kubernetes.WasmPluginType
			istioConfigDetail.WasmPlugin.APIVersion = kubernetes.ApiExtensionV1Alpha1
		}
	case kubernetes.Telemetries:
		istioConfigDetail.Telemetry, err = in.userClients[cluster].Istio().TelemetryV1alpha1().Telemetries(namespace).Get(ctx, object, getOpts)
		if err == nil {
			istioConfigDetail.Telemetry.Kind = kubernetes.TelemetryType
			istioConfigDetail.Telemetry.APIVersion = kubernetes.ApiTelemetryV1Alpha1
		}
	case kubernetes.AuthorizationPolicies:
		istioConfigDetail.AuthorizationPolicy, err = in.userClients[cluster].Istio().SecurityV1beta1().AuthorizationPolicies(namespace).Get(ctx, object, getOpts)
		if err == nil {
			istioConfigDetail.AuthorizationPolicy.Kind = kubernetes.AuthorizationPoliciesType
			istioConfigDetail.AuthorizationPolicy.APIVersion = kubernetes.ApiSecurityVersion
		}
	case kubernetes.PeerAuthentications:
		istioConfigDetail.PeerAuthentication, err = in.userClients[cluster].Istio().SecurityV1beta1().PeerAuthentications(namespace).Get(ctx, object, getOpts)
		if err == nil {
			istioConfigDetail.PeerAuthentication.Kind = kubernetes.PeerAuthenticationsType
			istioConfigDetail.PeerAuthentication.APIVersion = kubernetes.ApiSecurityVersion
		}
	case kubernetes.RequestAuthentications:
		istioConfigDetail.RequestAuthentication, err = in.userClients[cluster].Istio().SecurityV1beta1().RequestAuthentications(namespace).Get(ctx, object, getOpts)
		if err == nil {
			istioConfigDetail.RequestAuthentication.Kind = kubernetes.RequestAuthenticationsType
			istioConfigDetail.RequestAuthentication.APIVersion = kubernetes.ApiSecurityVersion
		}
	default:
		err = fmt.Errorf("object type not found: %v", objectType)
	}

	wg.Wait()

	return istioConfigDetail, err
}

// GetIstioConfigDetailsFromRegistry returns a specific Istio configuration object from Istio Registry.
// The returned object is Read only.
// It uses following parameters:
// - "namespace": 		namespace where configuration is stored
// - "objectType":		type of the configuration
// - "object":			name of the configuration
func (in *IstioConfigService) GetIstioConfigDetailsFromRegistry(ctx context.Context, cluster, namespace, objectType, object string) (models.IstioConfigDetails, error) {
	var err error

	istioConfigDetail := models.IstioConfigDetails{}
	istioConfigDetail.Namespace = models.Namespace{Name: namespace}
	istioConfigDetail.ObjectType = objectType

	istioConfigDetail.Permissions = models.ResourcePermissions{
		Create: false,
		Update: false,
		Delete: false,
	}

	registryCriteria := RegistryCriteria{
		AllNamespaces: true,
	}
	if _, ok := in.businessLayer.RegistryStatuses[cluster]; !ok {
		return istioConfigDetail, fmt.Errorf("Registry Cache for Cluster [%s] is not found or is not accessible for Kiali", cluster)
	}
	registryStatus := in.businessLayer.RegistryStatuses[cluster]
	registryConfiguration, err := registryStatus.GetRegistryConfiguration(registryCriteria)
	if err != nil {
		return istioConfigDetail, err
	}
	if registryConfiguration == nil {
		return istioConfigDetail, errors.New("RegistryConfiguration is nil. This is an unexpected case. Is the Kiali cache disabled ?")
	}

	switch objectType {
	case kubernetes.DestinationRules:
		configs := registryConfiguration.DestinationRules
		for _, cfg := range configs {
			if cfg.Name == object && cfg.Namespace == namespace {
				istioConfigDetail.DestinationRule = cfg
				istioConfigDetail.DestinationRule.Kind = kubernetes.DestinationRuleType
				istioConfigDetail.DestinationRule.APIVersion = kubernetes.ApiNetworkingVersionV1Beta1
				return istioConfigDetail, nil
			}
		}
	case kubernetes.EnvoyFilters:
		configs := registryConfiguration.EnvoyFilters
		for _, cfg := range configs {
			if cfg.Name == object && cfg.Namespace == namespace {
				istioConfigDetail.EnvoyFilter = cfg
				istioConfigDetail.EnvoyFilter.Kind = kubernetes.EnvoyFilterType
				istioConfigDetail.EnvoyFilter.APIVersion = kubernetes.ApiNetworkingVersionV1Alpha3
				return istioConfigDetail, nil
			}
		}
	case kubernetes.Gateways:
		configs := registryConfiguration.Gateways
		for _, cfg := range configs {
			if cfg.Name == object && cfg.Namespace == namespace {
				istioConfigDetail.Gateway = cfg
				istioConfigDetail.Gateway.Kind = kubernetes.GatewayType
				istioConfigDetail.Gateway.APIVersion = kubernetes.ApiNetworkingVersionV1Beta1
				return istioConfigDetail, nil
			}
		}
	case kubernetes.K8sGateways:
		configs := registryConfiguration.K8sGateways
		for _, cfg := range configs {
			if cfg.Name == object && cfg.Namespace == namespace {
				istioConfigDetail.K8sGateway = cfg
				istioConfigDetail.K8sGateway.Kind = kubernetes.K8sGatewayType
				istioConfigDetail.K8sGateway.APIVersion = kubernetes.K8sApiNetworkingVersionV1Beta1
				return istioConfigDetail, nil
			}
		}
	case kubernetes.K8sHTTPRoutes:
		configs := registryConfiguration.K8sHTTPRoutes
		for _, cfg := range configs {
			if cfg.Name == object && cfg.Namespace == namespace {
				istioConfigDetail.K8sHTTPRoute = cfg
				istioConfigDetail.K8sHTTPRoute.Kind = kubernetes.K8sHTTPRouteType
				istioConfigDetail.K8sHTTPRoute.APIVersion = kubernetes.K8sApiNetworkingVersionV1Beta1
				return istioConfigDetail, nil
			}
		}
	case kubernetes.ServiceEntries:
		configs := registryConfiguration.ServiceEntries
		for _, cfg := range configs {
			if cfg.Name == object && cfg.Namespace == namespace {
				istioConfigDetail.ServiceEntry = cfg
				istioConfigDetail.ServiceEntry.Kind = kubernetes.ServiceEntryType
				istioConfigDetail.ServiceEntry.APIVersion = kubernetes.ApiNetworkingVersionV1Beta1
				return istioConfigDetail, nil
			}
		}
	case kubernetes.Sidecars:
		configs := registryConfiguration.Sidecars
		for _, cfg := range configs {
			if cfg.Name == object && cfg.Namespace == namespace {
				istioConfigDetail.Sidecar = cfg
				istioConfigDetail.Sidecar.Kind = kubernetes.SidecarType
				istioConfigDetail.Sidecar.APIVersion = kubernetes.ApiNetworkingVersionV1Beta1
				return istioConfigDetail, nil
			}
		}
	case kubernetes.VirtualServices:
		configs := registryConfiguration.VirtualServices
		for _, cfg := range configs {
			if cfg.Name == object && cfg.Namespace == namespace {
				istioConfigDetail.VirtualService = cfg
				istioConfigDetail.VirtualService.Kind = kubernetes.VirtualServiceType
				istioConfigDetail.VirtualService.APIVersion = kubernetes.ApiNetworkingVersionV1Beta1
				return istioConfigDetail, nil
			}
		}
	case kubernetes.WorkloadEntries:
		configs := registryConfiguration.WorkloadEntries
		for _, cfg := range configs {
			if cfg.Name == object && cfg.Namespace == namespace {
				istioConfigDetail.WorkloadEntry = cfg
				istioConfigDetail.WorkloadEntry.Kind = kubernetes.WorkloadEntryType
				istioConfigDetail.WorkloadEntry.APIVersion = kubernetes.ApiNetworkingVersionV1Beta1
				return istioConfigDetail, nil
			}
		}
	case kubernetes.WorkloadGroups:
		configs := registryConfiguration.WorkloadGroups
		for _, cfg := range configs {
			if cfg.Name == object && cfg.Namespace == namespace {
				istioConfigDetail.WorkloadGroup = cfg
				istioConfigDetail.WorkloadGroup.Kind = kubernetes.WorkloadGroupType
				istioConfigDetail.WorkloadGroup.APIVersion = kubernetes.ApiNetworkingVersionV1Beta1
				return istioConfigDetail, nil
			}
		}
	case kubernetes.WasmPlugins:
		configs := registryConfiguration.WasmPlugins
		for _, cfg := range configs {
			if cfg.Name == object && cfg.Namespace == namespace {
				istioConfigDetail.WasmPlugin = cfg
				istioConfigDetail.WasmPlugin.Kind = kubernetes.WasmPluginType
				istioConfigDetail.WasmPlugin.APIVersion = kubernetes.ApiExtensionV1Alpha1
				return istioConfigDetail, nil
			}
		}
	case kubernetes.Telemetries:
		configs := registryConfiguration.Telemetries
		for _, cfg := range configs {
			if cfg.Name == object && cfg.Namespace == namespace {
				istioConfigDetail.Telemetry = cfg
				istioConfigDetail.Telemetry.Kind = kubernetes.TelemetryType
				istioConfigDetail.Telemetry.APIVersion = kubernetes.ApiTelemetryV1Alpha1
				return istioConfigDetail, nil
			}
		}
	case kubernetes.AuthorizationPolicies:
		configs := registryConfiguration.AuthorizationPolicies
		for _, cfg := range configs {
			if cfg.Name == object && cfg.Namespace == namespace {
				istioConfigDetail.AuthorizationPolicy = cfg
				istioConfigDetail.AuthorizationPolicy.Kind = kubernetes.AuthorizationPoliciesType
				istioConfigDetail.AuthorizationPolicy.APIVersion = kubernetes.ApiSecurityVersion
				return istioConfigDetail, nil
			}
		}
	case kubernetes.PeerAuthentications:
		configs := registryConfiguration.PeerAuthentications
		for _, cfg := range configs {
			if cfg.Name == object && cfg.Namespace == namespace {
				istioConfigDetail.PeerAuthentication = cfg
				istioConfigDetail.PeerAuthentication.Kind = kubernetes.PeerAuthenticationsType
				istioConfigDetail.PeerAuthentication.APIVersion = kubernetes.ApiSecurityVersion
				return istioConfigDetail, nil
			}
		}
	case kubernetes.RequestAuthentications:
		configs := registryConfiguration.RequestAuthentications
		for _, cfg := range configs {
			if cfg.Name == object && cfg.Namespace == namespace {
				istioConfigDetail.RequestAuthentication = cfg
				istioConfigDetail.RequestAuthentication.Kind = kubernetes.RequestAuthenticationsType
				istioConfigDetail.RequestAuthentication.APIVersion = kubernetes.ApiSecurityVersion
				return istioConfigDetail, nil
			}
		}
	default:
		err = fmt.Errorf("object type not found: %v", objectType)
	}

	if err == nil {
		err = errors.New("Object is not found in registry")
	}

	return istioConfigDetail, err
}

// GetIstioAPI provides the Kubernetes API that manages this Istio resource type
// or empty string if it's not managed
func GetIstioAPI(resourceType string) bool {
	return kubernetes.ResourceTypesToAPI[resourceType] != ""
}

// DeleteIstioConfigDetail deletes the given Istio resource
func (in *IstioConfigService) DeleteIstioConfigDetail(cluster, namespace, resourceType, name string) error {
	var err error
	delOpts := meta_v1.DeleteOptions{}
	ctx := context.TODO()
	switch resourceType {
	case kubernetes.DestinationRules:
		err = in.userClients[cluster].Istio().NetworkingV1beta1().DestinationRules(namespace).Delete(ctx, name, delOpts)
	case kubernetes.EnvoyFilters:
		err = in.userClients[cluster].Istio().NetworkingV1alpha3().EnvoyFilters(namespace).Delete(ctx, name, delOpts)
	case kubernetes.Gateways:
		err = in.userClients[cluster].Istio().NetworkingV1beta1().Gateways(namespace).Delete(ctx, name, delOpts)
	case kubernetes.K8sGateways:
		err = in.userClients[cluster].GatewayAPI().GatewayV1beta1().Gateways(namespace).Delete(ctx, name, delOpts)
	case kubernetes.K8sHTTPRoutes:
		err = in.userClients[cluster].GatewayAPI().GatewayV1beta1().HTTPRoutes(namespace).Delete(ctx, name, delOpts)
	case kubernetes.ServiceEntries:
		err = in.userClients[cluster].Istio().NetworkingV1beta1().ServiceEntries(namespace).Delete(ctx, name, delOpts)
	case kubernetes.Sidecars:
		err = in.userClients[cluster].Istio().NetworkingV1beta1().Sidecars(namespace).Delete(ctx, name, delOpts)
	case kubernetes.VirtualServices:
		err = in.userClients[cluster].Istio().NetworkingV1beta1().VirtualServices(namespace).Delete(ctx, name, delOpts)
	case kubernetes.WorkloadEntries:
		err = in.userClients[cluster].Istio().NetworkingV1beta1().WorkloadEntries(namespace).Delete(ctx, name, delOpts)
	case kubernetes.WorkloadGroups:
		err = in.userClients[cluster].Istio().NetworkingV1beta1().WorkloadGroups(namespace).Delete(ctx, name, delOpts)
	case kubernetes.AuthorizationPolicies:
		err = in.userClients[cluster].Istio().SecurityV1beta1().AuthorizationPolicies(namespace).Delete(ctx, name, delOpts)
	case kubernetes.PeerAuthentications:
		err = in.userClients[cluster].Istio().SecurityV1beta1().PeerAuthentications(namespace).Delete(ctx, name, delOpts)
	case kubernetes.RequestAuthentications:
		err = in.userClients[cluster].Istio().SecurityV1beta1().RequestAuthentications(namespace).Delete(ctx, name, delOpts)
	case kubernetes.WasmPlugins:
		err = in.userClients[cluster].Istio().ExtensionsV1alpha1().WasmPlugins(namespace).Delete(ctx, name, delOpts)
	case kubernetes.Telemetries:
		err = in.userClients[cluster].Istio().TelemetryV1alpha1().Telemetries(namespace).Delete(ctx, name, delOpts)
	default:
		err = fmt.Errorf("object type not found: %v", resourceType)
	}
	if err != nil {
		return err
	}

	// Cache is stopped after a Create/Update/Delete operation to force a refresh
	kialiCache.Refresh(namespace)

	return nil
}

func (in *IstioConfigService) UpdateIstioConfigDetail(cluster, namespace, resourceType, name, jsonPatch string) (models.IstioConfigDetails, error) {
	istioConfigDetail := models.IstioConfigDetails{}
	istioConfigDetail.Namespace = models.Namespace{Name: namespace}
	istioConfigDetail.ObjectType = resourceType

	patchOpts := meta_v1.PatchOptions{}
	ctx := context.TODO()
	patchType := api_types.MergePatchType
	bytePatch := []byte(jsonPatch)

	var err error
	switch resourceType {
	case kubernetes.DestinationRules:
		istioConfigDetail.DestinationRule = &networking_v1beta1.DestinationRule{}
		istioConfigDetail.DestinationRule, err = in.userClients[cluster].Istio().NetworkingV1beta1().DestinationRules(namespace).Patch(ctx, name, patchType, bytePatch, patchOpts)
	case kubernetes.EnvoyFilters:
		istioConfigDetail.EnvoyFilter = &networking_v1alpha3.EnvoyFilter{}
		istioConfigDetail.EnvoyFilter, err = in.userClients[cluster].Istio().NetworkingV1alpha3().EnvoyFilters(namespace).Patch(ctx, name, patchType, bytePatch, patchOpts)
	case kubernetes.Gateways:
		istioConfigDetail.Gateway = &networking_v1beta1.Gateway{}
		istioConfigDetail.Gateway, err = in.userClients[cluster].Istio().NetworkingV1beta1().Gateways(namespace).Patch(ctx, name, patchType, bytePatch, patchOpts)
	case kubernetes.K8sGateways:
		istioConfigDetail.K8sGateway = &k8s_networking_v1beta1.Gateway{}
		istioConfigDetail.K8sGateway, err = in.userClients[cluster].GatewayAPI().GatewayV1beta1().Gateways(namespace).Patch(ctx, name, patchType, bytePatch, patchOpts)
	case kubernetes.K8sHTTPRoutes:
		istioConfigDetail.K8sHTTPRoute = &k8s_networking_v1beta1.HTTPRoute{}
		istioConfigDetail.K8sHTTPRoute, err = in.userClients[cluster].GatewayAPI().GatewayV1beta1().HTTPRoutes(namespace).Patch(ctx, name, patchType, bytePatch, patchOpts)
	case kubernetes.ServiceEntries:
		istioConfigDetail.ServiceEntry = &networking_v1beta1.ServiceEntry{}
		istioConfigDetail.ServiceEntry, err = in.userClients[cluster].Istio().NetworkingV1beta1().ServiceEntries(namespace).Patch(ctx, name, patchType, bytePatch, patchOpts)
	case kubernetes.Sidecars:
		istioConfigDetail.Sidecar = &networking_v1beta1.Sidecar{}
		istioConfigDetail.Sidecar, err = in.userClients[cluster].Istio().NetworkingV1beta1().Sidecars(namespace).Patch(ctx, name, patchType, bytePatch, patchOpts)
	case kubernetes.VirtualServices:
		istioConfigDetail.VirtualService = &networking_v1beta1.VirtualService{}
		istioConfigDetail.VirtualService, err = in.userClients[cluster].Istio().NetworkingV1beta1().VirtualServices(namespace).Patch(ctx, name, patchType, bytePatch, patchOpts)
	case kubernetes.WorkloadEntries:
		istioConfigDetail.WorkloadEntry = &networking_v1beta1.WorkloadEntry{}
		istioConfigDetail.WorkloadEntry, err = in.userClients[cluster].Istio().NetworkingV1beta1().WorkloadEntries(namespace).Patch(ctx, name, patchType, bytePatch, patchOpts)
	case kubernetes.WorkloadGroups:
		istioConfigDetail.WorkloadGroup = &networking_v1beta1.WorkloadGroup{}
		istioConfigDetail.WorkloadGroup, err = in.userClients[cluster].Istio().NetworkingV1beta1().WorkloadGroups(namespace).Patch(ctx, name, patchType, bytePatch, patchOpts)
	case kubernetes.AuthorizationPolicies:
		istioConfigDetail.AuthorizationPolicy = &security_v1beta1.AuthorizationPolicy{}
		istioConfigDetail.AuthorizationPolicy, err = in.userClients[cluster].Istio().SecurityV1beta1().AuthorizationPolicies(namespace).Patch(ctx, name, patchType, bytePatch, patchOpts)
	case kubernetes.PeerAuthentications:
		istioConfigDetail.PeerAuthentication = &security_v1beta1.PeerAuthentication{}
		istioConfigDetail.PeerAuthentication, err = in.userClients[cluster].Istio().SecurityV1beta1().PeerAuthentications(namespace).Patch(ctx, name, patchType, bytePatch, patchOpts)
	case kubernetes.RequestAuthentications:
		istioConfigDetail.RequestAuthentication = &security_v1beta1.RequestAuthentication{}
		istioConfigDetail.RequestAuthentication, err = in.userClients[cluster].Istio().SecurityV1beta1().RequestAuthentications(namespace).Patch(ctx, name, patchType, bytePatch, patchOpts)
	case kubernetes.WasmPlugins:
		istioConfigDetail.WasmPlugin = &extentions_v1alpha1.WasmPlugin{}
		istioConfigDetail.WasmPlugin, err = in.userClients[cluster].Istio().ExtensionsV1alpha1().WasmPlugins(namespace).Patch(ctx, name, patchType, bytePatch, patchOpts)
	case kubernetes.Telemetries:
		istioConfigDetail.Telemetry = &v1alpha1.Telemetry{}
		istioConfigDetail.Telemetry, err = in.userClients[cluster].Istio().TelemetryV1alpha1().Telemetries(namespace).Patch(ctx, name, patchType, bytePatch, patchOpts)
	default:
		err = fmt.Errorf("object type not found: %v", resourceType)
	}

	// Cache is stopped after a Create/Update/Delete operation to force a refresh
	if kialiCache != nil && err == nil {
		kialiCache.Refresh(namespace)
	}
	return istioConfigDetail, err
}

func (in *IstioConfigService) CreateIstioConfigDetail(cluster, namespace, resourceType string, body []byte) (models.IstioConfigDetails, error) {
	istioConfigDetail := models.IstioConfigDetails{}
	istioConfigDetail.Namespace = models.Namespace{Name: namespace}
	istioConfigDetail.ObjectType = resourceType

	createOpts := meta_v1.CreateOptions{}
	ctx := context.TODO()

	var err error
	switch resourceType {
	case kubernetes.DestinationRules:
		istioConfigDetail.DestinationRule = &networking_v1beta1.DestinationRule{}
		err = json.Unmarshal(body, istioConfigDetail.DestinationRule)
		if err != nil {
			return istioConfigDetail, api_errors.NewBadRequest(err.Error())
		}
		istioConfigDetail.DestinationRule, err = in.userClients[cluster].Istio().NetworkingV1beta1().DestinationRules(namespace).Create(ctx, istioConfigDetail.DestinationRule, createOpts)
	case kubernetes.EnvoyFilters:
		istioConfigDetail.EnvoyFilter = &networking_v1alpha3.EnvoyFilter{}
		err = json.Unmarshal(body, istioConfigDetail.EnvoyFilter)
		if err != nil {
			return istioConfigDetail, api_errors.NewBadRequest(err.Error())
		}
		istioConfigDetail.EnvoyFilter, err = in.userClients[cluster].Istio().NetworkingV1alpha3().EnvoyFilters(namespace).Create(ctx, istioConfigDetail.EnvoyFilter, createOpts)
	case kubernetes.Gateways:
		istioConfigDetail.Gateway = &networking_v1beta1.Gateway{}
		err = json.Unmarshal(body, istioConfigDetail.Gateway)
		if err != nil {
			return istioConfigDetail, api_errors.NewBadRequest(err.Error())
		}
		istioConfigDetail.Gateway, err = in.userClients[cluster].Istio().NetworkingV1beta1().Gateways(namespace).Create(ctx, istioConfigDetail.Gateway, createOpts)
	case kubernetes.K8sGateways:
		istioConfigDetail.K8sGateway = &k8s_networking_v1beta1.Gateway{}
		err = json.Unmarshal(body, istioConfigDetail.K8sGateway)
		if err != nil {
			return istioConfigDetail, api_errors.NewBadRequest(err.Error())
		}
		istioConfigDetail.K8sGateway, err = in.userClients[cluster].GatewayAPI().GatewayV1beta1().Gateways(namespace).Create(ctx, istioConfigDetail.K8sGateway, createOpts)
	case kubernetes.K8sHTTPRoutes:
		istioConfigDetail.K8sHTTPRoute = &k8s_networking_v1beta1.HTTPRoute{}
		err = json.Unmarshal(body, istioConfigDetail.K8sHTTPRoute)
		if err != nil {
			return istioConfigDetail, api_errors.NewBadRequest(err.Error())
		}
		istioConfigDetail.K8sHTTPRoute, err = in.userClients[cluster].GatewayAPI().GatewayV1beta1().HTTPRoutes(namespace).Create(ctx, istioConfigDetail.K8sHTTPRoute, createOpts)
	case kubernetes.ServiceEntries:
		istioConfigDetail.ServiceEntry = &networking_v1beta1.ServiceEntry{}
		err = json.Unmarshal(body, istioConfigDetail.ServiceEntry)
		if err != nil {
			return istioConfigDetail, api_errors.NewBadRequest(err.Error())
		}
		istioConfigDetail.ServiceEntry, err = in.userClients[cluster].Istio().NetworkingV1beta1().ServiceEntries(namespace).Create(ctx, istioConfigDetail.ServiceEntry, createOpts)
	case kubernetes.Sidecars:
		istioConfigDetail.Sidecar = &networking_v1beta1.Sidecar{}
		err = json.Unmarshal(body, istioConfigDetail.Sidecar)
		if err != nil {
			return istioConfigDetail, api_errors.NewBadRequest(err.Error())
		}
		istioConfigDetail.Sidecar, err = in.userClients[cluster].Istio().NetworkingV1beta1().Sidecars(namespace).Create(ctx, istioConfigDetail.Sidecar, createOpts)
	case kubernetes.VirtualServices:
		istioConfigDetail.VirtualService = &networking_v1beta1.VirtualService{}
		err = json.Unmarshal(body, istioConfigDetail.VirtualService)
		if err != nil {
			return istioConfigDetail, api_errors.NewBadRequest(err.Error())
		}
		istioConfigDetail.VirtualService, err = in.userClients[cluster].Istio().NetworkingV1beta1().VirtualServices(namespace).Create(ctx, istioConfigDetail.VirtualService, createOpts)
	case kubernetes.WorkloadEntries:
		istioConfigDetail.WorkloadEntry = &networking_v1beta1.WorkloadEntry{}
		err = json.Unmarshal(body, istioConfigDetail.WorkloadEntry)
		if err != nil {
			return istioConfigDetail, api_errors.NewBadRequest(err.Error())
		}
		istioConfigDetail.WorkloadEntry, err = in.userClients[cluster].Istio().NetworkingV1beta1().WorkloadEntries(namespace).Create(ctx, istioConfigDetail.WorkloadEntry, createOpts)
	case kubernetes.WorkloadGroups:
		istioConfigDetail.WorkloadGroup = &networking_v1beta1.WorkloadGroup{}
		err = json.Unmarshal(body, istioConfigDetail.WorkloadGroup)
		if err != nil {
			return istioConfigDetail, api_errors.NewBadRequest(err.Error())
		}
		istioConfigDetail.WorkloadGroup, err = in.userClients[cluster].Istio().NetworkingV1beta1().WorkloadGroups(namespace).Create(ctx, istioConfigDetail.WorkloadGroup, createOpts)
	case kubernetes.WasmPlugins:
		istioConfigDetail.WasmPlugin = &extentions_v1alpha1.WasmPlugin{}
		err = json.Unmarshal(body, istioConfigDetail.WasmPlugin)
		if err != nil {
			return istioConfigDetail, api_errors.NewBadRequest(err.Error())
		}
		istioConfigDetail.WasmPlugin, err = in.userClients[cluster].Istio().ExtensionsV1alpha1().WasmPlugins(namespace).Create(ctx, istioConfigDetail.WasmPlugin, createOpts)
	case kubernetes.Telemetries:
		istioConfigDetail.Telemetry = &v1alpha1.Telemetry{}
		err = json.Unmarshal(body, istioConfigDetail.Telemetry)
		if err != nil {
			return istioConfigDetail, api_errors.NewBadRequest(err.Error())
		}
		istioConfigDetail.Telemetry, err = in.userClients[cluster].Istio().TelemetryV1alpha1().Telemetries(namespace).Create(ctx, istioConfigDetail.Telemetry, createOpts)
	case kubernetes.AuthorizationPolicies:
		istioConfigDetail.AuthorizationPolicy = &security_v1beta1.AuthorizationPolicy{}
		err = json.Unmarshal(body, istioConfigDetail.AuthorizationPolicy)
		if err != nil {
			return istioConfigDetail, api_errors.NewBadRequest(err.Error())
		}
		istioConfigDetail.AuthorizationPolicy, err = in.userClients[cluster].Istio().SecurityV1beta1().AuthorizationPolicies(namespace).Create(ctx, istioConfigDetail.AuthorizationPolicy, createOpts)
	case kubernetes.PeerAuthentications:
		istioConfigDetail.PeerAuthentication = &security_v1beta1.PeerAuthentication{}
		err = json.Unmarshal(body, istioConfigDetail.PeerAuthentication)
		if err != nil {
			return istioConfigDetail, api_errors.NewBadRequest(err.Error())
		}
		istioConfigDetail.PeerAuthentication, err = in.userClients[cluster].Istio().SecurityV1beta1().PeerAuthentications(namespace).Create(ctx, istioConfigDetail.PeerAuthentication, createOpts)
	case kubernetes.RequestAuthentications:
		istioConfigDetail.RequestAuthentication = &security_v1beta1.RequestAuthentication{}
		err = json.Unmarshal(body, istioConfigDetail.RequestAuthentication)
		if err != nil {
			return istioConfigDetail, api_errors.NewBadRequest(err.Error())
		}
		istioConfigDetail.RequestAuthentication, err = in.userClients[cluster].Istio().SecurityV1beta1().RequestAuthentications(namespace).Create(ctx, istioConfigDetail.RequestAuthentication, createOpts)
	default:
		err = fmt.Errorf("object type not found: %v", resourceType)
	}
	// Cache is stopped after a Create/Update/Delete operation to force a refresh
	if kialiCache != nil && err == nil {
		kialiCache.Refresh(namespace)
	}
	return istioConfigDetail, err
}

func (in *IstioConfigService) IsGatewayAPI(cluster string) bool {
	return in.userClients[cluster].IsGatewayAPI()
}

// Check if istio Ambient profile was enabled
// ATM it is defined in the istio-cni-config configmap
func (in *IstioConfigService) IsAmbientEnabled() bool {

	var cniNetwork map[string]any
	istioConfigMap, err := in.kialiCache.GetConfigMap(config.Get().IstioNamespace, "istio-cni-config")
	if err != nil {
		log.Errorf("Error getting istio-cni-config configmap: %s ", err.Error())
	} else {
		err = yaml.Unmarshal([]byte(istioConfigMap.Data["cni_network_config"]), &cniNetwork)
		if err != nil {
			log.Errorf("Error reading istio-cni-config configmap: %s ", err.Error())
			return false
		}
		ambientEnabled, ok := cniNetwork["ambient_enabled"].(bool)

		if ok && ambientEnabled {
			return true
		}
	}
	return false
}

func (in *IstioConfigService) GetIstioConfigPermissions(ctx context.Context, namespaces []string, cluster string) models.IstioConfigPermissions {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetIstioConfigPermissions",
		observability.Attribute("package", "business"),
		observability.Attribute("namespaces", namespaces),
	)
	defer end()

	istioConfigPermissions := make(models.IstioConfigPermissions, len(namespaces))

	k8s, ok := in.userClients[cluster]
	if !ok {
		log.Errorf("Cluster %s doesn't exist ", cluster)
		return nil
	}

	if len(namespaces) > 0 {
		networkingPermissions := make(models.IstioConfigPermissions, len(namespaces))
		k8sNetworkingPermissions := make(models.IstioConfigPermissions, len(namespaces))
		securityPermissions := make(models.IstioConfigPermissions, len(namespaces))

		wg := sync.WaitGroup{}
		// We will query 2 times per namespace (networking.istio.io and security.istio.io)
		wg.Add(len(namespaces) * 3)
		for _, ns := range namespaces {
			networkingRP := make(models.ResourcesPermissions, len(newNetworkingConfigTypes))
			k8sNetworkingRP := make(models.ResourcesPermissions, len(newK8sNetworkingConfigTypes))
			securityRP := make(models.ResourcesPermissions, len(newSecurityConfigTypes))
			networkingPermissions[ns] = &networkingRP
			k8sNetworkingPermissions[ns] = &k8sNetworkingRP
			securityPermissions[ns] = &securityRP
			/*
				We can optimize this logic.
				Instead of query all editable objects of networking.istio.io and security.istio.io we can query
				only one per API, that will save several queries to the backend.

				Synced with:
				https://github.com/kiali/kiali-operator/blob/master/roles/default/kiali-deploy/templates/kubernetes/role.yaml#L62
			*/
			go func(ctx context.Context, namespace string, wg *sync.WaitGroup, networkingPermissions *models.ResourcesPermissions) {
				defer wg.Done()
				canCreate, canUpdate, canDelete := getPermissionsApi(ctx, k8s, cluster, namespace, kubernetes.NetworkingGroupVersionV1Beta1.Group, allResources)
				for _, rs := range newNetworkingConfigTypes {
					networkingRP[rs] = &models.ResourcePermissions{
						Create: canCreate,
						Update: canUpdate,
						Delete: canDelete,
					}
				}
			}(ctx, ns, &wg, &networkingRP)

			go func(ctx context.Context, namespace string, wg *sync.WaitGroup, k8sNetworkingPermissions *models.ResourcesPermissions) {
				defer wg.Done()
				canCreate, canUpdate, canDelete := getPermissionsApi(ctx, k8s, cluster, namespace, kubernetes.K8sNetworkingGroupVersionV1Beta1.Group, allResources)
				for _, rs := range newK8sNetworkingConfigTypes {
					k8sNetworkingRP[rs] = &models.ResourcePermissions{
						Create: canCreate && in.userClients[cluster].IsGatewayAPI(),
						Update: canUpdate && in.userClients[cluster].IsGatewayAPI(),
						Delete: canDelete && in.userClients[cluster].IsGatewayAPI(),
					}
				}
			}(ctx, ns, &wg, &k8sNetworkingRP)

			go func(ctx context.Context, namespace string, wg *sync.WaitGroup, securityPermissions *models.ResourcesPermissions) {
				defer wg.Done()
				canCreate, canUpdate, canDelete := getPermissionsApi(ctx, k8s, cluster, namespace, kubernetes.SecurityGroupVersion.Group, allResources)
				for _, rs := range newSecurityConfigTypes {
					securityRP[rs] = &models.ResourcePermissions{
						Create: canCreate,
						Update: canUpdate,
						Delete: canDelete,
					}
				}
			}(ctx, ns, &wg, &securityRP)
		}
		wg.Wait()

		// Join networking and security permissions into a single result
		for _, ns := range namespaces {
			allRP := make(models.ResourcesPermissions, len(newNetworkingConfigTypes)+len(newSecurityConfigTypes)+len(newK8sNetworkingConfigTypes))
			istioConfigPermissions[ns] = &allRP
			for resource, permissions := range *networkingPermissions[ns] {
				(*istioConfigPermissions[ns])[resource] = permissions
			}
			for resource, permissions := range *k8sNetworkingPermissions[ns] {
				(*istioConfigPermissions[ns])[resource] = permissions
			}
			for resource, permissions := range *securityPermissions[ns] {
				(*istioConfigPermissions[ns])[resource] = permissions
			}
		}
	}
	return istioConfigPermissions
}

func getPermissions(ctx context.Context, k8s kubernetes.ClientInterface, cluster string, namespace, objectType string) (bool, bool, bool) {
	var canCreate, canPatch, canDelete bool

	if api, ok := kubernetes.ResourceTypesToAPI[objectType]; ok {
		resourceType := objectType
		return getPermissionsApi(ctx, k8s, cluster, namespace, api, resourceType)
	}
	return canCreate, canPatch, canDelete
}

func getPermissionsApi(ctx context.Context, k8s kubernetes.ClientInterface, cluster string, namespace, api, resourceType string) (bool, bool, bool) {
	var canCreate, canPatch, canDelete bool

	// In view only mode, there is not need to check RBAC permissions, return false early
	if config.Get().Deployment.ViewOnlyMode {
		log.Debug("View only mode configured, skipping RBAC checks")
		return canCreate, canPatch, canDelete
	}
	// Disable writes for remote clusters
	if cluster != config.Get().KubernetesConfig.ClusterName {
		log.Debug("Writes disabled for remote clusters")
		return canCreate, canPatch, canDelete
	}

	/*
		Kiali only uses create,patch,delete as WRITE permissions

		"update" creates an extra call to the API that we know that it will always fail, introducing extra latency

		Synced with:
		https://github.com/kiali/kiali-operator/blob/master/roles/default/kiali-deploy/templates/kubernetes/role.yaml#L62
	*/
	ssars, permErr := k8s.GetSelfSubjectAccessReview(ctx, namespace, api, resourceType, []string{"create", "patch", "delete"})
	if permErr == nil {
		for _, ssar := range ssars {
			if ssar.Spec.ResourceAttributes != nil {
				switch ssar.Spec.ResourceAttributes.Verb {
				case "create":
					canCreate = ssar.Status.Allowed
				case "patch":
					canPatch = ssar.Status.Allowed
				case "delete":
					canDelete = ssar.Status.Allowed
				}
			}
		}
	} else {
		log.Errorf("Error getting permissions [namespace: %s, api: %s, resourceType: %s]: %v", namespace, api, "*", permErr)
	}
	return canCreate, canPatch, canDelete
}

func checkType(types []string, name string) bool {
	for _, typeName := range types {
		if typeName == name {
			return true
		}
	}
	return false
}

func ParseIstioConfigCriteria(namespace, objects, labelSelector, workloadSelector string, allNamespaces bool) IstioConfigCriteria {
	defaultInclude := objects == ""
	criteria := IstioConfigCriteria{}
	criteria.IncludeGateways = defaultInclude
	criteria.IncludeK8sGateways = defaultInclude
	criteria.IncludeK8sHTTPRoutes = defaultInclude
	criteria.IncludeVirtualServices = defaultInclude
	criteria.IncludeDestinationRules = defaultInclude
	criteria.IncludeServiceEntries = defaultInclude
	criteria.IncludeSidecars = defaultInclude
	criteria.IncludeAuthorizationPolicies = defaultInclude
	criteria.IncludePeerAuthentications = defaultInclude
	criteria.IncludeWorkloadEntries = defaultInclude
	criteria.IncludeWorkloadGroups = defaultInclude
	criteria.IncludeRequestAuthentications = defaultInclude
	criteria.IncludeEnvoyFilters = defaultInclude
	criteria.IncludeWasmPlugins = defaultInclude
	criteria.IncludeTelemetry = defaultInclude
	criteria.LabelSelector = labelSelector
	criteria.WorkloadSelector = workloadSelector

	if allNamespaces {
		criteria.AllNamespaces = true
	} else {
		criteria.Namespace = namespace
	}

	if defaultInclude {
		return criteria
	}

	types := strings.Split(objects, ",")
	if checkType(types, kubernetes.Gateways) {
		criteria.IncludeGateways = true
	}
	if checkType(types, kubernetes.K8sGateways) {
		criteria.IncludeK8sGateways = true
	}
	if checkType(types, kubernetes.K8sHTTPRoutes) {
		criteria.IncludeK8sHTTPRoutes = true
	}
	if checkType(types, kubernetes.VirtualServices) {
		criteria.IncludeVirtualServices = true
	}
	if checkType(types, kubernetes.DestinationRules) {
		criteria.IncludeDestinationRules = true
	}
	if checkType(types, kubernetes.ServiceEntries) {
		criteria.IncludeServiceEntries = true
	}
	if checkType(types, kubernetes.Sidecars) {
		criteria.IncludeSidecars = true
	}
	if checkType(types, kubernetes.AuthorizationPolicies) {
		criteria.IncludeAuthorizationPolicies = true
	}
	if checkType(types, kubernetes.PeerAuthentications) {
		criteria.IncludePeerAuthentications = true
	}
	if checkType(types, kubernetes.WorkloadEntries) {
		criteria.IncludeWorkloadEntries = true
	}
	if checkType(types, kubernetes.WorkloadGroups) {
		criteria.IncludeWorkloadGroups = true
	}
	if checkType(types, kubernetes.WasmPlugins) {
		criteria.IncludeWasmPlugins = true
	}
	if checkType(types, kubernetes.Telemetries) {
		criteria.IncludeTelemetry = true
	}
	if checkType(types, kubernetes.RequestAuthentications) {
		criteria.IncludeRequestAuthentications = true
	}
	if checkType(types, kubernetes.EnvoyFilters) {
		criteria.IncludeEnvoyFilters = true
	}
	return criteria
}
