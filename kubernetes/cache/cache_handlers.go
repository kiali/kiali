package cache

import (
	"reflect"
	"strings"

	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/client-go/tools/cache"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

type RegistryRefreshHandler struct {
	Cache     KialiCache
	Namespace string
	cache.ResourceEventHandler
}

func NewRegistryHandler(cache KialiCache, namespace string) RegistryRefreshHandler {
	log.Infof("Adding a RegistryRefreshHandler for [%s]", namespace)
	return RegistryRefreshHandler{Cache: cache, Namespace: namespace}
}

func (sh RegistryRefreshHandler) OnAdd(obj interface{}) {
	sh.Cache.RefreshRegistryStatus()
}

func (sh RegistryRefreshHandler) OnUpdate(oldObj, newObj interface{}) {
	resourceVersion1, resourceVersion2 := sh.parseResourceVersion(oldObj, newObj)
	if resourceVersion1 != resourceVersion2 {
		sh.Cache.RefreshRegistryStatus()
	}
}

func (sh RegistryRefreshHandler) OnDelete(obj interface{}) {
	sh.Cache.RefreshRegistryStatus()
}

func (sh RegistryRefreshHandler) parseResourceVersion(oldObj, newObj interface{}) (string, string) {
	oldResourceVersion := ""
	newResourceVersion := ""
	if oldObj == nil {
		return oldResourceVersion, newResourceVersion
	}
	oldType := reflect.TypeOf(oldObj).String()
	resourceType := ""
	split := strings.Split(oldType, ".")
	if len(split) == 2 {
		resourceType = split[1]
	}
	switch resourceType {
	case kubernetes.ServiceType:
		oldConv, ok1 := oldObj.(*core_v1.Service)
		newConv, ok2 := newObj.(*core_v1.Service)
		if ok1 && ok2 {
			oldResourceVersion = oldConv.ResourceVersion
			newResourceVersion = newConv.ResourceVersion
		}
	case kubernetes.EndpointsType:
		oldConv, ok1 := oldObj.(*core_v1.Endpoints)
		newConv, ok2 := newObj.(*core_v1.Endpoints)
		if ok1 && ok2 {
			oldResourceVersion = oldConv.ResourceVersion
			newResourceVersion = newConv.ResourceVersion
		}
	case kubernetes.DestinationRuleType:
		oldConv, ok1 := oldObj.(*networking_v1beta1.DestinationRule)
		newConv, ok2 := newObj.(*networking_v1beta1.DestinationRule)
		if ok1 && ok2 {
			oldResourceVersion = oldConv.ResourceVersion
			newResourceVersion = newConv.ResourceVersion
		}
	case kubernetes.EnvoyFilterType:
		oldConv, ok1 := oldObj.(*networking_v1alpha3.EnvoyFilter)
		newConv, ok2 := newObj.(*networking_v1alpha3.EnvoyFilter)
		if ok1 && ok2 {
			oldResourceVersion = oldConv.ResourceVersion
			newResourceVersion = newConv.ResourceVersion
		}
	case kubernetes.GatewayType:
		oldConv, ok1 := oldObj.(*networking_v1beta1.Gateway)
		newConv, ok2 := newObj.(*networking_v1beta1.Gateway)
		if ok1 && ok2 {
			oldResourceVersion = oldConv.ResourceVersion
			newResourceVersion = newConv.ResourceVersion
		}
	case kubernetes.ServiceEntryType:
		oldConv, ok1 := oldObj.(*networking_v1beta1.ServiceEntry)
		newConv, ok2 := newObj.(*networking_v1beta1.ServiceEntry)
		if ok1 && ok2 {
			oldResourceVersion = oldConv.ResourceVersion
			newResourceVersion = newConv.ResourceVersion
		}
	case kubernetes.Sidecars:
		oldConv, ok1 := oldObj.(*networking_v1beta1.Sidecar)
		newConv, ok2 := newObj.(*networking_v1beta1.Sidecar)
		if ok1 && ok2 {
			oldResourceVersion = oldConv.ResourceVersion
			newResourceVersion = newConv.ResourceVersion
		}
	case kubernetes.VirtualServiceType:
		oldConv, ok1 := oldObj.(*networking_v1beta1.VirtualService)
		newConv, ok2 := newObj.(*networking_v1beta1.VirtualService)
		if ok1 && ok2 {
			oldResourceVersion = oldConv.ResourceVersion
			newResourceVersion = newConv.ResourceVersion
		}
	case kubernetes.WorkloadEntryType:
		oldConv, ok1 := oldObj.(*networking_v1beta1.WorkloadEntry)
		newConv, ok2 := newObj.(*networking_v1beta1.WorkloadEntry)
		if ok1 && ok2 {
			oldResourceVersion = oldConv.ResourceVersion
			newResourceVersion = newConv.ResourceVersion
		}
	case kubernetes.WorkloadGroupType:
		oldConv, ok1 := oldObj.(*networking_v1beta1.WorkloadGroup)
		newConv, ok2 := newObj.(*networking_v1beta1.WorkloadGroup)
		if ok1 && ok2 {
			oldResourceVersion = oldConv.ResourceVersion
			newResourceVersion = newConv.ResourceVersion
		}
	case kubernetes.AuthorizationPoliciesType:
		oldConv, ok1 := oldObj.(*security_v1beta1.AuthorizationPolicy)
		newConv, ok2 := newObj.(*security_v1beta1.AuthorizationPolicy)
		if ok1 && ok2 {
			oldResourceVersion = oldConv.ResourceVersion
			newResourceVersion = newConv.ResourceVersion
		}
	case kubernetes.PeerAuthenticationsType:
		oldConv, ok1 := oldObj.(*security_v1beta1.PeerAuthentication)
		newConv, ok2 := newObj.(*security_v1beta1.PeerAuthentication)
		if ok1 && ok2 {
			oldResourceVersion = oldConv.ResourceVersion
			newResourceVersion = newConv.ResourceVersion
		}
	case kubernetes.RequestAuthenticationsType:
		oldConv, ok1 := oldObj.(*security_v1beta1.RequestAuthentication)
		newConv, ok2 := newObj.(*security_v1beta1.RequestAuthentication)
		if ok1 && ok2 {
			oldResourceVersion = oldConv.ResourceVersion
			newResourceVersion = newConv.ResourceVersion
		}
	}
	return oldResourceVersion, newResourceVersion
}
