package cache

import (
	"fmt"

	extentions_v1alpha1 "istio.io/client-go/pkg/apis/extensions/v1alpha1"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"
	"istio.io/client-go/pkg/apis/telemetry/v1alpha1"
	istio "istio.io/client-go/pkg/informers/externalversions"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/kubernetes"
)

type (
	IstioCache interface {
		CheckIstioResource(resourceType string) bool

		GetDestinationRule(namespace, name string) (*networking_v1beta1.DestinationRule, error)
		GetDestinationRules(namespace, labelSelector string) ([]*networking_v1beta1.DestinationRule, error)
		GetEnvoyFilter(namespace, name string) (*networking_v1alpha3.EnvoyFilter, error)
		GetEnvoyFilters(namespace, labelSelector string) ([]*networking_v1alpha3.EnvoyFilter, error)
		GetGateway(namespace, name string) (*networking_v1beta1.Gateway, error)
		GetGateways(namespace, labelSelector string) ([]*networking_v1beta1.Gateway, error)
		GetServiceEntry(namespace, name string) (*networking_v1beta1.ServiceEntry, error)
		GetServiceEntries(namespace, labelSelector string) ([]*networking_v1beta1.ServiceEntry, error)
		GetSidecar(namespace, name string) (*networking_v1beta1.Sidecar, error)
		GetSidecars(namespace, labelSelector string) ([]*networking_v1beta1.Sidecar, error)
		GetVirtualService(namespace, name string) (*networking_v1beta1.VirtualService, error)
		GetVirtualServices(namespace, labelSelector string) ([]*networking_v1beta1.VirtualService, error)
		GetWorkloadEntry(namespace, name string) (*networking_v1beta1.WorkloadEntry, error)
		GetWorkloadEntries(namespace, labelSelector string) ([]*networking_v1beta1.WorkloadEntry, error)
		GetWorkloadGroup(namespace, name string) (*networking_v1beta1.WorkloadGroup, error)
		GetWorkloadGroups(namespace, labelSelector string) ([]*networking_v1beta1.WorkloadGroup, error)
		GetWasmPlugin(namespace, name string) (*extentions_v1alpha1.WasmPlugin, error)
		GetWasmPlugins(namespace, labelSelector string) ([]*extentions_v1alpha1.WasmPlugin, error)
		GetTelemetry(namespace, name string) (*v1alpha1.Telemetry, error)
		GetTelemetries(namespace, labelSelector string) ([]*v1alpha1.Telemetry, error)

		GetAuthorizationPolicy(namespace, name string) (*security_v1beta1.AuthorizationPolicy, error)
		GetAuthorizationPolicies(namespace, labelSelector string) ([]*security_v1beta1.AuthorizationPolicy, error)
		GetPeerAuthentication(namespace, name string) (*security_v1beta1.PeerAuthentication, error)
		GetPeerAuthentications(namespace, labelSelector string) ([]*security_v1beta1.PeerAuthentication, error)
		GetRequestAuthentication(namespace, name string) (*security_v1beta1.RequestAuthentication, error)
		GetRequestAuthentications(namespace, labelSelector string) ([]*security_v1beta1.RequestAuthentication, error)
	}
)

func (c *kialiCacheImpl) CheckIstioResource(resourceType string) bool {
	// cacheIstioTypes stores the single types but for compatibility with kubernetes api resourceType will use plurals
	_, exist := c.cacheIstioTypes[kubernetes.PluralType[resourceType]]
	return exist
}

func (c *kialiCacheImpl) createIstioInformers(namespace string) istio.SharedInformerFactory {
	var opts []istio.SharedInformerOption
	if namespace != "" {
		opts = append(opts, istio.WithNamespace(namespace))
	}
	sharedInformers := istio.NewSharedInformerFactoryWithOptions(c.istioApi, c.refreshDuration, opts...)
	lister := c.getCacheLister(namespace)

	if c.CheckIstioResource(kubernetes.AuthorizationPolicies) {
		lister.authzLister = sharedInformers.Security().V1beta1().AuthorizationPolicies().Lister()
		sharedInformers.Security().V1beta1().AuthorizationPolicies().Informer().AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.DestinationRules) {
		lister.destinationRuleLister = sharedInformers.Networking().V1beta1().DestinationRules().Lister()
		sharedInformers.Networking().V1beta1().DestinationRules().Informer().AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.EnvoyFilters) {
		lister.envoyFilterLister = sharedInformers.Networking().V1alpha3().EnvoyFilters().Lister()
		sharedInformers.Networking().V1alpha3().EnvoyFilters().Informer().AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.Gateways) {
		lister.gatewayLister = sharedInformers.Networking().V1beta1().Gateways().Lister()
		sharedInformers.Networking().V1beta1().Gateways().Informer().AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.PeerAuthentications) {
		lister.peerAuthnLister = sharedInformers.Security().V1beta1().PeerAuthentications().Lister()
		sharedInformers.Security().V1beta1().PeerAuthentications().Informer().AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.RequestAuthentications) {
		lister.requestAuthnLister = sharedInformers.Security().V1beta1().RequestAuthentications().Lister()
		sharedInformers.Security().V1beta1().RequestAuthentications().Informer().AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.ServiceEntries) {
		lister.serviceEntryLister = sharedInformers.Networking().V1beta1().ServiceEntries().Lister()
		sharedInformers.Networking().V1beta1().ServiceEntries().Informer().AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.Sidecars) {
		lister.sidecarLister = sharedInformers.Networking().V1beta1().Sidecars().Lister()
		sharedInformers.Networking().V1beta1().Sidecars().Informer().AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.Telemetries) {
		lister.telemetryLister = sharedInformers.Telemetry().V1alpha1().Telemetries().Lister()
		sharedInformers.Telemetry().V1alpha1().Telemetries().Informer().AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.VirtualServices) {
		lister.virtualServiceLister = sharedInformers.Networking().V1beta1().VirtualServices().Lister()
		sharedInformers.Networking().V1beta1().VirtualServices().Informer().AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.WasmPlugins) {
		lister.wasmPluginLister = sharedInformers.Extensions().V1alpha1().WasmPlugins().Lister()
		sharedInformers.Extensions().V1alpha1().WasmPlugins().Informer().AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.WorkloadEntries) {
		lister.workloadEntryLister = sharedInformers.Networking().V1beta1().WorkloadEntries().Lister()
		sharedInformers.Networking().V1beta1().WorkloadEntries().Informer().AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.WorkloadGroups) {
		lister.workloadGroupLister = sharedInformers.Networking().V1beta1().WorkloadGroups().Lister()
		sharedInformers.Networking().V1beta1().WorkloadGroups().Informer().AddEventHandler(c.registryRefreshHandler)
	}

	return sharedInformers
}

func (c *kialiCacheImpl) GetDestinationRule(namespace, name string) (*networking_v1beta1.DestinationRule, error) {
	if !c.CheckIstioResource(kubernetes.DestinationRules) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.DestinationRuleType)
	}

	dr, err := c.getCacheLister(namespace).destinationRuleLister.DestinationRules(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	dr.Kind = kubernetes.DestinationRuleType
	return dr, nil
}

func (c *kialiCacheImpl) GetDestinationRules(namespace, labelSelector string) ([]*networking_v1beta1.DestinationRule, error) {
	if !c.CheckIstioResource(kubernetes.DestinationRules) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.DestinationRuleType)
	}
	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	drs, err := c.getCacheLister(namespace).destinationRuleLister.DestinationRules(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if drs == nil {
		return []*networking_v1beta1.DestinationRule{}, nil
	}

	for _, dr := range drs {
		dr.Kind = kubernetes.DestinationRuleType
	}
	return drs, nil
}

func (c *kialiCacheImpl) GetEnvoyFilter(namespace, name string) (*networking_v1alpha3.EnvoyFilter, error) {
	if !c.CheckIstioResource(kubernetes.EnvoyFilters) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.EnvoyFilterType)
	}

	ef, err := c.getCacheLister(namespace).envoyFilterLister.EnvoyFilters(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	ef.Kind = kubernetes.EnvoyFilterType
	return ef, nil
}

func (c *kialiCacheImpl) GetEnvoyFilters(namespace, labelSelector string) ([]*networking_v1alpha3.EnvoyFilter, error) {
	if !c.CheckIstioResource(kubernetes.EnvoyFilters) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.EnvoyFilterType)
	}
	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	efs, err := c.getCacheLister(namespace).envoyFilterLister.EnvoyFilters(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if efs == nil {
		return []*networking_v1alpha3.EnvoyFilter{}, nil
	}

	for _, ef := range efs {
		ef.Kind = kubernetes.EnvoyFilterType
	}
	return efs, nil
}

func (c *kialiCacheImpl) GetGateway(namespace, name string) (*networking_v1beta1.Gateway, error) {
	if !c.CheckIstioResource(kubernetes.Gateways) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.GatewayType)
	}

	gw, err := c.getCacheLister(namespace).gatewayLister.Gateways(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	gw.Kind = kubernetes.GatewayType
	return gw, nil
}

func (c *kialiCacheImpl) GetGateways(namespace, labelSelector string) ([]*networking_v1beta1.Gateway, error) {
	if !c.CheckIstioResource(kubernetes.Gateways) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.Gateways)
	}
	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	gateways, err := c.getCacheLister(namespace).gatewayLister.Gateways(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if gateways == nil {
		return []*networking_v1beta1.Gateway{}, nil
	}

	for _, gw := range gateways {
		gw.Kind = kubernetes.GatewayType
	}
	return gateways, nil
}

func (c *kialiCacheImpl) GetServiceEntry(namespace, name string) (*networking_v1beta1.ServiceEntry, error) {
	if !c.CheckIstioResource(kubernetes.ServiceEntries) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.ServiceEntryType)
	}

	se, err := c.getCacheLister(namespace).serviceEntryLister.ServiceEntries(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	se.Kind = kubernetes.ServiceEntryType
	return se, nil
}

func (c *kialiCacheImpl) GetServiceEntries(namespace, labelSelector string) ([]*networking_v1beta1.ServiceEntry, error) {
	if !c.CheckIstioResource(kubernetes.ServiceEntries) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.ServiceEntryType)
	}
	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	ses, err := c.getCacheLister(namespace).serviceEntryLister.ServiceEntries(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if ses == nil {
		return []*networking_v1beta1.ServiceEntry{}, nil
	}

	for _, se := range ses {
		se.Kind = kubernetes.ServiceEntryType
	}
	return ses, nil
}

func (c *kialiCacheImpl) GetSidecar(namespace, name string) (*networking_v1beta1.Sidecar, error) {
	if !c.CheckIstioResource(kubernetes.Sidecars) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.SidecarType)
	}

	sc, err := c.getCacheLister(namespace).sidecarLister.Sidecars(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	sc.Kind = kubernetes.SidecarType
	return sc, nil
}

func (c *kialiCacheImpl) GetSidecars(namespace, labelSelector string) ([]*networking_v1beta1.Sidecar, error) {
	if !c.CheckIstioResource(kubernetes.Sidecars) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.SidecarType)
	}
	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	sidecars, err := c.getCacheLister(namespace).sidecarLister.Sidecars(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if sidecars == nil {
		return []*networking_v1beta1.Sidecar{}, nil
	}

	for _, sc := range sidecars {
		sc.Kind = kubernetes.SidecarType
	}
	return sidecars, nil
}

func (c *kialiCacheImpl) GetVirtualService(namespace, name string) (*networking_v1beta1.VirtualService, error) {
	if !c.CheckIstioResource(kubernetes.VirtualServices) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.VirtualServiceType)
	}

	vs, err := c.getCacheLister(namespace).virtualServiceLister.VirtualServices(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	vs.Kind = kubernetes.VirtualServiceType
	return vs, nil
}

func (c *kialiCacheImpl) GetVirtualServices(namespace, labelSelector string) ([]*networking_v1beta1.VirtualService, error) {
	if !c.CheckIstioResource(kubernetes.VirtualServices) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.VirtualServiceType)
	}
	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	vs, err := c.getCacheLister(namespace).virtualServiceLister.VirtualServices(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if vs == nil {
		return []*networking_v1beta1.VirtualService{}, nil
	}

	for _, v := range vs {
		v.Kind = kubernetes.VirtualServiceType
	}
	return vs, nil
}

func (c *kialiCacheImpl) GetWorkloadEntry(namespace, name string) (*networking_v1beta1.WorkloadEntry, error) {
	if !c.CheckIstioResource(kubernetes.WorkloadEntries) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.WorkloadEntryType)
	}

	we, err := c.getCacheLister(namespace).workloadEntryLister.WorkloadEntries(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	we.Kind = kubernetes.WorkloadEntryType
	return we, nil
}

func (c *kialiCacheImpl) GetWorkloadEntries(namespace, labelSelector string) ([]*networking_v1beta1.WorkloadEntry, error) {
	if !c.CheckIstioResource(kubernetes.WorkloadEntries) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.WorkloadEntryType)
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	we, err := c.getCacheLister(namespace).workloadEntryLister.WorkloadEntries(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if we == nil {
		return []*networking_v1beta1.WorkloadEntry{}, nil
	}

	for _, w := range we {
		w.Kind = kubernetes.WorkloadEntryType
	}
	return we, nil
}

func (c *kialiCacheImpl) GetWorkloadGroup(namespace, name string) (*networking_v1beta1.WorkloadGroup, error) {
	if !c.CheckIstioResource(kubernetes.WorkloadGroups) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.WorkloadGroupType)
	}

	wg, err := c.getCacheLister(namespace).workloadGroupLister.WorkloadGroups(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	wg.Kind = kubernetes.WorkloadGroupType
	return wg, nil
}

func (c *kialiCacheImpl) GetWorkloadGroups(namespace, labelSelector string) ([]*networking_v1beta1.WorkloadGroup, error) {
	if !c.CheckIstioResource(kubernetes.WorkloadGroups) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.WorkloadGroups)
	}
	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	wg, err := c.getCacheLister(namespace).workloadGroupLister.WorkloadGroups(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if wg == nil {
		return []*networking_v1beta1.WorkloadGroup{}, nil
	}

	for _, w := range wg {
		w.Kind = kubernetes.WorkloadGroupType
	}
	return wg, nil
}

func (c *kialiCacheImpl) GetWasmPlugin(namespace, name string) (*extentions_v1alpha1.WasmPlugin, error) {
	if !c.CheckIstioResource(kubernetes.WasmPlugins) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.WasmPluginType)
	}

	wp, err := c.getCacheLister(namespace).wasmPluginLister.WasmPlugins(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	wp.Kind = kubernetes.WasmPluginType
	return wp, nil
}

func (c *kialiCacheImpl) GetWasmPlugins(namespace, labelSelector string) ([]*extentions_v1alpha1.WasmPlugin, error) {
	if !c.CheckIstioResource(kubernetes.WasmPlugins) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.WorkloadGroups)
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	wp, err := c.getCacheLister(namespace).wasmPluginLister.WasmPlugins(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if wp == nil {
		return []*extentions_v1alpha1.WasmPlugin{}, nil
	}

	for _, w := range wp {
		w.Kind = kubernetes.WasmPluginType
	}
	return wp, nil
}

func (c *kialiCacheImpl) GetTelemetry(namespace, name string) (*v1alpha1.Telemetry, error) {
	if !c.CheckIstioResource(kubernetes.Telemetries) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.WorkloadGroupType)
	}

	t, err := c.getCacheLister(namespace).telemetryLister.Telemetries(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	t.Kind = kubernetes.TelemetryType
	return t, nil
}

func (c *kialiCacheImpl) GetTelemetries(namespace, labelSelector string) ([]*v1alpha1.Telemetry, error) {
	if !c.CheckIstioResource(kubernetes.Telemetries) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.WorkloadGroups)
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	t, err := c.getCacheLister(namespace).telemetryLister.Telemetries(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if t == nil {
		return []*v1alpha1.Telemetry{}, nil
	}

	for _, w := range t {
		w.Kind = kubernetes.TelemetryType
	}

	return t, nil
}

func (c *kialiCacheImpl) GetAuthorizationPolicy(namespace, name string) (*security_v1beta1.AuthorizationPolicy, error) {
	if !c.CheckIstioResource(kubernetes.AuthorizationPolicies) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.AuthorizationPoliciesType)
	}

	ap, err := c.getCacheLister(namespace).authzLister.AuthorizationPolicies(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	ap.Kind = kubernetes.AuthorizationPoliciesType
	return ap, nil
}

func (c *kialiCacheImpl) GetAuthorizationPolicies(namespace, labelSelector string) ([]*security_v1beta1.AuthorizationPolicy, error) {
	if !c.CheckIstioResource(kubernetes.AuthorizationPolicies) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.AuthorizationPolicies)
	}
	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	authPolicies, err := c.getCacheLister(namespace).authzLister.AuthorizationPolicies(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if authPolicies == nil {
		return []*security_v1beta1.AuthorizationPolicy{}, nil
	}

	for _, ap := range authPolicies {
		ap.Kind = kubernetes.AuthorizationPoliciesType
	}
	return authPolicies, nil
}

func (c *kialiCacheImpl) GetPeerAuthentication(namespace, name string) (*security_v1beta1.PeerAuthentication, error) {
	if !c.CheckIstioResource(kubernetes.PeerAuthentications) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.PeerAuthenticationsType)
	}

	pa, err := c.getCacheLister(namespace).peerAuthnLister.PeerAuthentications(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	pa.Kind = kubernetes.PeerAuthenticationsType
	return pa, nil
}

func (c *kialiCacheImpl) GetPeerAuthentications(namespace, labelSelector string) ([]*security_v1beta1.PeerAuthentication, error) {
	if !c.CheckIstioResource(kubernetes.PeerAuthentications) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.PeerAuthenticationsType)
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	peerAuths, err := c.getCacheLister(namespace).peerAuthnLister.PeerAuthentications(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if peerAuths == nil {
		return []*security_v1beta1.PeerAuthentication{}, nil
	}

	for _, pa := range peerAuths {
		pa.Kind = kubernetes.PeerAuthenticationsType
	}
	return peerAuths, nil
}

func (c *kialiCacheImpl) GetRequestAuthentication(namespace, name string) (*security_v1beta1.RequestAuthentication, error) {
	if !c.CheckIstioResource(kubernetes.RequestAuthentications) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.RequestAuthentications)
	}

	ra, err := c.getCacheLister(namespace).requestAuthnLister.RequestAuthentications(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	ra.Kind = kubernetes.RequestAuthenticationsType
	return ra, nil
}

func (c *kialiCacheImpl) GetRequestAuthentications(namespace, labelSelector string) ([]*security_v1beta1.RequestAuthentication, error) {
	if !c.CheckIstioResource(kubernetes.RequestAuthentications) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.RequestAuthenticationsType)
	}
	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	reqAuths, err := c.getCacheLister(namespace).requestAuthnLister.RequestAuthentications(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if reqAuths == nil {
		return []*security_v1beta1.RequestAuthentication{}, nil
	}

	for _, ra := range reqAuths {
		ra.Kind = kubernetes.RequestAuthenticationsType
	}
	return reqAuths, nil
}
