package business

import (
	"context"
	"fmt"
	"maps"
	"slices"
	"strconv"
	"strings"

	istiov1alpha1 "istio.io/api/mesh/v1alpha1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/business/checkers"
	"github.com/kiali/kiali/business/references"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/util/sliceutil"
)

func NewValidationsService(
	conf *config.Config,
	istioConfig *IstioConfigService,
	kialiCache cache.KialiCache,
	meshService *MeshService,
	namespaceService *NamespaceService,
	service *SvcService,
	userClients map[string]kubernetes.UserClientInterface,
	workloadService *WorkloadService,
) IstioValidationsService {
	return IstioValidationsService{
		conf:        conf,
		istioConfig: istioConfig,
		kialiCache:  kialiCache,
		mesh:        meshService,
		namespace:   namespaceService,
		service:     service,
		userClients: userClients,
		workload:    workloadService,
	}
}

type IstioValidationsService struct {
	conf        *config.Config
	istioConfig *IstioConfigService
	kialiCache  cache.KialiCache
	mesh        *MeshService
	namespace   *NamespaceService
	service     *SvcService
	userClients map[string]kubernetes.UserClientInterface
	workload    *WorkloadService
}

type ReferenceChecker interface {
	References() models.IstioReferencesMap
}

func (in *IstioValidationsService) GetValidations(ctx context.Context, cluster string) (models.IstioValidations, error) {
	validations := in.kialiCache.Validations().Items()
	return models.IstioValidations(validations).FilterByCluster(cluster), nil
}

func (in *IstioValidationsService) GetValidationsForNamespace(ctx context.Context, cluster, namespace string) (models.IstioValidations, error) {
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		return nil, err
	}

	namespaceValidations := models.IstioValidations{}
	for validationKey, validation := range in.kialiCache.Validations().Items() {
		if validationKey.Namespace == namespace && validationKey.Cluster == cluster {
			namespaceValidations[validationKey] = validation
		}
	}
	return namespaceValidations, nil
}

func (in *IstioValidationsService) GetValidationsForService(ctx context.Context, cluster, namespace, service string) (models.IstioValidations, error) {
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		return nil, err
	}

	// Ensure the service exists
	_, err := in.service.GetService(ctx, cluster, namespace, service)
	if err != nil {
		return nil, fmt.Errorf("service [namespace: %s] [name: %s] doesn't exist for Validations", namespace, service)
	}

	validations := in.kialiCache.Validations().Items()
	return models.IstioValidations(validations).FilterByCluster(cluster).FilterBySingleType(schema.GroupVersionKind{Group: "", Version: "", Kind: "service"}, service), nil
}

func (in *IstioValidationsService) GetValidationsForWorkload(ctx context.Context, cluster, namespace, workload string) (models.IstioValidations, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace param should be set for Validations in cluster [%s]", cluster)
	}
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		return nil, err
	}

	validations := in.kialiCache.Validations().Items()
	return models.IstioValidations(validations).FilterByCluster(cluster).FilterBySingleType(schema.GroupVersionKind{Group: "", Version: "", Kind: "workload"}, workload), nil
}

type validationNamespaceInfo struct {
	istioConfig *models.IstioConfigList //
	mtlsDetails *kubernetes.MTLSDetails // mtls info for the namespace
	namespace   *models.Namespace       // the [cluster] namespace being validated
	rbacDetails *kubernetes.RBACDetails //
}

type validationClusterInfo struct {
	cluster          string                      // the cluster being validated
	identityDomain   string                      // resolved Istio identity domain for this cluster's control plane
	istioConfig      *models.IstioConfigList     // config for the cluster (all namespaces)
	kubeServiceHosts kubernetes.KubeServiceHosts // pre-built host lookup from K8s services
	rootNamespaces   map[string]string           // namespace => rootNamespace, pre-computed from ControlPlaneForNamespace
	services         []core_v1.Service           // K8s services for the cluster (all namespaces)
}

// changeMap key values are determined by the validation logic, and typically identifies a config object,
// or set of confg objects. The value is typically resourceVersion, or some equivalent.
type ValidationChangeMap map[string]string

func (in ValidationChangeMap) update(key, value string, report bool) bool {
	prev, exists := in[key]

	if !exists {
		if report {
			log.Tracef("validations: new config detected: %s", key)
		}
		in[key] = value
		return true
	}

	if prev != value {
		if report {
			log.Tracef("validations: config change detected: %s", key)
		}
		in[key] = value
		return true
	}

	return false
}

// validationInfo holds information gathered during a single validation reconciliation. It is used to hold information that
// may otherwise need to be recalculated.
type validationInfo struct {
	// cross-cluster information
	clusters []string                               // all clusters being validated
	conf     *config.Config                         // kiali config
	mesh     *models.Mesh                           // control plane info
	nsMap    map[string][]models.Namespace          // cluster => namespaces
	saMap    map[string][]string                    // cluster => serviceAccounts
	wlMap    map[string]map[string]models.Workloads // cluster => namespace => Workloads, all workloads

	// clusterInfo is reset for each cluster being validated
	clusterInfo *validationClusterInfo

	// nsInfo is reset for each namespace being validated (for the cluster being validated)
	nsInfo *validationNamespaceInfo

	// changeMap is used to store config ResourceVersion, or an equivalent. When supplied to
	// NewValidationInfo() it sets changeDetection enabled.  It is expected to persist through
	// multiple validation runs, and it is used to check for changes and eliminate checker runs
	// when nothing significant has changed. If not supplied then no change detection is performed.
	changeMap ValidationChangeMap

	// hasBaseChange indicates whether a change is detected in the base data, likely meaning that
	// we need a full validation pass, on each cluster
	hasBaseChange bool

	// reportChange is an internal flag for debugging, that logs keys that have a value change
	reportChange bool
}

// NewValidationInfo returns an initialized validationInfo structure. This is not a "free" call, the initial structure is
// populated with cross-cluster information to be used during the validation. This structure should then be used throughout
// a validation pass to hold "computed" information, and avoid performing the same work multiple times, when evaluating
// different clusters, or different namespaces for a cluster. Initially unused structures/maps will be set to nil, and
// arrays will be initialized to empty.
func (in *IstioValidationsService) NewValidationInfo(ctx context.Context, clusters []string, changeMap ValidationChangeMap) (*validationInfo, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "newValidationInfo",
		observability.Attribute("package", "business"),
	)
	defer end()

	vInfo := validationInfo{
		changeMap: changeMap,
		clusters:  clusters,
		conf:      in.conf,
		nsMap:     map[string][]models.Namespace{},
		saMap:     map[string][]string{},
		wlMap:     map[string]map[string]models.Workloads{},
	}
	mesh, err := in.mesh.discovery.Mesh(ctx)
	if err != nil {
		return nil, err
	}
	vInfo.mesh = mesh

	// gather base info, mapped by cluster
	for _, cluster := range clusters {
		workloads, err := in.workload.GetAllWorkloads(ctx, cluster, "")
		if err != nil {
			return nil, err
		}
		vInfo.wlMap[cluster] = toWorkloadMap(workloads)

		namespaces, err := in.namespace.GetClusterNamespaces(ctx, cluster)
		if err != nil {
			return nil, err
		}
		vInfo.nsMap[cluster] = namespaces

		vInfo.saMap[cluster] = in.getServiceAccounts(namespaces, vInfo.wlMap[cluster], ResolveClusterIdentityDomain(mesh, cluster, in.conf.ExternalServices.Istio.IstioIdentityDomain))
	}

	// if changeDetection is enabled then loop through the namespaces and workloads, looking for a change
	if changeMap != nil {
		vInfo.reportChange = true
		changeDetected := false

		// loop through namespaces, looking for label/annotation changes that affect validations
		numNamespaces := 0
		for cluster, namespaces := range vInfo.nsMap {
			numNamespaces += len(namespaces)
			for _, ns := range namespaces {
				nsKey := strings.Join([]string{"NS", cluster, ns.Name}, ":")
				nsVersion := fmt.Sprintf("%v:%v", ns.Labels, ns.Annotations)
				changeDetected = changeMap.update(nsKey, nsVersion, vInfo.reportChange) || changeDetected
			}
		}
		changeDetected = changeMap.update("validation-num-namespaces", strconv.Itoa(numNamespaces), vInfo.reportChange) || changeDetected

		// loop through workloads, looking for label/serviceAccount changes that affect validations
		numWorkloads := 0
		for _, workloadsMap := range vInfo.wlMap {
			for _, workloads := range workloadsMap {
				numWorkloads += len(workloads)
				for _, w := range workloads {
					changeDetected = changeMap.update(w.ValidationKey, w.ValidationVersion, vInfo.reportChange) || changeDetected
				}
			}
		}
		changeDetected = changeMap.update("validation-num-workloads", strconv.Itoa(numWorkloads), vInfo.reportChange) || changeDetected

		vInfo.hasBaseChange = changeDetected
	}

	return &vInfo, nil
}

func (in *validationInfo) changeDetectionEnabled() bool {
	return in.changeMap != nil
}

func (in *validationInfo) update(kind, cluster, namespace, name, value string) bool {
	key := strings.Join([]string{kind, cluster, namespace, name}, ":")
	return in.changeMap.update(key, value, in.reportChange)
}

func (in *validationInfo) forceCheckers() bool {
	return in.hasBaseChange
}

// Validate runs a full validation on all objects. The first return variable is the "validationPerformed" bool, indicating whether or not
// the validation checkers were run. It will return false if a changeMap is provided in vInfo and no config changes were detected for the
// cluster. Otherwise, it will return true. When true the new "validations" are returned in the second return variable. When false
// the second argument is nil.
func (in *IstioValidationsService) Validate(ctx context.Context, cluster string, vInfo *validationInfo) (bool, models.IstioValidations, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "getValidations",
		observability.Attribute("package", "business"),
		observability.Attribute(observability.TracingClusterTag, cluster),
	)
	defer end()

	timer := internalmetrics.GetValidationProcessingTimePrometheusTimer("", "")
	defer internalmetrics.ObserveDurationAndLogResults(ctx, in.conf, timer, "ValidationProcessingTime", nil, "Total validation time")

	validations := models.IstioValidations{}
	vInfo.clusterInfo = &validationClusterInfo{
		cluster:        cluster,
		identityDomain: ResolveClusterIdentityDomain(vInfo.mesh, cluster, in.conf.ExternalServices.Istio.IstioIdentityDomain),
	}

	kubeCache, err := in.kialiCache.GetKubeCache(cluster)
	if err != nil {
		return false, nil, fmt.Errorf("unable to get kube cache for cluster [%s]: %w", cluster, err)
	}
	var svcList core_v1.ServiceList
	if err := kubeCache.List(ctx, &svcList, &client.ListOptions{}); err != nil {
		return false, nil, fmt.Errorf("unable to list services for cluster [%s]: %w", cluster, err)
	}
	vInfo.clusterInfo.services = svcList.Items
	vInfo.clusterInfo.kubeServiceHosts = kubernetes.NewKubeServiceHostsWithNamespaceDefaults(svcList.Items, vInfo.clusterInfo.identityDomain, buildNamespaceToExportTo(vInfo.mesh, cluster, svcList.Items))

	// grab all config for the cluster
	criteria := IstioConfigCriteria{
		IncludeAuthorizationPolicies:  true,
		IncludeDestinationRules:       true,
		IncludeGateways:               true,
		IncludeK8sGateways:            true,
		IncludeK8sGRPCRoutes:          true,
		IncludeK8sHTTPRoutes:          true,
		IncludeK8sInferencePools:      true,
		IncludeK8sReferenceGrants:     true,
		IncludePeerAuthentications:    true,
		IncludeRequestAuthentications: true,
		IncludeServiceEntries:         true,
		IncludeSidecars:               true,
		IncludeVirtualServices:        true,
		IncludeWorkloadEntries:        true,
		IncludeWorkloadGroups:         true,
	}
	istioConfigList, err := in.istioConfig.GetIstioConfigListForCluster(ctx, cluster, meta_v1.NamespaceAll, criteria)
	if err != nil {
		return false, nil, err
	}
	nsNames := getNsNames(vInfo.nsMap[cluster])
	filterIstioConfigByManagedNamespaces(istioConfigList, vInfo.mesh, cluster, nsNames)
	vInfo.clusterInfo.istioConfig = istioConfigList

	// Pre-compute namespace → rootNamespace so we can skip unmanaged namespaces and avoid
	// repeated ControlPlaneForNamespace calls later in getAllObjectCheckers and filterPeerAuths.
	// Uses ControlPlaneForNamespace directly (not BuildNamespaceToMeshConfig) because a namespace
	// should be validated even if cp.MeshConfig is nil.
	rootNamespaces := make(map[string]string, len(nsNames))
	if vInfo.mesh != nil {
		for _, ns := range nsNames {
			if cp, err := vInfo.mesh.ControlPlaneForNamespace(cluster, ns); cp != nil && err == nil {
				rootNamespaces[ns] = cp.RootNamespace
			}
		}
	}
	vInfo.clusterInfo.rootNamespaces = rootNamespaces

	// if change detection is enabled then decide if we need to run the checkers
	if vInfo.changeDetectionEnabled() {
		changeDetected := detectClusterConfigChange(vInfo)
		if !changeDetected && !vInfo.forceCheckers() {
			return false, nil, nil
		}
	}

	for _, namespace := range vInfo.nsMap[cluster] {
		// Skip validations for a particular namespace, mesh config was not found
		if _, managed := rootNamespaces[namespace.Name]; !managed {
			continue
		}

		vInfo.nsInfo = &validationNamespaceInfo{
			namespace: &namespace,
		}

		err := in.setNamespaceIstioConfig(vInfo)
		if err != nil {
			// Skip validations for a particular namespace, mesh config was not found
			log.Trace(err)
			continue
		}

		if err := in.setNonLocalMTLSConfig(vInfo); err != nil {
			// Skip validations for a particular namespace, mesh config was not found
			log.Trace(err)
			continue
		}

		objectCheckers, err := in.getAllObjectCheckers(vInfo)
		// Skip validations for a particular namespace, mesh config was not found
		if err != nil {
			log.Trace(err)
			continue
		}

		validations.MergeValidations(runObjectCheckers(ctx, objectCheckers, in.conf))
	}

	return true, validations, nil
}

// toWorkloadMap takes a list of workloads from different namespaces, and returns a map: namespace => models.Workloads
func toWorkloadMap(workloads models.Workloads) map[string]models.Workloads {
	workloadMap := map[string]models.Workloads{}

	for _, w := range workloads {
		workloads, ok := workloadMap[w.Namespace]
		if ok {
			workloads = append(workloads, w)
		} else {
			workloads = models.Workloads{w}
		}
		workloadMap[w.Namespace] = workloads
	}
	return workloadMap
}

// detectClusterConfigChange checks the version values for all of the relevant cluster config, updating
// as needed, and returns whether a change was detected.
func detectClusterConfigChange(vInfo *validationInfo) bool {
	change := false
	cluster := vInfo.clusterInfo.cluster

	// loop through the services and gather up their resourceVersions
	for _, s := range vInfo.clusterInfo.services {
		change = vInfo.update("SV", cluster, s.Namespace, s.Name, s.ResourceVersion) || change
	}

	// loop through the config and gather up their resourceVersions
	config := vInfo.clusterInfo.istioConfig
	for _, c := range config.AuthorizationPolicies {
		change = vInfo.update("AP", cluster, c.Namespace, c.Name, c.ResourceVersion) || change
	}
	for _, c := range config.DestinationRules {
		change = vInfo.update("DR", cluster, c.Namespace, c.Name, c.ResourceVersion) || change
	}
	for _, c := range config.EnvoyFilters {
		change = vInfo.update("EF", cluster, c.Namespace, c.Name, c.ResourceVersion) || change
	}
	for _, c := range config.Gateways {
		change = vInfo.update("GW", cluster, c.Namespace, c.Name, c.ResourceVersion) || change
	}
	for _, c := range config.K8sGateways {
		change = vInfo.update("KG", cluster, c.Namespace, c.Name, c.ResourceVersion) || change
	}
	for _, c := range config.K8sGRPCRoutes {
		change = vInfo.update("KGRPC", cluster, c.Namespace, c.Name, c.ResourceVersion) || change
	}
	for _, c := range config.K8sHTTPRoutes {
		change = vInfo.update("KHTTP", cluster, c.Namespace, c.Name, c.ResourceVersion) || change
	}
	for _, c := range config.K8sReferenceGrants {
		change = vInfo.update("KRG", cluster, c.Namespace, c.Name, c.ResourceVersion) || change
	}
	for _, c := range config.K8sTCPRoutes {
		change = vInfo.update("KTCP", cluster, c.Namespace, c.Name, c.ResourceVersion) || change
	}
	for _, c := range config.K8sTLSRoutes {
		change = vInfo.update("KTLS", cluster, c.Namespace, c.Name, c.ResourceVersion) || change
	}
	for _, c := range config.PeerAuthentications {
		change = vInfo.update("PA", cluster, c.Namespace, c.Name, c.ResourceVersion) || change
	}
	for _, c := range config.RequestAuthentications {
		change = vInfo.update("RA", cluster, c.Namespace, c.Name, c.ResourceVersion) || change
	}
	for _, c := range config.ServiceEntries {
		change = vInfo.update("SE", cluster, c.Namespace, c.Name, c.ResourceVersion) || change
	}
	for _, c := range config.Sidecars {
		change = vInfo.update("SC", cluster, c.Namespace, c.Name, c.ResourceVersion) || change
	}
	for _, c := range config.Telemetries {
		change = vInfo.update("TE", cluster, c.Namespace, c.Name, c.ResourceVersion) || change
	}
	for _, c := range config.VirtualServices {
		change = vInfo.update("VS", cluster, c.Namespace, c.Name, c.ResourceVersion) || change
	}
	for _, c := range config.WasmPlugins {
		change = vInfo.update("WP", cluster, c.Namespace, c.Name, c.ResourceVersion) || change
	}
	for _, c := range config.WorkloadEntries {
		change = vInfo.update("WE", cluster, c.Namespace, c.Name, c.ResourceVersion) || change
	}
	for _, c := range config.WorkloadGroups {
		change = vInfo.update("WG", cluster, c.Namespace, c.Name, c.ResourceVersion) || change
	}

	numConfig := len(config.AuthorizationPolicies) +
		len(config.DestinationRules) +
		len(config.EnvoyFilters) +
		len(config.Gateways) +
		len(config.K8sGateways) +
		len(config.K8sGRPCRoutes) +
		len(config.K8sHTTPRoutes) +
		len(config.K8sReferenceGrants) +
		len(config.K8sTCPRoutes) +
		len(config.K8sTLSRoutes) +
		len(config.PeerAuthentications) +
		len(config.RequestAuthentications) +
		len(config.ServiceEntries) +
		len(config.Sidecars) +
		len(config.Telemetries) +
		len(config.VirtualServices) +
		len(config.WorkloadEntries) +
		len(config.WorkloadGroups) +
		len(config.WasmPlugins)
	change = vInfo.update("validation-num-config", cluster, "", "", strconv.Itoa(numConfig)) || change

	return change
}

// getAllObjectCheckers returns all of the checkers to be executed for a full validation.
// TODO: we may want to to pass vInfo into all of these, if the checkers themselves are re-computing information
func (in *IstioValidationsService) getAllObjectCheckers(vInfo *validationInfo) ([]checkers.ObjectChecker, error) {
	cluster := vInfo.clusterInfo.cluster
	namespaces := vInfo.nsMap[cluster]
	nsNames := getNsNames(namespaces)
	istioConfigList := vInfo.nsInfo.istioConfig
	workloadsPerNamespace := vInfo.wlMap[cluster]
	mtlsDetails := vInfo.nsInfo.mtlsDetails
	rbacDetails := vInfo.nsInfo.rbacDetails
	services := vInfo.clusterInfo.services
	kubeServiceHosts := vInfo.clusterInfo.kubeServiceHosts
	conf := in.conf

	policyAllowAny, err := in.isPolicyAllowAny(vInfo)
	if err != nil {
		return nil, err
	}

	gatewayToNamespace, err := in.isGatewayToNamespace(vInfo)
	if err != nil {
		return nil, err
	}

	identityDomain := vInfo.clusterInfo.identityDomain

	return []checkers.ObjectChecker{
		checkers.AuthorizationPolicyChecker{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, Cluster: cluster, Conf: conf, IdentityDomain: identityDomain, KubeServiceHosts: kubeServiceHosts, MtlsDetails: *mtlsDetails, Namespaces: nsNames, PolicyAllowAny: policyAllowAny, ServiceAccounts: vInfo.saMap, ServiceEntries: istioConfigList.ServiceEntries, Services: services, VirtualServices: istioConfigList.VirtualServices, WorkloadsPerNamespace: workloadsPerNamespace},
		checkers.DestinationRulesChecker{Cluster: cluster, Conf: conf, DestinationRules: istioConfigList.DestinationRules, IdentityDomain: identityDomain, MTLSDetails: *mtlsDetails, Namespaces: namespaces, ServiceEntries: istioConfigList.ServiceEntries},
		checkers.GatewayChecker{Cluster: cluster, Conf: conf, Gateways: istioConfigList.Gateways, IsGatewayToNamespace: gatewayToNamespace, WorkloadsPerNamespace: workloadsPerNamespace},
		checkers.K8sGatewayChecker{Cluster: cluster, GatewayClasses: in.kialiCache.GatewayAPIClasses(cluster), K8sGateways: istioConfigList.K8sGateways},
		checkers.K8sGRPCRouteChecker{Cluster: cluster, Conf: conf, IdentityDomain: identityDomain, K8sGateways: istioConfigList.K8sGateways, K8sGRPCRoutes: istioConfigList.K8sGRPCRoutes, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces, Services: services},
		checkers.K8sHTTPRouteChecker{Cluster: cluster, Conf: conf, IdentityDomain: identityDomain, K8sGateways: istioConfigList.K8sGateways, K8sHTTPRoutes: istioConfigList.K8sHTTPRoutes, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces, Services: services},
		checkers.K8sReferenceGrantChecker{Cluster: cluster, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces},
		checkers.NoServiceChecker{AuthorizationDetails: rbacDetails, Cluster: cluster, Conf: conf, IdentityDomain: identityDomain, IstioConfigList: istioConfigList, KubeServiceHosts: kubeServiceHosts, Namespaces: namespaces, PolicyAllowAny: policyAllowAny, Services: services, WorkloadsPerNamespace: workloadsPerNamespace},
		checkers.NewPeerAuthenticationChecker(cluster, conf, identityDomain, vInfo.clusterInfo.rootNamespaces, *mtlsDetails, mtlsDetails.PeerAuthentications, workloadsPerNamespace),
		checkers.RequestAuthenticationChecker{Cluster: cluster, RequestAuthentications: istioConfigList.RequestAuthentications, WorkloadsPerNamespace: workloadsPerNamespace},
		checkers.ServiceEntryChecker{Cluster: cluster, Namespaces: namespaces, ServiceEntries: istioConfigList.ServiceEntries, WorkloadEntries: istioConfigList.WorkloadEntries},
		checkers.NewSidecarChecker(cluster, conf, identityDomain, vInfo.clusterInfo.rootNamespaces, namespaces, kubeServiceHosts, istioConfigList.ServiceEntries, istioConfigList.Sidecars, workloadsPerNamespace),
		checkers.TelemetryChecker{Namespaces: namespaces, Telemetries: istioConfigList.Telemetries},
		checkers.VirtualServiceChecker{Cluster: cluster, Conf: conf, DestinationRules: istioConfigList.DestinationRules, IdentityDomain: identityDomain, Namespaces: namespaces, VirtualServices: istioConfigList.VirtualServices},
		checkers.WasmPluginChecker{Namespaces: namespaces, WasmPlugins: istioConfigList.WasmPlugins},
		checkers.NewWorkloadChecker(rbacDetails.AuthorizationPolicies, cluster, conf, vInfo.clusterInfo.rootNamespaces, namespaces, workloadsPerNamespace),
		checkers.WorkloadGroupsChecker{Cluster: cluster, Conf: conf, IdentityDomain: identityDomain, ServiceAccounts: vInfo.saMap, WorkloadGroups: istioConfigList.WorkloadGroups},
	}, nil
}

// ValidateIstioObject validates a single Istio object of the given type with the given name found in the given namespace. Note that
// even validating a single object requires a fair amount of information, as it may interact with many other configs.
func (in *IstioValidationsService) ValidateIstioObject(ctx context.Context, cluster, namespace string, objectGVK schema.GroupVersionKind, object string) (models.IstioValidations, models.IstioReferencesMap, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetIstioObjectValidations",
		observability.Attribute("package", "business"),
		observability.Attribute(observability.TracingClusterTag, cluster),
		observability.Attribute("namespace", namespace),
		observability.Attribute("objectGVK", objectGVK.String()),
		observability.Attribute("object", object),
	)
	defer end()

	istioReferences := models.IstioReferencesMap{}

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	ns, err := in.namespace.GetClusterNamespace(ctx, namespace, cluster)
	if err != nil {
		return nil, istioReferences, err
	}

	// time this function execution so we can capture how long it takes to fully validate this istio object
	timer := internalmetrics.GetSingleValidationProcessingTimePrometheusTimer(namespace, objectGVK.String(), object)
	defer internalmetrics.ObserveDurationAndLogResults(
		ctx,
		in.conf,
		timer,
		"SingleValidationProcessingTime",
		map[string]string{
			"namespace": namespace,
			"gvk":       objectGVK.String(),
		},
		"Single object validation time")

	// validating a single object is not particularly efficient, it still requires a lot of up-front setup
	vInfo, err := in.NewValidationInfo(ctx, in.namespace.GetClusterList(), nil)
	if err != nil {
		return nil, models.IstioReferencesMap{}, err
	}

	vInfo.clusterInfo = &validationClusterInfo{
		cluster:        cluster,
		identityDomain: ResolveClusterIdentityDomain(vInfo.mesh, cluster, in.conf.ExternalServices.Istio.IstioIdentityDomain),
	}
	vInfo.nsInfo = &validationNamespaceInfo{
		namespace:   ns,
		mtlsDetails: &kubernetes.MTLSDetails{},
	}

	kubeCache, err := in.kialiCache.GetKubeCache(cluster)
	if err != nil {
		return nil, istioReferences, fmt.Errorf("unable to get kube cache for cluster [%s]: %w", cluster, err)
	}
	var svcList core_v1.ServiceList
	if err := kubeCache.List(ctx, &svcList, &client.ListOptions{}); err != nil {
		return nil, istioReferences, fmt.Errorf("unable to list services for cluster [%s]: %w", cluster, err)
	}
	vInfo.clusterInfo.services = svcList.Items
	vInfo.clusterInfo.kubeServiceHosts = kubernetes.NewKubeServiceHostsWithNamespaceDefaults(svcList.Items, vInfo.clusterInfo.identityDomain, buildNamespaceToExportTo(vInfo.mesh, cluster, svcList.Items))

	criteria := IstioConfigCriteria{
		IncludeAuthorizationPolicies:  true,
		IncludeDestinationRules:       true,
		IncludeGateways:               true,
		IncludeK8sGateways:            true,
		IncludeK8sGRPCRoutes:          true,
		IncludeK8sHTTPRoutes:          true,
		IncludeK8sInferencePools:      true,
		IncludeK8sReferenceGrants:     true,
		IncludePeerAuthentications:    true,
		IncludeRequestAuthentications: true,
		IncludeServiceEntries:         true,
		IncludeSidecars:               true,
		IncludeVirtualServices:        true,
		IncludeWorkloadEntries:        true,
		IncludeWorkloadGroups:         true,
	}
	clusterIstioConfigList, err := in.istioConfig.GetIstioConfigListForCluster(ctx, cluster, meta_v1.NamespaceAll, criteria)
	if err != nil {
		return nil, istioReferences, err
	}
	filterIstioConfigByManagedNamespaces(clusterIstioConfigList, vInfo.mesh, cluster, getNsNames(vInfo.nsMap[cluster]))
	vInfo.clusterInfo.istioConfig = clusterIstioConfigList

	if err := in.setNamespaceIstioConfig(vInfo); err != nil {
		log.Trace(err)
		return nil, istioReferences, nil
	}

	if err := in.setNonLocalMTLSConfig(vInfo); err != nil {
		log.Trace(err)
		return nil, istioReferences, nil
	}

	namespaces := vInfo.nsMap[cluster]
	nsNames := getNsNames(namespaces)
	istioConfigList := vInfo.nsInfo.istioConfig
	workloadsPerNamespace := vInfo.wlMap[cluster]
	mtlsDetails := vInfo.nsInfo.mtlsDetails
	rbacDetails := vInfo.nsInfo.rbacDetails
	services := vInfo.clusterInfo.services
	kubeServiceHosts := vInfo.clusterInfo.kubeServiceHosts
	var objectCheckers []checkers.ObjectChecker
	var referenceChecker ReferenceChecker
	conf := in.conf
	identityDomain := vInfo.clusterInfo.identityDomain

	rootNamespaces := make(map[string]string, len(nsNames))
	if vInfo.mesh != nil {
		for _, ns := range nsNames {
			if cp, err := vInfo.mesh.ControlPlaneForNamespace(cluster, ns); cp != nil && err == nil {
				rootNamespaces[ns] = cp.RootNamespace
			}
		}
	}

	policyAllowAny, err := in.isPolicyAllowAny(vInfo)
	if err != nil {
		log.Trace(err)
		return nil, istioReferences, nil
	}

	gatewayToNamespace, err := in.isGatewayToNamespace(vInfo)
	if err != nil {
		log.Trace(err)
		return nil, istioReferences, nil
	}

	noServiceChecker := checkers.NoServiceChecker{Conf: conf, IdentityDomain: identityDomain, Cluster: cluster, Namespaces: namespaces, IstioConfigList: istioConfigList, WorkloadsPerNamespace: workloadsPerNamespace, AuthorizationDetails: rbacDetails, KubeServiceHosts: kubeServiceHosts, Services: services, PolicyAllowAny: policyAllowAny}

	switch objectGVK {
	case kubernetes.Gateways:
		objectCheckers = []checkers.ObjectChecker{
			checkers.GatewayChecker{Conf: conf, Cluster: cluster, Gateways: istioConfigList.Gateways, WorkloadsPerNamespace: workloadsPerNamespace, IsGatewayToNamespace: gatewayToNamespace},
		}
		referenceChecker = references.GatewayReferences{Conf: conf, Gateways: istioConfigList.Gateways, IdentityDomain: identityDomain, VirtualServices: istioConfigList.VirtualServices, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.VirtualServices:
		virtualServiceChecker := checkers.VirtualServiceChecker{Cluster: cluster, Conf: conf, DestinationRules: istioConfigList.DestinationRules, IdentityDomain: identityDomain, Namespaces: namespaces, VirtualServices: istioConfigList.VirtualServices}
		objectCheckers = []checkers.ObjectChecker{noServiceChecker, virtualServiceChecker}
		referenceChecker = references.VirtualServiceReferences{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, Conf: conf, DestinationRules: istioConfigList.DestinationRules, IdentityDomain: identityDomain, Namespace: namespace, Namespaces: nsNames, VirtualServices: istioConfigList.VirtualServices}
	case kubernetes.DestinationRules:
		destinationRulesChecker := checkers.DestinationRulesChecker{Cluster: cluster, Conf: conf, DestinationRules: istioConfigList.DestinationRules, IdentityDomain: identityDomain, MTLSDetails: *mtlsDetails, Namespaces: namespaces, ServiceEntries: istioConfigList.ServiceEntries}
		objectCheckers = []checkers.ObjectChecker{noServiceChecker, destinationRulesChecker}
		referenceChecker = references.DestinationRuleReferences{Conf: conf, DestinationRules: istioConfigList.DestinationRules, IdentityDomain: identityDomain, KubeServiceHosts: kubeServiceHosts, Namespace: namespace, Namespaces: nsNames, ServiceEntries: istioConfigList.ServiceEntries, Services: services, VirtualServices: istioConfigList.VirtualServices, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.ServiceEntries:
		serviceEntryChecker := checkers.ServiceEntryChecker{Cluster: cluster, ServiceEntries: istioConfigList.ServiceEntries, Namespaces: namespaces, WorkloadEntries: istioConfigList.WorkloadEntries}
		objectCheckers = []checkers.ObjectChecker{serviceEntryChecker}
		referenceChecker = references.ServiceEntryReferences{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, Conf: conf, DestinationRules: istioConfigList.DestinationRules, IdentityDomain: identityDomain, KubeServiceHosts: kubeServiceHosts, Namespace: namespace, Namespaces: nsNames, ServiceEntries: istioConfigList.ServiceEntries, Sidecars: istioConfigList.Sidecars}
	case kubernetes.Sidecars:
		sidecarsChecker := checkers.NewSidecarChecker(cluster, conf, identityDomain, rootNamespaces, namespaces, kubeServiceHosts, istioConfigList.ServiceEntries, istioConfigList.Sidecars, workloadsPerNamespace)
		objectCheckers = []checkers.ObjectChecker{sidecarsChecker}
		referenceChecker = references.SidecarReferences{Conf: conf, IdentityDomain: identityDomain, KubeServiceHosts: kubeServiceHosts, Namespace: namespace, Namespaces: namespaces, ServiceEntries: istioConfigList.ServiceEntries, Sidecars: istioConfigList.Sidecars, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.AuthorizationPolicies:
		authPoliciesChecker := checkers.AuthorizationPolicyChecker{
			Conf:                  conf,
			IdentityDomain:        identityDomain,
			AuthorizationPolicies: rbacDetails.AuthorizationPolicies,
			Cluster:               cluster, Namespaces: nsNames, ServiceEntries: istioConfigList.ServiceEntries, ServiceAccounts: vInfo.saMap,
			WorkloadsPerNamespace: workloadsPerNamespace, MtlsDetails: *mtlsDetails, VirtualServices: istioConfigList.VirtualServices, KubeServiceHosts: kubeServiceHosts, Services: services, PolicyAllowAny: policyAllowAny,
		}
		objectCheckers = []checkers.ObjectChecker{authPoliciesChecker}
		referenceChecker = references.NewAuthorizationPolicyReferences(rbacDetails.AuthorizationPolicies, conf, identityDomain, cluster, rootNamespaces, namespace, nsNames, istioConfigList.ServiceEntries, istioConfigList.VirtualServices, kubeServiceHosts, workloadsPerNamespace)
	case kubernetes.PeerAuthentications:
		peerAuthnChecker := checkers.NewPeerAuthenticationChecker(cluster, conf, identityDomain, rootNamespaces, *mtlsDetails, mtlsDetails.PeerAuthentications, workloadsPerNamespace)
		objectCheckers = []checkers.ObjectChecker{peerAuthnChecker}
		referenceChecker = references.NewPeerAuthReferences(cluster, conf, identityDomain, rootNamespaces, *mtlsDetails, workloadsPerNamespace)
	case schema.GroupVersionKind{Group: "", Version: "", Kind: "workload"}:
		workloadChecker := checkers.NewWorkloadChecker(rbacDetails.AuthorizationPolicies, cluster, conf, rootNamespaces, namespaces, workloadsPerNamespace)
		objectCheckers = []checkers.ObjectChecker{workloadChecker}
	case kubernetes.WorkloadEntries:
		referenceChecker = references.WorkloadEntryReferences{WorkloadGroups: istioConfigList.WorkloadGroups, WorkloadEntries: istioConfigList.WorkloadEntries}
	case kubernetes.WorkloadGroups:
		wlGroupsChecker := checkers.WorkloadGroupsChecker{
			Cluster: cluster, Conf: conf, IdentityDomain: identityDomain, ServiceAccounts: vInfo.saMap, WorkloadGroups: istioConfigList.WorkloadGroups,
		}
		objectCheckers = []checkers.ObjectChecker{wlGroupsChecker}
		referenceChecker = references.WorkloadGroupReferences{WorkloadGroups: istioConfigList.WorkloadGroups, WorkloadEntries: istioConfigList.WorkloadEntries, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.RequestAuthentications:
		requestAuthnChecker := checkers.RequestAuthenticationChecker{Cluster: cluster, RequestAuthentications: istioConfigList.RequestAuthentications, WorkloadsPerNamespace: workloadsPerNamespace}
		objectCheckers = []checkers.ObjectChecker{requestAuthnChecker}
	case kubernetes.EnvoyFilters:
		// Validation on EnvoyFilters are not yet in place
	case kubernetes.WasmPlugins:
		// Validation on WasmPlugins is not expected
	case kubernetes.Telemetries:
		// Validation on Telemetries is not expected
	case kubernetes.K8sGateways:
		objectCheckers = []checkers.ObjectChecker{
			checkers.K8sGatewayChecker{Cluster: cluster, K8sGateways: istioConfigList.K8sGateways, GatewayClasses: in.kialiCache.GatewayAPIClasses(cluster)},
		}
		referenceChecker = references.K8sGatewayReferences{Conf: conf, IdentityDomain: identityDomain, K8sGateways: istioConfigList.K8sGateways, K8sHTTPRoutes: istioConfigList.K8sHTTPRoutes, K8sGRPCRoutes: istioConfigList.K8sGRPCRoutes, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.K8sGRPCRoutes:
		grpcRouteChecker := checkers.K8sGRPCRouteChecker{Cluster: cluster, Conf: conf, IdentityDomain: identityDomain, K8sGateways: istioConfigList.K8sGateways, K8sGRPCRoutes: istioConfigList.K8sGRPCRoutes, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces, Services: services}
		objectCheckers = []checkers.ObjectChecker{noServiceChecker, grpcRouteChecker}
		referenceChecker = references.K8sGRPCRouteReferences{Conf: conf, IdentityDomain: identityDomain, K8sGRPCRoutes: istioConfigList.K8sGRPCRoutes, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: nsNames}
	case kubernetes.K8sHTTPRoutes:
		httpRouteChecker := checkers.K8sHTTPRouteChecker{Cluster: cluster, Conf: conf, IdentityDomain: identityDomain, K8sGateways: istioConfigList.K8sGateways, K8sHTTPRoutes: istioConfigList.K8sHTTPRoutes, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces, Services: services}
		objectCheckers = []checkers.ObjectChecker{noServiceChecker, httpRouteChecker}
		referenceChecker = references.K8sHTTPRouteReferences{Conf: conf, IdentityDomain: identityDomain, K8sHTTPRoutes: istioConfigList.K8sHTTPRoutes, K8sInferencePools: istioConfigList.K8sInferencePools, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: nsNames}
	case kubernetes.K8sInferencePools:
		referenceChecker = references.K8sInferencePoolReferences{Conf: conf, IdentityDomain: identityDomain, K8sHTTPRoutes: istioConfigList.K8sHTTPRoutes, K8sInferencePools: istioConfigList.K8sInferencePools, KubeServiceHosts: kubeServiceHosts, Namespaces: nsNames, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.K8sReferenceGrants:
		objectCheckers = []checkers.ObjectChecker{
			checkers.K8sReferenceGrantChecker{Cluster: cluster, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces},
		}
	case kubernetes.K8sTCPRoutes:
		// Validation on K8sTCPRoutes is not expected
	case kubernetes.K8sTLSRoutes:
		// Validation on K8sTLSRoutes is not expected
	default:
		err = fmt.Errorf("object type not found: %v", objectGVK.String())
	}

	if referenceChecker != nil {
		istioReferences = runObjectReferenceChecker(ctx, in.conf, referenceChecker)
	}

	if objectCheckers == nil {
		return models.IstioValidations{}, istioReferences, err
	}

	validations := runObjectCheckers(ctx, objectCheckers, conf).FilterByKey(objectGVK, object)
	for k, v := range validations {
		in.kialiCache.Validations().Set(k, v)
	}

	return validations, istioReferences, nil
}

func runObjectCheckers(ctx context.Context, objectCheckers []checkers.ObjectChecker, conf *config.Config) models.IstioValidations {
	objectTypeValidations := models.IstioValidations{}

	// Run checks for each IstioObject type
	for _, objectChecker := range objectCheckers {
		objectTypeValidations.MergeValidations(runObjectChecker(ctx, conf, objectChecker))
	}

	objectTypeValidations.StripIgnoredChecks(conf)

	return objectTypeValidations
}

func runObjectChecker(ctx context.Context, conf *config.Config, objectChecker checkers.ObjectChecker) models.IstioValidations {
	// tracking the time it takes to execute the Check
	theType := fmt.Sprintf("%T", objectChecker)
	promtimer := internalmetrics.GetCheckerProcessingTimePrometheusTimer(theType)
	defer internalmetrics.ObserveDurationAndLogResults(
		ctx,
		conf,
		promtimer,
		"CheckerProcessingTime",
		map[string]string{"obj": theType},
		"Object validation checker time")
	return objectChecker.Check()
}

func runObjectReferenceChecker(ctx context.Context, conf *config.Config, referenceChecker ReferenceChecker) models.IstioReferencesMap {
	// tracking the time it takes to execute the Check
	theRef := fmt.Sprintf("%T", referenceChecker)
	promtimer := internalmetrics.GetCheckerProcessingTimePrometheusTimer(theRef)
	defer internalmetrics.ObserveDurationAndLogResults(
		ctx,
		conf,
		promtimer,
		"CheckerProcessingTime",
		map[string]string{"ref": theRef},
		"Reference validation checker time")
	return referenceChecker.References()
}

// getServiceAccounts gets SA information given the namespaces and workloads for a given cluster.
func (in *IstioValidationsService) getServiceAccounts(
	namespaces []models.Namespace,
	workloadsMap map[string]models.Workloads,
	identityDomain string,
) []string {
	serviceAccounts := map[string]bool{}
	istioDomain := strings.TrimPrefix(identityDomain, "svc.")

	for _, ns := range namespaces {
		saFullNameNs := fmt.Sprintf("%s/ns/%s/sa/", istioDomain, ns.Name)
		workloads := workloadsMap[ns.Name]
		for _, w := range workloads {
			for _, sAccountName := range w.ServiceAccountNames {
				saFullName := saFullNameNs + sAccountName
				serviceAccounts[saFullName] = true
			}
		}
	}
	return slices.Collect(maps.Keys(serviceAccounts))
}

// setNamespaceIstioConfig assumes the following are set:
//
//	vInfo.clusterInfo.istioConfig
//	vInfo.nsInfo.namespace
//
// It takes the clusterInfoConfig and calculates the namespace config information. It sets:
//
//	vInfo.nsInfo.istioConfig
//	vInfo.nsInfo.mtlsDetails
//	vInfo.nsInfo.rbacDetails
func (in *IstioValidationsService) setNamespaceIstioConfig(
	vInfo *validationInfo,
) error {
	var namespaceIstioConfigList models.IstioConfigList
	var mtlsDetails kubernetes.MTLSDetails
	var rbacDetails kubernetes.RBACDetails

	clusterIstioConfig := vInfo.clusterInfo.istioConfig

	// Filter VS
	filteredVSs := in.filterVSExportToNamespaces(clusterIstioConfig.VirtualServices, vInfo)
	namespaceIstioConfigList.VirtualServices = append(namespaceIstioConfigList.VirtualServices, filteredVSs...)

	// Filter DR
	filteredDRs := in.filterDRExportToNamespaces(kubernetes.FilterAutogeneratedDestinationRules(clusterIstioConfig.DestinationRules), vInfo)
	namespaceIstioConfigList.DestinationRules = append(namespaceIstioConfigList.DestinationRules, filteredDRs...)
	mtlsDetails.DestinationRules = append(mtlsDetails.DestinationRules, filteredDRs...)

	// Filter SE
	filteredSEs := in.filterSEExportToNamespaces(clusterIstioConfig.ServiceEntries, vInfo)
	namespaceIstioConfigList.ServiceEntries = append(namespaceIstioConfigList.ServiceEntries, filteredSEs...)

	// All Gateways
	namespaceIstioConfigList.Gateways = append(namespaceIstioConfigList.Gateways, kubernetes.FilterAutogeneratedGateways(clusterIstioConfig.Gateways)...)

	// All K8sGateways
	namespaceIstioConfigList.K8sGateways = append(namespaceIstioConfigList.K8sGateways, clusterIstioConfig.K8sGateways...)

	// All K8sHTTPRoutes
	namespaceIstioConfigList.K8sHTTPRoutes = append(namespaceIstioConfigList.K8sHTTPRoutes, clusterIstioConfig.K8sHTTPRoutes...)

	// All K8sGRPCRoutes
	namespaceIstioConfigList.K8sGRPCRoutes = append(namespaceIstioConfigList.K8sGRPCRoutes, clusterIstioConfig.K8sGRPCRoutes...)

	// All K8sInferencePools
	namespaceIstioConfigList.K8sInferencePools = append(namespaceIstioConfigList.K8sInferencePools, clusterIstioConfig.K8sInferencePools...)

	// All K8sReferenceGrants
	namespaceIstioConfigList.K8sReferenceGrants = append(namespaceIstioConfigList.K8sReferenceGrants, clusterIstioConfig.K8sReferenceGrants...)

	// All Sidecars
	namespaceIstioConfigList.Sidecars = append(namespaceIstioConfigList.Sidecars, clusterIstioConfig.Sidecars...)

	// All RequestAuthentications
	namespaceIstioConfigList.RequestAuthentications = append(namespaceIstioConfigList.RequestAuthentications, clusterIstioConfig.RequestAuthentications...)

	// All WorkloadEntries
	namespaceIstioConfigList.WorkloadEntries = append(namespaceIstioConfigList.WorkloadEntries, clusterIstioConfig.WorkloadEntries...)

	// All WorkloadGroups
	namespaceIstioConfigList.WorkloadGroups = append(namespaceIstioConfigList.WorkloadGroups, clusterIstioConfig.WorkloadGroups...)

	in.filterPeerAuths(vInfo, &mtlsDetails, clusterIstioConfig.PeerAuthentications)
	in.filterAuthPolicies(vInfo, &rbacDetails, clusterIstioConfig.AuthorizationPolicies)

	vInfo.nsInfo.istioConfig = &namespaceIstioConfigList
	vInfo.nsInfo.mtlsDetails = &mtlsDetails
	vInfo.nsInfo.rbacDetails = &rbacDetails

	return nil
}

func (in *IstioValidationsService) filterPeerAuths(vInfo *validationInfo, mtlsDetails *kubernetes.MTLSDetails, peerAuths []*security_v1.PeerAuthentication) {
	namespace := vInfo.nsInfo.namespace.Name
	rootNs := vInfo.clusterInfo.rootNamespaces[namespace]
	for _, pa := range peerAuths {
		if rootNs != "" && pa.Namespace == rootNs {
			mtlsDetails.MeshPeerAuthentications = append(mtlsDetails.MeshPeerAuthentications, pa)
		}
		if pa.Namespace == namespace || namespace == "" {
			mtlsDetails.PeerAuthentications = append(mtlsDetails.PeerAuthentications, pa)
		}
	}
}

func (in *IstioValidationsService) filterAuthPolicies(vInfo *validationInfo, rbacDetails *kubernetes.RBACDetails, authPolicies []*security_v1.AuthorizationPolicy) {
	namespace := vInfo.nsInfo.namespace.Name
	for _, ap := range authPolicies {
		if ap.Namespace == namespace || namespace == "" {
			rbacDetails.AuthorizationPolicies = append(rbacDetails.AuthorizationPolicies, ap)
		}
	}
}

func (in *IstioValidationsService) filterVSExportToNamespaces(vsList []*networking_v1.VirtualService, vInfo *validationInfo) []*networking_v1.VirtualService {
	if vInfo.nsInfo.namespace.Name == "" {
		return kubernetes.FilterAutogeneratedVirtualServices(vsList)
	}
	cluster := vInfo.clusterInfo.cluster
	var nsMeshConfigs map[string]*models.MeshConfig
	if vInfo.mesh != nil {
		nsNames := make([]string, 0, len(vsList))
		for _, vs := range vsList {
			nsNames = append(nsNames, vs.Namespace)
		}
		nsMeshConfigs = vInfo.mesh.BuildNamespaceToMeshConfig(cluster, nsNames)
	}

	var result []*networking_v1.VirtualService
	for _, vs := range vsList {
		if kubernetes.IsAutogenerated(vs.Name) {
			continue
		}
		var meshExportTo []string
		if nsMeshConfigs != nil && nsMeshConfigs[vs.Namespace] != nil {
			meshExportTo = nsMeshConfigs[vs.Namespace].DefaultVirtualServiceExportTo
		} else {
			log.Debugf("filterVSExportToNamespaces: no mesh config found for namespace %s in cluster %s, skipping", vs.Namespace, cluster)
			continue
		}
		if in.isExportedObjectIncluded(vs.Spec.ExportTo, meshExportTo, vs.Namespace, vInfo) {
			result = append(result, vs)
		}
	}
	return result
}

func (in *IstioValidationsService) filterDRExportToNamespaces(dr []*networking_v1.DestinationRule, vInfo *validationInfo) []*networking_v1.DestinationRule {
	if vInfo.nsInfo.namespace.Name == "" {
		return dr
	}
	cluster := vInfo.clusterInfo.cluster
	var nsMeshConfigs map[string]*models.MeshConfig
	if vInfo.mesh != nil {
		nsNames := make([]string, 0, len(dr))
		for _, d := range dr {
			nsNames = append(nsNames, d.Namespace)
		}
		nsMeshConfigs = vInfo.mesh.BuildNamespaceToMeshConfig(cluster, nsNames)
	}

	var result []*networking_v1.DestinationRule
	for _, d := range dr {
		var meshExportTo []string
		if nsMeshConfigs != nil && nsMeshConfigs[d.Namespace] != nil {
			meshExportTo = nsMeshConfigs[d.Namespace].DefaultDestinationRuleExportTo
		} else {
			log.Debugf("filterDRExportToNamespaces: no mesh config found for namespace %s in cluster %s, skipping", d.Namespace, cluster)
			continue
		}
		if in.isExportedObjectIncluded(d.Spec.ExportTo, meshExportTo, d.Namespace, vInfo) {
			result = append(result, d)
		}
	}
	return result
}

func (in *IstioValidationsService) filterSEExportToNamespaces(se []*networking_v1.ServiceEntry, vInfo *validationInfo) []*networking_v1.ServiceEntry {
	if vInfo.nsInfo.namespace == nil {
		return se
	}
	cluster := vInfo.clusterInfo.cluster
	var nsMeshConfigs map[string]*models.MeshConfig
	if vInfo.mesh != nil {
		nsNames := make([]string, 0, len(se))
		for _, s := range se {
			nsNames = append(nsNames, s.Namespace)
		}
		nsMeshConfigs = vInfo.mesh.BuildNamespaceToMeshConfig(cluster, nsNames)
	}

	var result []*networking_v1.ServiceEntry
	for _, s := range se {
		var meshExportTo []string
		if nsMeshConfigs != nil && nsMeshConfigs[s.Namespace] != nil {
			meshExportTo = nsMeshConfigs[s.Namespace].DefaultServiceExportTo
		} else {
			log.Debugf("filterSEExportToNamespaces: no mesh config found for namespace %s in cluster %s, skipping", s.Namespace, cluster)
			continue
		}
		if in.isExportedObjectIncluded(s.Spec.ExportTo, meshExportTo, s.Namespace, vInfo) {
			result = append(result, s)
		}
	}
	return result
}

func (in *IstioValidationsService) isExportedObjectIncluded(exportTo []string, meshExportTo []string, objectNamespace string, vInfo *validationInfo) bool {
	// Ambient mode namespace does not support ExportTo, so export only to own namespace
	cluster := vInfo.clusterInfo.cluster
	namespace := vInfo.nsInfo.namespace.Name
	allNamespaces := vInfo.nsMap[cluster]
	if isAmbient(allNamespaces, objectNamespace) {
		return objectNamespace == namespace
	}
	if len(exportTo) == 0 {
		// using mesh defaultExportTo values
		exportTo = meshExportTo
	}
	if len(exportTo) > 0 {
		for _, exportToNs := range exportTo {
			// take only namespaces where it is exported to, or if it is exported to all namespaces, or export to own namespace
			if checkExportTo(exportToNs, namespace, objectNamespace, allNamespaces) {
				return true
			}
		}
	} else {
		// no exportTo field, means object exported to all namespaces
		return true
	}
	return false
}

// filterIstioConfigByManagedNamespaces removes Istio configs from namespaces that are not in
// the mesh, preventing configs from non-mesh namespaces (e.g., "default") from being used in
// validation of mesh-belonging namespaces. Uses BuildNamespaceToMeshConfig to determine which
// namespaces are managed, and also includes root/control plane namespaces for mesh-wide configs.
func filterIstioConfigByManagedNamespaces(config *models.IstioConfigList, mesh *models.Mesh, cluster string, namespaces []string) {
	if mesh == nil {
		return
	}
	allowed := mesh.BuildNamespaceToMeshConfig(cluster, namespaces)
	allowedNames := slices.Collect(maps.Keys(allowed))

	config.AuthorizationPolicies = kubernetes.FilterByNamespaceNames(config.AuthorizationPolicies, allowedNames)
	config.DestinationRules = kubernetes.FilterByNamespaceNames(config.DestinationRules, allowedNames)
	config.Gateways = kubernetes.FilterByNamespaceNames(config.Gateways, allowedNames)
	config.K8sGateways = kubernetes.FilterByNamespaceNames(config.K8sGateways, allowedNames)
	config.K8sGRPCRoutes = kubernetes.FilterByNamespaceNames(config.K8sGRPCRoutes, allowedNames)
	config.K8sHTTPRoutes = kubernetes.FilterByNamespaceNames(config.K8sHTTPRoutes, allowedNames)
	config.K8sInferencePools = kubernetes.FilterByNamespaceNames(config.K8sInferencePools, allowedNames)
	config.K8sReferenceGrants = kubernetes.FilterByNamespaceNames(config.K8sReferenceGrants, allowedNames)
	config.PeerAuthentications = kubernetes.FilterByNamespaceNames(config.PeerAuthentications, allowedNames)
	config.RequestAuthentications = kubernetes.FilterByNamespaceNames(config.RequestAuthentications, allowedNames)
	config.ServiceEntries = kubernetes.FilterByNamespaceNames(config.ServiceEntries, allowedNames)
	config.Sidecars = kubernetes.FilterByNamespaceNames(config.Sidecars, allowedNames)
	config.Telemetries = kubernetes.FilterByNamespaceNames(config.Telemetries, allowedNames)
	config.VirtualServices = kubernetes.FilterByNamespaceNames(config.VirtualServices, allowedNames)
	config.WasmPlugins = kubernetes.FilterByNamespaceNames(config.WasmPlugins, allowedNames)
	config.WorkloadEntries = kubernetes.FilterByNamespaceNames(config.WorkloadEntries, allowedNames)
	config.WorkloadGroups = kubernetes.FilterByNamespaceNames(config.WorkloadGroups, allowedNames)
}

// buildNamespaceToExportTo precomputes namespace -> DefaultServiceExportTo for unique service namespaces.
// Delegates to Mesh.BuildNamespaceToExportTo after extracting namespace names from the service list.
func buildNamespaceToExportTo(mesh *models.Mesh, cluster string, services []core_v1.Service) map[string][]string {
	nsNames := make([]string, 0, len(services))
	for _, svc := range services {
		nsNames = append(nsNames, svc.Namespace)
	}
	return mesh.BuildNamespaceToExportTo(cluster, nsNames)
}

// setNonLocalMTLSConfig updates vInfo.nsInfo.mtlsDetails.EnabledAutoMtls based on the control plane
// that manages the namespace being validated (multi-primary support).
func (in *IstioValidationsService) setNonLocalMTLSConfig(vInfo *validationInfo) error {
	cluster := vInfo.clusterInfo.cluster
	namespace := vInfo.nsInfo.namespace.Name
	cp, err := vInfo.mesh.ControlPlaneForNamespace(cluster, namespace)
	if cp == nil || err != nil {
		return err
	}
	if cp.MeshConfig != nil && cp.MeshConfig.EnableAutoMtls != nil {
		vInfo.nsInfo.mtlsDetails.EnabledAutoMtls = cp.MeshConfig.EnableAutoMtls.Value
	}
	return nil
}

func (in *IstioValidationsService) isGatewayToNamespace(vInfo *validationInfo) (bool, error) {
	cluster := vInfo.clusterInfo.cluster
	namespace := vInfo.nsInfo.namespace.Name
	cp, err := vInfo.mesh.ControlPlaneForNamespace(cluster, namespace)
	if cp == nil || err != nil {
		return false, err
	}
	return cp.IsGatewayToNamespace, nil
}

func (in *IstioValidationsService) isPolicyAllowAny(vInfo *validationInfo) (bool, error) {
	cluster := vInfo.clusterInfo.cluster
	namespace := vInfo.nsInfo.namespace.Name
	cp, err := vInfo.mesh.ControlPlaneForNamespace(cluster, namespace)
	if cp == nil || err != nil {
		return false, err
	}
	if cp.MeshConfig != nil && cp.MeshConfig.OutboundTrafficPolicy != nil {
		return cp.MeshConfig.OutboundTrafficPolicy.Mode == istiov1alpha1.MeshConfig_OutboundTrafficPolicy_ALLOW_ANY, nil
	}
	return false, nil
}

func checkExportTo(exportToNs string, currentNamespace string, ownNs string, allNamespaces []models.Namespace) bool {
	// check if namespaces where it is exported to, or if it is exported to all namespaces, or export to own namespace
	// when exported to non-existing namespace, consider it to show validation error
	return exportToNs == "*" ||
		exportToNs == currentNamespace ||
		(exportToNs == "." && ownNs == currentNamespace) ||
		(exportToNs != "." && exportToNs != "*" && !exists(allNamespaces, exportToNs))
}

func exists(namespaces []models.Namespace, namespace string) bool {
	return sliceutil.Some(namespaces, func(ns models.Namespace) bool { return ns.Name == namespace })
}

func isAmbient(namespaces []models.Namespace, namespace string) bool {
	ns := sliceutil.Find(namespaces, func(ns models.Namespace) bool { return ns.Name == namespace })
	return ns != nil && ns.IsAmbient
}

func getNsNames(nss []models.Namespace) []string {
	// Pre-existing bug fix: was make([]string, len(nss)) which pre-fills with
	// empty strings, then append added real names after them. Use length 0 with
	// capacity so append starts at index 0.
	names := make([]string, 0, len(nss))
	for _, ns := range nss {
		names = append(names, ns.Name)
	}
	return names
}
