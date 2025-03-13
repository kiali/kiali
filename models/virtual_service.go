package models

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

// IsValidHost returns true if VirtualService hosts applies to the service
func IsVSValidHost(vs *networking_v1.VirtualService, namespace string, serviceName string, conf *config.Config) bool {
	if serviceName == "" {
		return false
	}

	return kubernetes.FilterVirtualServiceByRoute(vs, serviceName, namespace, conf)
}

// HasVSRequestTimeout determines if the spec has an http timeout set.
func HasVSRequestTimeout(vs *networking_v1.VirtualService) bool {
	if vs == nil {
		return false
	}
	for _, httpRoute := range vs.Spec.Http {
		if httpRoute != nil && httpRoute.Timeout != nil {
			return true
		}
	}
	return false
}

// HasFaultInjection determines if the spec has http fault injection set.
func HasVSFaultInjection(vs *networking_v1.VirtualService) bool {
	if vs == nil {
		return false
	}
	for _, route := range vs.Spec.Http {
		if route.Fault != nil {
			return true
		}
	}
	return false
}

// HasTrafficShifting determines if the spec has http traffic shifting set.
// If there are routes with multiple destinations then it is assumed that
// the spec has traffic shifting regardless of weights.
func HasVSTrafficShifting(vs *networking_v1.VirtualService) bool {
	if vs == nil {
		return false
	}
	for _, route := range vs.Spec.Http {
		// If there's only a single destination then there's no weighted split.
		// If there's multiple destinations, it's assumed that there's traffic
		// splitting even if one destination has 100 weight and the rest have 0.
		if len(route.Route) > 1 {
			return true
		}
	}
	return false
}

// HasTCPTrafficShifting determines if the spec has tcp traffic shifting set.
// If there are routes with multiple destinations then it is assumed that
// the spec has traffic shifting regardless of weights.
func HasVSTCPTrafficShifting(vs *networking_v1.VirtualService) bool {
	if vs == nil {
		return false
	}
	for _, route := range vs.Spec.Tcp {
		// If there's only a single destination then there's no weighted split.
		// If there's multiple destinations, it's assumed that there's traffic
		// splitting even if one destination has 100 weight and the rest have 0.
		if len(route.Route) > 1 {
			return true
		}
	}
	return false
}

// IsValidHost returns true if VirtualService hosts applies to the service
func HasVSRequestRouting(vs *networking_v1.VirtualService) bool {
	if vs == nil {
		return false
	}
	for _, tcpRoute := range vs.Spec.Tcp {
		if tcpRoute != nil && len(tcpRoute.Route) > 0 {
			return true
		}
	}
	for _, httpRoute := range vs.Spec.Http {
		if httpRoute != nil && len(httpRoute.Route) > 0 {
			return true
		}
	}
	for _, tlsRoute := range vs.Spec.Tls {
		if tlsRoute != nil && len(tlsRoute.Route) > 0 {
			return true
		}
	}
	return false
}

// HasMirroring determines if the spec has a mirror set.
func HasVSMirroring(vs *networking_v1.VirtualService) bool {
	if vs == nil {
		return false
	}

	for _, route := range vs.Spec.Http {
		if route.Mirror != nil {
			return true
		}
	}

	return false
}
