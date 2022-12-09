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
	gatewayapi "sigs.k8s.io/gateway-api/apis/v1alpha2"
	gateway "sigs.k8s.io/gateway-api/pkg/client/informers/externalversions"

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

		GetK8sGateway(namespace, name string) (*gatewayapi.Gateway, error)
		GetK8sGateways(namespace, labelSelector string) ([]*gatewayapi.Gateway, error)
		GetK8sHTTPRoute(namespace, name string) (*gatewayapi.HTTPRoute, error)
		GetK8sHTTPRoutes(namespace, labelSelector string) ([]*gatewayapi.HTTPRoute, error)

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

func (c *kialiCacheImpl) createGatewayInformers(namespace string) gateway.SharedInformerFactory {
	sharedInformers := gateway.NewSharedInformerFactory(c.gatewayApi, c.refreshDuration)
	lister := c.getCacheLister(namespace)

	if c.istioClient.IsGatewayAPI() {
		if c.CheckIstioResource(kubernetes.K8sGateways) {
			lister.k8sgatewayLister = sharedInformers.Gateway().V1alpha2().Gateways().Lister()
			sharedInformers.Gateway().V1alpha2().Gateways().Informer().AddEventHandler(c.registryRefreshHandler)
		}
		if c.CheckIstioResource(kubernetes.K8sHTTPRoutes) {
			lister.k8shttprouteLister = sharedInformers.Gateway().V1alpha2().HTTPRoutes().Lister()
			sharedInformers.Gateway().V1alpha2().Gateways().Informer().AddEventHandler(c.registryRefreshHandler)
		}
	}
	return sharedInformers
}

func (c *kialiCacheImpl) GetDestinationRule(namespace, name string) (*networking_v1beta1.DestinationRule, error) {
	if !c.CheckIstioResource(kubernetes.DestinationRules) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.DestinationRuleType)
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	dr, err := c.getCacheLister(namespace).destinationRuleLister.DestinationRules(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	// Do not modify what is returned by the lister since that is shared and will cause data races.
	retDR := dr.DeepCopy()
	retDR.Kind = kubernetes.DestinationRuleType
	return retDR, nil
}

func (c *kialiCacheImpl) GetDestinationRules(namespace, labelSelector string) ([]*networking_v1beta1.DestinationRule, error) {
	if !c.CheckIstioResource(kubernetes.DestinationRules) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.DestinationRuleType)
	}
	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	drs, err := c.getCacheLister(namespace).destinationRuleLister.DestinationRules(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if drs == nil {
		return []*networking_v1beta1.DestinationRule{}, nil
	}

	// Do not modify what is returned by the lister since that is shared and will cause data races.
	var retDRs []*networking_v1beta1.DestinationRule
	for _, dr := range drs {
		d := dr.DeepCopy()
		d.Kind = kubernetes.DestinationRuleType
		retDRs = append(retDRs, d)
	}
	return retDRs, nil
}

func (c *kialiCacheImpl) GetEnvoyFilter(namespace, name string) (*networking_v1alpha3.EnvoyFilter, error) {
	if !c.CheckIstioResource(kubernetes.EnvoyFilters) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.EnvoyFilterType)
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	ef, err := c.getCacheLister(namespace).envoyFilterLister.EnvoyFilters(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	// Do not modify what is returned by the lister since that is shared and will cause data races.
	retEF := ef.DeepCopy()
	retEF.Kind = kubernetes.EnvoyFilterType
	return retEF, nil
}

func (c *kialiCacheImpl) GetEnvoyFilters(namespace, labelSelector string) ([]*networking_v1alpha3.EnvoyFilter, error) {
	if !c.CheckIstioResource(kubernetes.EnvoyFilters) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.EnvoyFilterType)
	}
	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	efs, err := c.getCacheLister(namespace).envoyFilterLister.EnvoyFilters(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if efs == nil {
		return []*networking_v1alpha3.EnvoyFilter{}, nil
	}

	var retEFs []*networking_v1alpha3.EnvoyFilter
	for _, ef := range efs {
		e := ef.DeepCopy()
		e.Kind = kubernetes.EnvoyFilterType
		retEFs = append(retEFs, e)
	}
	return retEFs, nil
}

func (c *kialiCacheImpl) GetGateway(namespace, name string) (*networking_v1beta1.Gateway, error) {
	if !c.CheckIstioResource(kubernetes.Gateways) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.GatewayType)
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	gw, err := c.getCacheLister(namespace).gatewayLister.Gateways(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retGW := gw.DeepCopy()
	retGW.Kind = kubernetes.GatewayType
	return retGW, nil
}

func (c *kialiCacheImpl) GetGateways(namespace, labelSelector string) ([]*networking_v1beta1.Gateway, error) {
	if !c.CheckIstioResource(kubernetes.Gateways) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.Gateways)
	}
	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	gateways, err := c.getCacheLister(namespace).gatewayLister.Gateways(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if gateways == nil {
		return []*networking_v1beta1.Gateway{}, nil
	}

	var retGateways []*networking_v1beta1.Gateway
	for _, gw := range gateways {
		g := gw.DeepCopy()
		g.Kind = kubernetes.GatewayType
		retGateways = append(retGateways, g)
	}
	return retGateways, nil
}

func (c *kialiCacheImpl) GetServiceEntry(namespace, name string) (*networking_v1beta1.ServiceEntry, error) {
	if !c.CheckIstioResource(kubernetes.ServiceEntries) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.ServiceEntryType)
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	se, err := c.getCacheLister(namespace).serviceEntryLister.ServiceEntries(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retSE := se.DeepCopy()
	retSE.Kind = kubernetes.ServiceEntryType
	return retSE, nil
}

func (c *kialiCacheImpl) GetServiceEntries(namespace, labelSelector string) ([]*networking_v1beta1.ServiceEntry, error) {
	if !c.CheckIstioResource(kubernetes.ServiceEntries) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.ServiceEntryType)
	}
	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	ses, err := c.getCacheLister(namespace).serviceEntryLister.ServiceEntries(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if ses == nil {
		return []*networking_v1beta1.ServiceEntry{}, nil
	}

	var retSEs []*networking_v1beta1.ServiceEntry
	for _, se := range ses {
		s := se.DeepCopy()
		s.Kind = kubernetes.ServiceEntryType
		retSEs = append(retSEs, s)
	}
	return retSEs, nil
}

func (c *kialiCacheImpl) GetSidecar(namespace, name string) (*networking_v1beta1.Sidecar, error) {
	if !c.CheckIstioResource(kubernetes.Sidecars) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.SidecarType)
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	sc, err := c.getCacheLister(namespace).sidecarLister.Sidecars(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retSC := sc.DeepCopy()
	retSC.Kind = kubernetes.SidecarType
	return retSC, nil
}

func (c *kialiCacheImpl) GetSidecars(namespace, labelSelector string) ([]*networking_v1beta1.Sidecar, error) {
	if !c.CheckIstioResource(kubernetes.Sidecars) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.SidecarType)
	}
	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	sidecars, err := c.getCacheLister(namespace).sidecarLister.Sidecars(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if sidecars == nil {
		return []*networking_v1beta1.Sidecar{}, nil
	}

	var retSC []*networking_v1beta1.Sidecar
	for _, sc := range sidecars {
		s := sc.DeepCopy()
		s.Kind = kubernetes.SidecarType
		retSC = append(retSC, s)
	}
	return retSC, nil
}

func (c *kialiCacheImpl) GetVirtualService(namespace, name string) (*networking_v1beta1.VirtualService, error) {
	if !c.CheckIstioResource(kubernetes.VirtualServices) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.VirtualServiceType)
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	vs, err := c.getCacheLister(namespace).virtualServiceLister.VirtualServices(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retVS := vs.DeepCopy()
	retVS.Kind = kubernetes.VirtualServiceType
	return retVS, nil
}

func (c *kialiCacheImpl) GetVirtualServices(namespace, labelSelector string) ([]*networking_v1beta1.VirtualService, error) {
	if !c.CheckIstioResource(kubernetes.VirtualServices) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.VirtualServiceType)
	}
	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	vs, err := c.getCacheLister(namespace).virtualServiceLister.VirtualServices(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if vs == nil {
		return []*networking_v1beta1.VirtualService{}, nil
	}

	var retVS []*networking_v1beta1.VirtualService
	for _, v := range vs {
		vv := v.DeepCopy()
		vv.Kind = kubernetes.VirtualServiceType
		retVS = append(retVS, vv)
	}
	return retVS, nil
}

func (c *kialiCacheImpl) GetWorkloadEntry(namespace, name string) (*networking_v1beta1.WorkloadEntry, error) {
	if !c.CheckIstioResource(kubernetes.WorkloadEntries) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.WorkloadEntryType)
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	we, err := c.getCacheLister(namespace).workloadEntryLister.WorkloadEntries(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retWE := we.DeepCopy()
	retWE.Kind = kubernetes.WorkloadEntryType
	return retWE, nil
}

func (c *kialiCacheImpl) GetWorkloadEntries(namespace, labelSelector string) ([]*networking_v1beta1.WorkloadEntry, error) {
	if !c.CheckIstioResource(kubernetes.WorkloadEntries) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.WorkloadEntryType)
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	we, err := c.getCacheLister(namespace).workloadEntryLister.WorkloadEntries(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if we == nil {
		return []*networking_v1beta1.WorkloadEntry{}, nil
	}

	var retWE []*networking_v1beta1.WorkloadEntry
	for _, w := range we {
		ww := w.DeepCopy()
		ww.Kind = kubernetes.WorkloadEntryType
		retWE = append(retWE, ww)
	}
	return retWE, nil
}

func (c *kialiCacheImpl) GetWorkloadGroup(namespace, name string) (*networking_v1beta1.WorkloadGroup, error) {
	if !c.CheckIstioResource(kubernetes.WorkloadGroups) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.WorkloadGroupType)
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	wg, err := c.getCacheLister(namespace).workloadGroupLister.WorkloadGroups(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retWG := wg.DeepCopy()
	retWG.Kind = kubernetes.WorkloadGroupType
	return retWG, nil
}

func (c *kialiCacheImpl) GetWorkloadGroups(namespace, labelSelector string) ([]*networking_v1beta1.WorkloadGroup, error) {
	if !c.CheckIstioResource(kubernetes.WorkloadGroups) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.WorkloadGroups)
	}
	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	wg, err := c.getCacheLister(namespace).workloadGroupLister.WorkloadGroups(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if wg == nil {
		return []*networking_v1beta1.WorkloadGroup{}, nil
	}

	var retWG []*networking_v1beta1.WorkloadGroup
	for _, w := range wg {
		ww := w.DeepCopy()
		ww.Kind = kubernetes.WorkloadGroupType
		retWG = append(retWG, ww)
	}
	return retWG, nil
}

func (c *kialiCacheImpl) GetWasmPlugin(namespace, name string) (*extentions_v1alpha1.WasmPlugin, error) {
	if !c.CheckIstioResource(kubernetes.WasmPlugins) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.WasmPluginType)
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	wp, err := c.getCacheLister(namespace).wasmPluginLister.WasmPlugins(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retWP := wp.DeepCopy()
	retWP.Kind = kubernetes.WasmPluginType
	return retWP, nil
}

func (c *kialiCacheImpl) GetWasmPlugins(namespace, labelSelector string) ([]*extentions_v1alpha1.WasmPlugin, error) {
	if !c.CheckIstioResource(kubernetes.WasmPlugins) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.WasmPlugins)
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	wp, err := c.getCacheLister(namespace).wasmPluginLister.WasmPlugins(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if wp == nil {
		return []*extentions_v1alpha1.WasmPlugin{}, nil
	}

	var retWP []*extentions_v1alpha1.WasmPlugin
	for _, w := range wp {
		ww := w.DeepCopy()
		ww.Kind = kubernetes.WasmPluginType
		retWP = append(retWP, ww)
	}
	return retWP, nil
}

func (c *kialiCacheImpl) GetTelemetry(namespace, name string) (*v1alpha1.Telemetry, error) {
	if !c.CheckIstioResource(kubernetes.Telemetries) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.TelemetryType)
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	t, err := c.getCacheLister(namespace).telemetryLister.Telemetries(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retT := t.DeepCopy()
	retT.Kind = kubernetes.TelemetryType
	return retT, nil
}

func (c *kialiCacheImpl) GetTelemetries(namespace, labelSelector string) ([]*v1alpha1.Telemetry, error) {
	if !c.CheckIstioResource(kubernetes.Telemetries) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.Telemetries)
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	t, err := c.getCacheLister(namespace).telemetryLister.Telemetries(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if t == nil {
		return []*v1alpha1.Telemetry{}, nil
	}

	var retT []*v1alpha1.Telemetry
	for _, w := range t {
		tt := w.DeepCopy()
		tt.Kind = kubernetes.TelemetryType
		retT = append(retT, tt)
	}

	return retT, nil
}

func (c *kialiCacheImpl) GetK8sGateway(namespace, name string) (*gatewayapi.Gateway, error) {
	if !c.CheckIstioResource(kubernetes.K8sGateways) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.K8sGatewayType)
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	g, err := c.getCacheLister(namespace).k8sgatewayLister.Gateways(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retG := g.DeepCopy()
	retG.Kind = kubernetes.K8sGatewayType
	return retG, nil
}

func (c *kialiCacheImpl) GetK8sGateways(namespace, labelSelector string) ([]*gatewayapi.Gateway, error) {
	if !c.CheckIstioResource(kubernetes.K8sGateways) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.K8sGateways)
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	g, err := c.getCacheLister(namespace).k8sgatewayLister.Gateways(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if g == nil {
		return []*gatewayapi.Gateway{}, nil
	}

	var retG []*gatewayapi.Gateway
	for _, w := range g {
		gg := w.DeepCopy()
		gg.Kind = kubernetes.K8sGatewayType
		retG = append(retG, gg)
	}

	return retG, nil
}

func (c *kialiCacheImpl) GetK8sHTTPRoute(namespace, name string) (*gatewayapi.HTTPRoute, error) {
	if !c.CheckIstioResource(kubernetes.K8sHTTPRoutes) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.K8sHTTPRouteType)
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	g, err := c.getCacheLister(namespace).k8shttprouteLister.HTTPRoutes(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retG := g.DeepCopy()
	retG.Kind = kubernetes.K8sHTTPRouteType
	return retG, nil
}

func (c *kialiCacheImpl) GetK8sHTTPRoutes(namespace, labelSelector string) ([]*gatewayapi.HTTPRoute, error) {
	if !c.CheckIstioResource(kubernetes.K8sHTTPRoutes) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.K8sHTTPRoutes)
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	r, err := c.getCacheLister(namespace).k8shttprouteLister.HTTPRoutes(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if r == nil {
		return []*gatewayapi.HTTPRoute{}, nil
	}

	var retRoutes []*gatewayapi.HTTPRoute
	for _, w := range r {
		ww := w.DeepCopy()
		ww.Kind = kubernetes.K8sHTTPRouteType
		retRoutes = append(retRoutes, ww)
	}

	return retRoutes, nil
}

func (c *kialiCacheImpl) GetAuthorizationPolicy(namespace, name string) (*security_v1beta1.AuthorizationPolicy, error) {
	if !c.CheckIstioResource(kubernetes.AuthorizationPolicies) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.AuthorizationPoliciesType)
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	ap, err := c.getCacheLister(namespace).authzLister.AuthorizationPolicies(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retAP := ap.DeepCopy()
	retAP.Kind = kubernetes.AuthorizationPoliciesType
	return retAP, nil
}

func (c *kialiCacheImpl) GetAuthorizationPolicies(namespace, labelSelector string) ([]*security_v1beta1.AuthorizationPolicy, error) {
	if !c.CheckIstioResource(kubernetes.AuthorizationPolicies) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.AuthorizationPolicies)
	}
	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	authPolicies, err := c.getCacheLister(namespace).authzLister.AuthorizationPolicies(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if authPolicies == nil {
		return []*security_v1beta1.AuthorizationPolicy{}, nil
	}

	var retAPs []*security_v1beta1.AuthorizationPolicy
	for _, ap := range authPolicies {
		a := ap.DeepCopy()
		a.Kind = kubernetes.AuthorizationPoliciesType
		retAPs = append(retAPs, a)
	}
	return retAPs, nil
}

func (c *kialiCacheImpl) GetPeerAuthentication(namespace, name string) (*security_v1beta1.PeerAuthentication, error) {
	if !c.CheckIstioResource(kubernetes.PeerAuthentications) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.PeerAuthenticationsType)
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	pa, err := c.getCacheLister(namespace).peerAuthnLister.PeerAuthentications(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retPA := pa.DeepCopy()
	retPA.Kind = kubernetes.PeerAuthenticationsType
	return retPA, nil
}

func (c *kialiCacheImpl) GetPeerAuthentications(namespace, labelSelector string) ([]*security_v1beta1.PeerAuthentication, error) {
	if !c.CheckIstioResource(kubernetes.PeerAuthentications) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.PeerAuthenticationsType)
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	peerAuths, err := c.getCacheLister(namespace).peerAuthnLister.PeerAuthentications(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if peerAuths == nil {
		return []*security_v1beta1.PeerAuthentication{}, nil
	}

	var retPAs []*security_v1beta1.PeerAuthentication
	for _, pa := range peerAuths {
		p := pa.DeepCopy()
		p.Kind = kubernetes.PeerAuthenticationsType
		retPAs = append(retPAs, p)
	}
	return retPAs, nil
}

func (c *kialiCacheImpl) GetRequestAuthentication(namespace, name string) (*security_v1beta1.RequestAuthentication, error) {
	if !c.CheckIstioResource(kubernetes.RequestAuthentications) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.RequestAuthentications)
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	ra, err := c.getCacheLister(namespace).requestAuthnLister.RequestAuthentications(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retRA := ra.DeepCopy()
	retRA.Kind = kubernetes.RequestAuthenticationsType
	return retRA, nil
}

func (c *kialiCacheImpl) GetRequestAuthentications(namespace, labelSelector string) ([]*security_v1beta1.RequestAuthentication, error) {
	if !c.CheckIstioResource(kubernetes.RequestAuthentications) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.RequestAuthenticationsType)
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	reqAuths, err := c.getCacheLister(namespace).requestAuthnLister.RequestAuthentications(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if reqAuths == nil {
		return []*security_v1beta1.RequestAuthentication{}, nil
	}

	var retRAs []*security_v1beta1.RequestAuthentication
	for _, ra := range reqAuths {
		r := ra.DeepCopy()
		r.Kind = kubernetes.RequestAuthenticationsType
		retRAs = append(retRAs, r)
	}
	return retRAs, nil
}
