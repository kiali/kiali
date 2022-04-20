package cache

import (
	"errors"
	"fmt"

	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"
	istio "istio.io/client-go/pkg/informers/externalversions"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

type (
	IstioCache interface {
		CheckIstioResource(resourceType string) bool

		GetDestinationRule(namespace, name string) (*networking_v1beta1.DestinationRule, error)
		GetDestinationRules(namespace, labelSelector string) ([]networking_v1beta1.DestinationRule, error)
		GetEnvoyFilter(namespace, name string) (*networking_v1alpha3.EnvoyFilter, error)
		GetEnvoyFilters(namespace, labelSelector string) ([]networking_v1alpha3.EnvoyFilter, error)
		GetGateway(namespace, name string) (*networking_v1beta1.Gateway, error)
		GetGateways(namespace, labelSelector string) ([]networking_v1beta1.Gateway, error)
		GetServiceEntry(namespace, name string) (*networking_v1beta1.ServiceEntry, error)
		GetServiceEntries(namespace, labelSelector string) ([]networking_v1beta1.ServiceEntry, error)
		GetSidecar(namespace, name string) (*networking_v1beta1.Sidecar, error)
		GetSidecars(namespace, labelSelector string) ([]networking_v1beta1.Sidecar, error)
		GetVirtualService(namespace, name string) (*networking_v1beta1.VirtualService, error)
		GetVirtualServices(namespace, labelSelector string) ([]networking_v1beta1.VirtualService, error)
		GetWorkloadEntry(namespace, name string) (*networking_v1beta1.WorkloadEntry, error)
		GetWorkloadEntries(namespace, labelSelector string) ([]networking_v1beta1.WorkloadEntry, error)
		GetWorkloadGroup(namespace, name string) (*networking_v1beta1.WorkloadGroup, error)
		GetWorkloadGroups(namespace, labelSelector string) ([]networking_v1beta1.WorkloadGroup, error)

		GetAuthorizationPolicy(namespace, name string) (*security_v1beta1.AuthorizationPolicy, error)
		GetAuthorizationPolicies(namespace, labelSelector string) ([]security_v1beta1.AuthorizationPolicy, error)
		GetPeerAuthentication(namespace, name string) (*security_v1beta1.PeerAuthentication, error)
		GetPeerAuthentications(namespace, labelSelector string) ([]security_v1beta1.PeerAuthentication, error)
		GetRequestAuthentication(namespace, name string) (*security_v1beta1.RequestAuthentication, error)
		GetRequestAuthentications(namespace, labelSelector string) ([]security_v1beta1.RequestAuthentication, error)
	}
)

func (c *kialiCacheImpl) CheckIstioResource(resourceType string) bool {
	// cacheIstioTypes stores the single types but for compatibility with kubernetes api resourceType will use plurals
	_, exist := c.cacheIstioTypes[kubernetes.PluralType[resourceType]]
	return exist
}

func (c *kialiCacheImpl) createIstioInformers(namespace string, informer *typeCache) {
	sharedInformers := istio.NewSharedInformerFactoryWithOptions(c.istioApi, c.refreshDuration, istio.WithNamespace(namespace))
	if c.CheckIstioResource(kubernetes.DestinationRules) {
		(*informer)[kubernetes.DestinationRuleType] = sharedInformers.Networking().V1beta1().DestinationRules().Informer()
		(*informer)[kubernetes.DestinationRuleType].AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.EnvoyFilters) {
		(*informer)[kubernetes.EnvoyFilterType] = sharedInformers.Networking().V1alpha3().EnvoyFilters().Informer()
		(*informer)[kubernetes.EnvoyFilterType].AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.Gateways) {
		(*informer)[kubernetes.GatewayType] = sharedInformers.Networking().V1beta1().Gateways().Informer()
		(*informer)[kubernetes.GatewayType].AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.ServiceEntries) {
		(*informer)[kubernetes.ServiceEntryType] = sharedInformers.Networking().V1beta1().ServiceEntries().Informer()
		(*informer)[kubernetes.ServiceEntryType].AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.Sidecars) {
		(*informer)[kubernetes.SidecarType] = sharedInformers.Networking().V1beta1().Sidecars().Informer()
		(*informer)[kubernetes.SidecarType].AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.VirtualServices) {
		(*informer)[kubernetes.VirtualServiceType] = sharedInformers.Networking().V1beta1().VirtualServices().Informer()
		(*informer)[kubernetes.VirtualServiceType].AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.WorkloadEntries) {
		(*informer)[kubernetes.WorkloadEntryType] = sharedInformers.Networking().V1beta1().WorkloadEntries().Informer()
		(*informer)[kubernetes.WorkloadEntryType].AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.WorkloadGroups) {
		(*informer)[kubernetes.WorkloadGroupType] = sharedInformers.Networking().V1beta1().WorkloadGroups().Informer()
		(*informer)[kubernetes.WorkloadGroupType].AddEventHandler(c.registryRefreshHandler)
	}

	if c.CheckIstioResource(kubernetes.AuthorizationPolicies) {
		(*informer)[kubernetes.AuthorizationPoliciesType] = sharedInformers.Security().V1beta1().AuthorizationPolicies().Informer()
		(*informer)[kubernetes.AuthorizationPoliciesType].AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.PeerAuthentications) {
		(*informer)[kubernetes.PeerAuthenticationsType] = sharedInformers.Security().V1beta1().PeerAuthentications().Informer()
		(*informer)[kubernetes.PeerAuthenticationsType].AddEventHandler(c.registryRefreshHandler)
	}
	if c.CheckIstioResource(kubernetes.RequestAuthentications) {
		(*informer)[kubernetes.RequestAuthenticationsType] = sharedInformers.Security().V1beta1().RequestAuthentications().Informer()
		(*informer)[kubernetes.RequestAuthenticationsType].AddEventHandler(c.registryRefreshHandler)
	}
}

func (c *kialiCacheImpl) isIstioSynced(namespace string) bool {
	var isSynced bool
	if nsCache, exist := c.nsCache[namespace]; exist {
		isSynced = true
		if c.CheckIstioResource(kubernetes.DestinationRules) {
			isSynced = isSynced && nsCache[kubernetes.DestinationRuleType].HasSynced()
		}
		if c.CheckIstioResource(kubernetes.EnvoyFilters) {
			isSynced = isSynced && nsCache[kubernetes.EnvoyFilterType].HasSynced()
		}
		if c.CheckIstioResource(kubernetes.Gateways) {
			isSynced = isSynced && nsCache[kubernetes.GatewayType].HasSynced()
		}
		if c.CheckIstioResource(kubernetes.ServiceEntries) {
			isSynced = isSynced && nsCache[kubernetes.ServiceEntryType].HasSynced()
		}
		if c.CheckIstioResource(kubernetes.Sidecars) {
			isSynced = isSynced && nsCache[kubernetes.SidecarType].HasSynced()
		}
		if c.CheckIstioResource(kubernetes.VirtualServices) {
			isSynced = isSynced && nsCache[kubernetes.VirtualServiceType].HasSynced()
		}
		if c.CheckIstioResource(kubernetes.WorkloadGroups) {
			isSynced = isSynced && nsCache[kubernetes.WorkloadGroupType].HasSynced()
		}
		if c.CheckIstioResource(kubernetes.WorkloadEntries) {
			isSynced = isSynced && nsCache[kubernetes.WorkloadEntryType].HasSynced()
		}

		if c.CheckIstioResource(kubernetes.AuthorizationPolicies) {
			isSynced = isSynced && nsCache[kubernetes.AuthorizationPoliciesType].HasSynced()
		}
		if c.CheckIstioResource(kubernetes.PeerAuthentications) {
			isSynced = isSynced && nsCache[kubernetes.PeerAuthenticationsType].HasSynced()
		}
		if c.CheckIstioResource(kubernetes.RequestAuthentications) {
			isSynced = isSynced && nsCache[kubernetes.RequestAuthenticationsType].HasSynced()
		}
	} else {
		isSynced = false
	}
	return isSynced
}

func (c *kialiCacheImpl) GetDestinationRule(namespace, name string) (*networking_v1beta1.DestinationRule, error) {
	if !c.CheckIstioResource(kubernetes.DestinationRules) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.DestinationRuleType)
	}
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.DestinationRuleType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			l, ok := obj.(*networking_v1beta1.DestinationRule)
			if !ok {
				return nil, errors.New("bad DestinationRule type found in cache")
			}
			// Informers don't always populate Kind field
			l.Kind = kubernetes.DestinationRuleType
			log.Tracef("[Kiali Cache] Get [resource: DestinationRule] for [namespace: %s] [name: %s]", namespace, name)
			return l, nil
		}
	}
	return nil, nil
}

func (c *kialiCacheImpl) GetDestinationRules(namespace, labelSelector string) ([]networking_v1beta1.DestinationRule, error) {
	if !c.CheckIstioResource(kubernetes.DestinationRules) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.DestinationRuleType)
	}
	if nsCache, nsOk := c.nsCache[namespace]; nsOk {
		l := nsCache[kubernetes.DestinationRuleType].GetStore().List()
		lenL := len(l)
		if lenL > 0 {
			_, ok := l[0].(*networking_v1beta1.DestinationRule)
			if !ok {
				return []networking_v1beta1.DestinationRule{}, errors.New("bad DestinationRule type found in cache")
			}
			nsL := make([]networking_v1beta1.DestinationRule, lenL)
			for i, li := range l {
				nsL[i] = *(li.(*networking_v1beta1.DestinationRule))
				// Informers don't always populate Kind field
				nsL[i].Kind = kubernetes.DestinationRuleType
			}
			log.Tracef("[Kiali Cache] Get [resource: DestinationRule] for [namespace: %s] = %d", namespace, lenL)
			if labelSelector == "" {
				return nsL, nil
			}
			var filteredL []networking_v1beta1.DestinationRule
			selector, selErr := labels.Parse(labelSelector)
			if selErr != nil {
				return []networking_v1beta1.DestinationRule{}, fmt.Errorf("%s can not be processed as selector: %v", labelSelector, selErr)
			}
			for _, li := range nsL {
				if selector.Matches(labels.Set(li.Labels)) {
					filteredL = append(filteredL, li)
				}
			}
			return filteredL, nil
		}
	}
	return []networking_v1beta1.DestinationRule{}, nil
}

func (c *kialiCacheImpl) GetEnvoyFilter(namespace, name string) (*networking_v1alpha3.EnvoyFilter, error) {
	if !c.CheckIstioResource(kubernetes.EnvoyFilters) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.EnvoyFilterType)
	}
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.EnvoyFilterType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			l, ok := obj.(*networking_v1alpha3.EnvoyFilter)
			if !ok {
				return nil, errors.New("bad EnvoyFilter type found in cache")
			}
			l.Kind = kubernetes.EnvoyFilterType
			log.Tracef("[Kiali Cache] Get [resource: EnvoyFilter] for [namespace: %s] [name: %s]", namespace, name)
			return l, nil
		}
	}
	return nil, nil
}

func (c *kialiCacheImpl) GetEnvoyFilters(namespace, labelSelector string) ([]networking_v1alpha3.EnvoyFilter, error) {
	if !c.CheckIstioResource(kubernetes.EnvoyFilters) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.EnvoyFilterType)
	}
	if nsCache, nsOk := c.nsCache[namespace]; nsOk {
		l := nsCache[kubernetes.EnvoyFilterType].GetStore().List()
		lenL := len(l)
		if lenL > 0 {
			_, ok := l[0].(*networking_v1alpha3.EnvoyFilter)
			if !ok {
				return []networking_v1alpha3.EnvoyFilter{}, errors.New("bad EnvoyFilter type found in cache")
			}
			nsL := make([]networking_v1alpha3.EnvoyFilter, lenL)
			for i, li := range l {
				nsL[i] = *(li.(*networking_v1alpha3.EnvoyFilter))
				nsL[i].Kind = kubernetes.EnvoyFilterType
			}
			log.Tracef("[Kiali Cache] Get [resource: EnvoyFilter] for [namespace: %s] = %d", namespace, lenL)
			if labelSelector == "" {
				return nsL, nil
			}
			var filteredL []networking_v1alpha3.EnvoyFilter
			selector, selErr := labels.Parse(labelSelector)
			if selErr != nil {
				return []networking_v1alpha3.EnvoyFilter{}, fmt.Errorf("%s can not be processed as selector: %v", labelSelector, selErr)
			}
			for _, li := range nsL {
				if selector.Matches(labels.Set(li.Labels)) {
					filteredL = append(filteredL, li)
				}
			}
			return filteredL, nil
		}
	}
	return []networking_v1alpha3.EnvoyFilter{}, nil
}

func (c *kialiCacheImpl) GetGateway(namespace, name string) (*networking_v1beta1.Gateway, error) {
	if !c.CheckIstioResource(kubernetes.Gateways) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.GatewayType)
	}
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.GatewayType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			l, ok := obj.(*networking_v1beta1.Gateway)
			if !ok {
				return nil, errors.New("bad Gateway type found in cache")
			}
			l.Kind = kubernetes.GatewayType
			log.Tracef("[Kiali Cache] Get [resource: Gateway] for [namespace: %s] [name: %s]", namespace, name)
			return l, nil
		}
	}
	return nil, nil
}

func (c *kialiCacheImpl) GetGateways(namespace, labelSelector string) ([]networking_v1beta1.Gateway, error) {
	if !c.CheckIstioResource(kubernetes.Gateways) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.Gateways)
	}
	if nsCache, nsOk := c.nsCache[namespace]; nsOk {
		l := nsCache[kubernetes.GatewayType].GetStore().List()
		lenL := len(l)
		if lenL > 0 {
			_, ok := l[0].(*networking_v1beta1.Gateway)
			if !ok {
				return []networking_v1beta1.Gateway{}, errors.New("bad Gateway type found in cache")
			}
			nsL := make([]networking_v1beta1.Gateway, lenL)
			for i, li := range l {
				nsL[i] = *(li.(*networking_v1beta1.Gateway))
				nsL[i].Kind = kubernetes.GatewayType
			}
			log.Tracef("[Kiali Cache] Get [resource: Gateway] for [namespace: %s] = %d", namespace, lenL)
			if labelSelector == "" {
				return nsL, nil
			}
			var filteredL []networking_v1beta1.Gateway
			selector, selErr := labels.Parse(labelSelector)
			if selErr != nil {
				return []networking_v1beta1.Gateway{}, fmt.Errorf("%s can not be processed as selector: %v", labelSelector, selErr)
			}
			for _, li := range nsL {
				if selector.Matches(labels.Set(li.Labels)) {
					filteredL = append(filteredL, li)
				}
			}
			return filteredL, nil
		}
	}
	return []networking_v1beta1.Gateway{}, nil
}

func (c *kialiCacheImpl) GetServiceEntry(namespace, name string) (*networking_v1beta1.ServiceEntry, error) {
	if !c.CheckIstioResource(kubernetes.ServiceEntries) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.ServiceEntryType)
	}
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.ServiceEntryType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			l, ok := obj.(*networking_v1beta1.ServiceEntry)
			if !ok {
				return nil, errors.New("bad ServiceEntry type found in cache")
			}
			l.Kind = kubernetes.ServiceEntryType
			log.Tracef("[Kiali Cache] Get [resource: ServiceEntry] for [namespace: %s] [name: %s]", namespace, name)
			return l, nil
		}
	}
	return nil, nil
}

func (c *kialiCacheImpl) GetServiceEntries(namespace, labelSelector string) ([]networking_v1beta1.ServiceEntry, error) {
	if !c.CheckIstioResource(kubernetes.ServiceEntries) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.ServiceEntryType)
	}
	if nsCache, nsOk := c.nsCache[namespace]; nsOk {
		l := nsCache[kubernetes.ServiceEntryType].GetStore().List()
		lenL := len(l)
		if lenL > 0 {
			_, ok := l[0].(*networking_v1beta1.ServiceEntry)
			if !ok {
				return []networking_v1beta1.ServiceEntry{}, errors.New("bad ServiceEntry type found in cache")
			}
			nsL := make([]networking_v1beta1.ServiceEntry, lenL)
			for i, li := range l {
				nsL[i] = *(li.(*networking_v1beta1.ServiceEntry))
				nsL[i].Kind = kubernetes.ServiceEntryType
			}
			log.Tracef("[Kiali Cache] Get [resource: ServiceEntry] for [namespace: %s] = %d", namespace, lenL)
			if labelSelector == "" {
				return nsL, nil
			}
			var filteredL []networking_v1beta1.ServiceEntry
			selector, selErr := labels.Parse(labelSelector)
			if selErr != nil {
				return []networking_v1beta1.ServiceEntry{}, fmt.Errorf("%s can not be processed as selector: %v", labelSelector, selErr)
			}
			for _, li := range nsL {
				if selector.Matches(labels.Set(li.Labels)) {
					filteredL = append(filteredL, li)
				}
			}
			return filteredL, nil
		}
	}
	return []networking_v1beta1.ServiceEntry{}, nil
}

func (c *kialiCacheImpl) GetSidecar(namespace, name string) (*networking_v1beta1.Sidecar, error) {
	if !c.CheckIstioResource(kubernetes.Sidecars) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.SidecarType)
	}
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.SidecarType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			l, ok := obj.(*networking_v1beta1.Sidecar)
			if !ok {
				return nil, errors.New("bad Sidecar type found in cache")
			}
			l.Kind = kubernetes.SidecarType
			log.Tracef("[Kiali Cache] Get [resource: Sidecar] for [namespace: %s] [name: %s]", namespace, name)
			return l, nil
		}
	}
	return nil, nil
}

func (c *kialiCacheImpl) GetSidecars(namespace, labelSelector string) ([]networking_v1beta1.Sidecar, error) {
	if !c.CheckIstioResource(kubernetes.Sidecars) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.SidecarType)
	}
	if nsCache, nsOk := c.nsCache[namespace]; nsOk {
		l := nsCache[kubernetes.SidecarType].GetStore().List()
		lenL := len(l)
		if lenL > 0 {
			_, ok := l[0].(*networking_v1beta1.Sidecar)
			if !ok {
				return []networking_v1beta1.Sidecar{}, errors.New("bad Sidecar type found in cache")
			}
			nsL := make([]networking_v1beta1.Sidecar, lenL)
			for i, li := range l {
				nsL[i] = *(li.(*networking_v1beta1.Sidecar))
				nsL[i].Kind = kubernetes.SidecarType
			}
			log.Tracef("[Kiali Cache] Get [resource: Sidecar] for [namespace: %s] = %d", namespace, lenL)
			if labelSelector == "" {
				return nsL, nil
			}
			var filteredL []networking_v1beta1.Sidecar
			selector, selErr := labels.Parse(labelSelector)
			if selErr != nil {
				return []networking_v1beta1.Sidecar{}, fmt.Errorf("%s can not be processed as selector: %v", labelSelector, selErr)
			}
			for _, li := range nsL {
				if selector.Matches(labels.Set(li.Labels)) {
					filteredL = append(filteredL, li)
				}
			}
			return filteredL, nil
		}
	}
	return []networking_v1beta1.Sidecar{}, nil
}

func (c *kialiCacheImpl) GetVirtualService(namespace, name string) (*networking_v1beta1.VirtualService, error) {
	if !c.CheckIstioResource(kubernetes.VirtualServices) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.VirtualServiceType)
	}
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.VirtualServiceType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			l, ok := obj.(*networking_v1beta1.VirtualService)
			if !ok {
				return nil, errors.New("bad VirtualService type found in cache")
			}
			l.Kind = kubernetes.VirtualServiceType
			log.Tracef("[Kiali Cache] Get [resource: VirtualService] for [namespace: %s] [name: %s]", namespace, name)
			return l, nil
		}
	}
	return nil, nil
}

func (c *kialiCacheImpl) GetVirtualServices(namespace, labelSelector string) ([]networking_v1beta1.VirtualService, error) {
	if !c.CheckIstioResource(kubernetes.VirtualServices) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.VirtualServiceType)
	}
	if nsCache, nsOk := c.nsCache[namespace]; nsOk {
		l := nsCache[kubernetes.VirtualServiceType].GetStore().List()
		lenL := len(l)
		if lenL > 0 {
			_, ok := l[0].(*networking_v1beta1.VirtualService)
			if !ok {
				return []networking_v1beta1.VirtualService{}, errors.New("bad VirtualService type found in cache")
			}
			nsL := make([]networking_v1beta1.VirtualService, lenL)
			for i, li := range l {
				nsL[i] = *(li.(*networking_v1beta1.VirtualService))
				nsL[i].Kind = kubernetes.VirtualServiceType
			}
			log.Tracef("[Kiali Cache] Get [resource: VirtualService] for [namespace: %s] = %d", namespace, lenL)
			if labelSelector == "" {
				return nsL, nil
			}
			var filteredL []networking_v1beta1.VirtualService
			selector, selErr := labels.Parse(labelSelector)
			if selErr != nil {
				return []networking_v1beta1.VirtualService{}, fmt.Errorf("%s can not be processed as selector: %v", labelSelector, selErr)
			}
			for _, li := range nsL {
				if selector.Matches(labels.Set(li.Labels)) {
					filteredL = append(filteredL, li)
				}
			}
			return filteredL, nil
		}
	}
	return []networking_v1beta1.VirtualService{}, nil
}

func (c *kialiCacheImpl) GetWorkloadEntry(namespace, name string) (*networking_v1beta1.WorkloadEntry, error) {
	if !c.CheckIstioResource(kubernetes.WorkloadEntries) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.WorkloadEntryType)
	}
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.WorkloadEntryType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			l, ok := obj.(*networking_v1beta1.WorkloadEntry)
			if !ok {
				return nil, errors.New("bad WorkloadEntry type found in cache")
			}
			l.Kind = kubernetes.WorkloadEntryType
			log.Tracef("[Kiali Cache] Get [resource: WorkloadEntry] for [namespace: %s] [name: %s]", namespace, name)
			return l, nil
		}
	}
	return nil, nil
}

func (c *kialiCacheImpl) GetWorkloadEntries(namespace, labelSelector string) ([]networking_v1beta1.WorkloadEntry, error) {
	if !c.CheckIstioResource(kubernetes.WorkloadEntries) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.WorkloadEntryType)
	}
	if nsCache, nsOk := c.nsCache[namespace]; nsOk {
		l := nsCache[kubernetes.WorkloadEntryType].GetStore().List()
		lenL := len(l)
		if lenL > 0 {
			_, ok := l[0].(*networking_v1beta1.WorkloadEntry)
			if !ok {
				return []networking_v1beta1.WorkloadEntry{}, errors.New("bad WorkloadEntry type found in cache")
			}
			nsL := make([]networking_v1beta1.WorkloadEntry, lenL)
			for i, li := range l {
				nsL[i] = *(li.(*networking_v1beta1.WorkloadEntry))
				nsL[i].Kind = kubernetes.WorkloadEntryType
			}
			log.Tracef("[Kiali Cache] Get [resource: WorkloadEntry] for [namespace: %s] = %d", namespace, lenL)
			if labelSelector == "" {
				return nsL, nil
			}
			var filteredL []networking_v1beta1.WorkloadEntry
			selector, selErr := labels.Parse(labelSelector)
			if selErr != nil {
				return []networking_v1beta1.WorkloadEntry{}, fmt.Errorf("%s can not be processed as selector: %v", labelSelector, selErr)
			}
			for _, li := range nsL {
				if selector.Matches(labels.Set(li.Labels)) {
					filteredL = append(filteredL, li)
				}
			}
			return filteredL, nil
		}
	}
	return []networking_v1beta1.WorkloadEntry{}, nil
}

func (c *kialiCacheImpl) GetWorkloadGroup(namespace, name string) (*networking_v1beta1.WorkloadGroup, error) {
	if !c.CheckIstioResource(kubernetes.WorkloadGroups) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.WorkloadGroupType)
	}
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.WorkloadGroupType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			l, ok := obj.(*networking_v1beta1.WorkloadGroup)
			if !ok {
				return nil, errors.New("bad WorkloadGroup type found in cache")
			}
			l.Kind = kubernetes.WorkloadGroupType
			log.Tracef("[Kiali Cache] Get [resource: WorkloadGroup] for [namespace: %s] [name: %s]", namespace, name)
			return l, nil
		}
	}
	return nil, nil
}

func (c *kialiCacheImpl) GetWorkloadGroups(namespace, labelSelector string) ([]networking_v1beta1.WorkloadGroup, error) {
	if !c.CheckIstioResource(kubernetes.WorkloadGroups) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.WorkloadGroups)
	}
	if nsCache, nsOk := c.nsCache[namespace]; nsOk {
		l := nsCache[kubernetes.WorkloadGroupType].GetStore().List()
		lenL := len(l)
		if lenL > 0 {
			_, ok := l[0].(*networking_v1beta1.WorkloadGroup)
			if !ok {
				return []networking_v1beta1.WorkloadGroup{}, errors.New("bad WorkloadGroup type found in cache")
			}
			nsL := make([]networking_v1beta1.WorkloadGroup, lenL)
			for i, li := range l {
				nsL[i] = *(li.(*networking_v1beta1.WorkloadGroup))
				nsL[i].Kind = kubernetes.WorkloadGroupType
			}
			log.Tracef("[Kiali Cache] Get [resource: WorkloadGroup] for [namespace: %s] = %d", namespace, lenL)
			if labelSelector == "" {
				return nsL, nil
			}
			var filteredL []networking_v1beta1.WorkloadGroup
			selector, selErr := labels.Parse(labelSelector)
			if selErr != nil {
				return []networking_v1beta1.WorkloadGroup{}, fmt.Errorf("%s can not be processed as selector: %v", labelSelector, selErr)
			}
			for _, li := range nsL {
				if selector.Matches(labels.Set(li.Labels)) {
					filteredL = append(filteredL, li)
				}
			}
			return filteredL, nil
		}
	}
	return []networking_v1beta1.WorkloadGroup{}, nil
}

func (c *kialiCacheImpl) GetAuthorizationPolicy(namespace, name string) (*security_v1beta1.AuthorizationPolicy, error) {
	if !c.CheckIstioResource(kubernetes.AuthorizationPolicies) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.AuthorizationPoliciesType)
	}
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.AuthorizationPoliciesType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			l, ok := obj.(*security_v1beta1.AuthorizationPolicy)
			if !ok {
				return nil, errors.New("bad AuthorizationPolicy type found in cache")
			}
			l.Kind = kubernetes.AuthorizationPoliciesType
			log.Tracef("[Kiali Cache] Get [resource: AuthorizationPolicy] for [namespace: %s] [name: %s]", namespace, name)
			return l, nil
		}
	}
	return nil, nil
}

func (c *kialiCacheImpl) GetAuthorizationPolicies(namespace, labelSelector string) ([]security_v1beta1.AuthorizationPolicy, error) {
	if !c.CheckIstioResource(kubernetes.AuthorizationPolicies) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.AuthorizationPolicies)
	}
	if nsCache, nsOk := c.nsCache[namespace]; nsOk {
		l := nsCache[kubernetes.AuthorizationPoliciesType].GetStore().List()
		lenL := len(l)
		if lenL > 0 {
			_, ok := l[0].(*security_v1beta1.AuthorizationPolicy)
			if !ok {
				return []security_v1beta1.AuthorizationPolicy{}, errors.New("bad AuthorizationPolicy type found in cache")
			}
			nsL := make([]security_v1beta1.AuthorizationPolicy, lenL)
			for i, li := range l {
				nsL[i] = *(li.(*security_v1beta1.AuthorizationPolicy))
				nsL[i].Kind = kubernetes.AuthorizationPoliciesType
			}
			log.Tracef("[Kiali Cache] Get [resource: AuthorizationPolicy] for [namespace: %s] = %d", namespace, lenL)
			if labelSelector == "" {
				return nsL, nil
			}
			var filteredL []security_v1beta1.AuthorizationPolicy
			selector, selErr := labels.Parse(labelSelector)
			if selErr != nil {
				return []security_v1beta1.AuthorizationPolicy{}, fmt.Errorf("%s can not be processed as selector: %v", labelSelector, selErr)
			}
			for _, li := range nsL {
				if selector.Matches(labels.Set(li.Labels)) {
					filteredL = append(filteredL, li)
				}
			}
			return filteredL, nil
		}
	}
	return []security_v1beta1.AuthorizationPolicy{}, nil
}

func (c *kialiCacheImpl) GetPeerAuthentication(namespace, name string) (*security_v1beta1.PeerAuthentication, error) {
	if !c.CheckIstioResource(kubernetes.PeerAuthentications) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.PeerAuthenticationsType)
	}
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.PeerAuthenticationsType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			l, ok := obj.(*security_v1beta1.PeerAuthentication)
			if !ok {
				return nil, errors.New("bad PeerAuthentication type found in cache")
			}
			l.Kind = kubernetes.PeerAuthenticationsType
			log.Tracef("[Kiali Cache] Get [resource: PeerAuthentication] for [namespace: %s] [name: %s]", namespace, name)
			return l, nil
		}
	}
	return nil, nil
}

func (c *kialiCacheImpl) GetPeerAuthentications(namespace, labelSelector string) ([]security_v1beta1.PeerAuthentication, error) {
	if !c.CheckIstioResource(kubernetes.PeerAuthentications) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.PeerAuthenticationsType)
	}
	if nsCache, nsOk := c.nsCache[namespace]; nsOk {
		l := nsCache[kubernetes.PeerAuthenticationsType].GetStore().List()
		lenL := len(l)
		if lenL > 0 {
			_, ok := l[0].(*security_v1beta1.PeerAuthentication)
			if !ok {
				return []security_v1beta1.PeerAuthentication{}, errors.New("bad PeerAuthentication type found in cache")
			}
			nsL := make([]security_v1beta1.PeerAuthentication, lenL)
			for i, li := range l {
				nsL[i] = *(li.(*security_v1beta1.PeerAuthentication))
				nsL[i].Kind = kubernetes.PeerAuthenticationsType
			}
			log.Tracef("[Kiali Cache] Get [resource: PeerAuthentication] for [namespace: %s] = %d", namespace, lenL)
			if labelSelector == "" {
				return nsL, nil
			}
			var filteredL []security_v1beta1.PeerAuthentication
			selector, selErr := labels.Parse(labelSelector)
			if selErr != nil {
				return []security_v1beta1.PeerAuthentication{}, fmt.Errorf("%s can not be processed as selector: %v", labelSelector, selErr)
			}
			for _, li := range nsL {
				if selector.Matches(labels.Set(li.Labels)) {
					filteredL = append(filteredL, li)
				}
			}
			return filteredL, nil
		}
	}
	return []security_v1beta1.PeerAuthentication{}, nil
}

func (c *kialiCacheImpl) GetRequestAuthentication(namespace, name string) (*security_v1beta1.RequestAuthentication, error) {
	if !c.CheckIstioResource(kubernetes.RequestAuthentications) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.RequestAuthentications)
	}
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.RequestAuthenticationsType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			l, ok := obj.(*security_v1beta1.RequestAuthentication)
			if !ok {
				return nil, errors.New("bad RequestAuthentication type found in cache")
			}
			l.Kind = kubernetes.RequestAuthenticationsType
			log.Tracef("[Kiali Cache] Get [resource: RequestAuthentication] for [namespace: %s] [name: %s]", namespace, name)
			return l, nil
		}
	}
	return nil, nil
}

func (c *kialiCacheImpl) GetRequestAuthentications(namespace, labelSelector string) ([]security_v1beta1.RequestAuthentication, error) {
	if !c.CheckIstioResource(kubernetes.RequestAuthentications) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", kubernetes.RequestAuthenticationsType)
	}
	if nsCache, nsOk := c.nsCache[namespace]; nsOk {
		l := nsCache[kubernetes.RequestAuthenticationsType].GetStore().List()
		lenL := len(l)
		if lenL > 0 {
			_, ok := l[0].(*security_v1beta1.RequestAuthentication)
			if !ok {
				return []security_v1beta1.RequestAuthentication{}, errors.New("bad RequestAuthentication type found in cache")
			}
			nsL := make([]security_v1beta1.RequestAuthentication, lenL)
			for i, li := range l {
				nsL[i] = *(li.(*security_v1beta1.RequestAuthentication))
				nsL[i].Kind = kubernetes.RequestAuthenticationsType
			}
			log.Tracef("[Kiali Cache] Get [resource: RequestAuthentication] for [namespace: %s] = %d", namespace, lenL)
			if labelSelector == "" {
				return nsL, nil
			}
			var filteredL []security_v1beta1.RequestAuthentication
			selector, selErr := labels.Parse(labelSelector)
			if selErr != nil {
				return []security_v1beta1.RequestAuthentication{}, fmt.Errorf("%s can not be processed as selector: %v", labelSelector, selErr)
			}
			for _, li := range nsL {
				if selector.Matches(labels.Set(li.Labels)) {
					filteredL = append(filteredL, li)
				}
			}
			return filteredL, nil
		}
	}
	return []security_v1beta1.RequestAuthentication{}, nil
}
