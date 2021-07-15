package models

import (
	"github.com/kiali/kiali/kubernetes"
)

// VirtualServices virtualServices
//
// This type is used for returning an array of VirtualServices with some permission flags
//
// swagger:model virtualServices
// An array of virtualService
// swagger:allOf
type VirtualServices struct {
	Permissions ResourcePermissions `json:"permissions"`
	Items       []VirtualService    `json:"items"`
}

// VirtualService virtualService
//
// This type is used for returning a VirtualService
//
// swagger:model virtualService
type VirtualService struct {
	IstioBase
	Spec struct {
		Hosts    interface{} `json:"hosts,omitempty"`
		Gateways interface{} `json:"gateways,omitempty"`
		Http     interface{} `json:"http,omitempty"`
		Tcp      interface{} `json:"tcp,omitempty"`
		Tls      interface{} `json:"tls,omitempty"`
		ExportTo interface{} `json:"exportTo,omitempty"`
	} `json:"spec"`
}

func (vServices *VirtualServices) Parse(virtualServices []kubernetes.IstioObject) {
	vServices.Items = []VirtualService{}
	for _, vs := range virtualServices {
		virtualService := VirtualService{}
		virtualService.Parse(vs)
		vServices.Items = append(vServices.Items, virtualService)
	}
}

func (vService *VirtualService) Parse(virtualService kubernetes.IstioObject) {
	vService.IstioBase.Parse(virtualService)
	vService.Spec.Hosts = virtualService.GetSpec()["hosts"]
	vService.Spec.Gateways = virtualService.GetSpec()["gateways"]
	vService.Spec.Http = virtualService.GetSpec()["http"]
	vService.Spec.Tls = virtualService.GetSpec()["tls"]
	vService.Spec.Tcp = virtualService.GetSpec()["tcp"]
	vService.Spec.ExportTo = virtualService.GetSpec()["exportTo"]
}

// IsValidHost returns true if VirtualService hosts applies to the service
func (vService *VirtualService) IsValidHost(namespace string, serviceName string) bool {
	if serviceName == "" {
		return false
	}

	protocolNames := []string{"http", "tls", "tcp"} // ordered by matching preference
	protocols := map[string]interface{}{
		"http": vService.Spec.Http,
		"tls":  vService.Spec.Tls,
		"tcp":  vService.Spec.Tcp,
	}

	return kubernetes.FilterByRoute(protocols, protocolNames, serviceName, namespace, nil)
}

// HasRequestTimeout determines if the spec has an http timeout set.
func (vService *VirtualService) HasRequestTimeout() bool {
	if vService == nil {
		return false
	}

	if routes, isSlice := vService.Spec.Http.([]interface{}); isSlice {
		for _, route := range routes {
			if routeMap, isMap := route.(map[string]interface{}); isMap {
				if _, hasTimeout := routeMap["timeout"]; hasTimeout {
					return true
				}
			}
		}
	}

	return false
}

// HasFaultInjection determines if the spec has http fault injection set.
func (vService *VirtualService) HasFaultInjection() bool {
	if vService == nil {
		return false
	}

	if routes, isSlice := vService.Spec.Http.([]interface{}); isSlice {
		for _, route := range routes {
			if routeMap, isMap := route.(map[string]interface{}); isMap {
				if _, hasFault := routeMap["fault"]; hasFault {
					return true
				}
			}
		}
	}

	return false
}

// HasTrafficShifting determines if the spec has http traffic shifting set.
// If there are routes with multiple destinations then it is assumed that
// the spec has traffic shifting regardless of weights.
func (vService *VirtualService) HasTrafficShifting() bool {
	if vService == nil {
		return false
	}

	if routes, isSlice := vService.Spec.Http.([]interface{}); isSlice {
		for _, route := range routes {
			if routeMap, isMap := route.(map[string]interface{}); isMap {
				if destinationRoutes, hasDRRoutes := routeMap["route"]; hasDRRoutes {
					if drRoutes, isSlice := destinationRoutes.([]interface{}); isSlice {
						// If there's only a single destination then there's no weighted split.
						// If there's multiple destinations, it's assumed that there's traffic
						// splitting even if one destination has 100 weight and the rest have 0.
						return len(drRoutes) > 1
					}
				}
			}
		}
	}

	return false
}


// HasTCPTrafficShifting determines if the spec has tcp traffic shifting set.
// If there are routes with multiple destinations then it is assumed that
// the spec has traffic shifting regardless of weights.
func (vService *VirtualService) HasTCPTrafficShifting() bool {
	if vService == nil {
		return false
	}
	
	if routes, isSlice := vService.Spec.Tcp.([]interface{}); isSlice {
		for _, route := range routes {
			if routeMap, isMap := route.(map[string]interface{}); isMap {
				if destinationRoutes, hasDRRoutes := routeMap["route"]; hasDRRoutes {
					if drRoutes, isSlice := destinationRoutes.([]interface{}); isSlice {
						// If there's only a single destination then there's no weighted split.
						// If there's multiple destinations, it's assumed that there's traffic
						// splitting even if one destination has 100 weight and the rest have 0.
						return len(drRoutes) > 1
					}
				}
			}
		}
	}

	return false
}

// IsValidHost returns true if VirtualService hosts applies to the service
func (vService *VirtualService) HasRequestRouting() bool {
	if vService == nil {
		return false
	}

	hasRoute := func(routes []interface{}) bool {
		for _, route := range routes {
			if routeMap, isMap := route.(map[string]interface{}); isMap {
				if _, hasRoute := routeMap["route"]; hasRoute {
					return true
				}
			}
		}
		return false
	}
	
	if routes, isSlice := vService.Spec.Tcp.([]interface{}); isSlice {
		if hasRoute(routes) {
			return true
		}
	}
	if routes, isSlice := vService.Spec.Http.([]interface{}); isSlice {
		if hasRoute(routes) {
			return true
		}
	}
	if routes, isSlice := vService.Spec.Tls.([]interface{}); isSlice {
		if hasRoute(routes) {
			return true
		}
	}

	return false
}

