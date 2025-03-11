package references

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util"
)

type VirtualServiceReferences struct {
	Conf                  *config.Config
	Namespace             string
	Namespaces            models.Namespaces
	VirtualServices       []*networking_v1.VirtualService
	DestinationRules      []*networking_v1.DestinationRule
	AuthorizationPolicies []*security_v1.AuthorizationPolicy
}

func (n VirtualServiceReferences) References() models.IstioReferencesMap {
	result := models.IstioReferencesMap{}

	for _, vs := range n.VirtualServices {
		key := models.IstioReferenceKey{Namespace: vs.Namespace, Name: vs.Name, ObjectGVK: kubernetes.VirtualServices}
		references := &models.IstioReferences{}
		references.ServiceReferences = n.getServiceReferences(vs)
		references.ObjectReferences = n.getConfigReferences(vs)
		result.MergeReferencesMap(models.IstioReferencesMap{key: references})
	}

	return result
}

func (n VirtualServiceReferences) getServiceReferences(vs *networking_v1.VirtualService) []models.ServiceReference {
	keys := make(map[string]bool)
	allServices := make([]models.ServiceReference, 0)
	result := make([]models.ServiceReference, 0)
	namespace := vs.Namespace

	for _, httpRoute := range vs.Spec.Http {
		if httpRoute != nil {
			for _, dest := range httpRoute.Route {
				if dest != nil {
					host := dest.Destination.Host
					if host == "" {
						continue
					}
					fqdn := kubernetes.GetHost(host, namespace, n.Namespaces.GetNames(), n.Conf)
					if !fqdn.IsWildcard() {
						allServices = append(allServices, models.ServiceReference{Name: fqdn.Service, Namespace: fqdn.Namespace})
					}
				}
			}
		}
	}

	for _, tcpRoute := range vs.Spec.Tcp {
		if tcpRoute != nil {
			for _, dest := range tcpRoute.Route {
				if dest != nil {
					host := dest.Destination.Host
					if host == "" {
						continue
					}
					fqdn := kubernetes.GetHost(host, namespace, n.Namespaces.GetNames(), n.Conf)
					if !fqdn.IsWildcard() {
						allServices = append(allServices, models.ServiceReference{Name: fqdn.Service, Namespace: fqdn.Namespace})
					}
				}
			}
		}
	}

	for _, tlsRoute := range vs.Spec.Tls {
		if tlsRoute != nil {
			for _, dest := range tlsRoute.Route {
				if dest != nil {
					host := dest.Destination.Host
					if host == "" {
						continue
					}
					fqdn := kubernetes.GetHost(host, namespace, n.Namespaces.GetNames(), n.Conf)
					if !fqdn.IsWildcard() {
						allServices = append(allServices, models.ServiceReference{Name: fqdn.Service, Namespace: fqdn.Namespace})
					}
				}
			}
		}
	}
	// filter unique references
	for _, sv := range allServices {
		key := util.BuildNameNSKey(sv.Name, sv.Namespace)
		if !keys[key] {
			result = append(result, sv)
			keys[key] = true
		}
	}
	return result
}

func (n VirtualServiceReferences) getConfigReferences(vs *networking_v1.VirtualService) []models.IstioReference {
	keys := make(map[string]bool)
	result := make([]models.IstioReference, 0)
	allGateways := getAllGateways(vs, n.Conf)
	// filter unique references
	for _, gw := range allGateways {
		key := util.BuildNameNSTypeKey(gw.Name, gw.Namespace, gw.ObjectGVK)
		if !keys[key] {
			result = append(result, gw)
			keys[key] = true
		}
	}
	allDRs := n.getAllDestinationRules(vs)
	// filter unique references
	for _, dr := range allDRs {
		key := util.BuildNameNSTypeKey(dr.Name, dr.Namespace, dr.ObjectGVK)
		if !keys[key] {
			result = append(result, dr)
			keys[key] = true
		}
	}
	allAuthPolicies := n.getAuthPolicies(vs)
	// filter unique references
	for _, ap := range allAuthPolicies {
		key := util.BuildNameNSTypeKey(ap.Name, ap.Namespace, ap.ObjectGVK)
		if !keys[key] {
			result = append(result, ap)
			keys[key] = true
		}
	}
	return result
}

func (n VirtualServiceReferences) getAllDestinationRules(virtualService *networking_v1.VirtualService) []models.IstioReference {
	allDRs := make([]models.IstioReference, 0)
	for _, dr := range n.DestinationRules {
		if len(virtualService.Spec.Http) > 0 {
			for _, httpRoute := range virtualService.Spec.Http {
				if httpRoute == nil {
					continue
				}
				if len(httpRoute.Route) > 0 {
					for _, dest := range httpRoute.Route {
						if dest == nil || dest.Destination == nil {
							continue
						}
						host := dest.Destination.Host
						drHost := kubernetes.GetHost(host, dr.Namespace, n.Namespaces.GetNames(), n.Conf)
						vsHost := kubernetes.GetHost(dr.Spec.Host, virtualService.Namespace, n.Namespaces.GetNames(), n.Conf)
						if kubernetes.FilterByHost(vsHost.String(), vsHost.Namespace, drHost.Service, drHost.Namespace, n.Conf) {
							allDRs = append(allDRs, models.IstioReference{Name: dr.Name, Namespace: dr.Namespace, ObjectGVK: kubernetes.DestinationRules})
						}
					}
				}
			}
		}

		if len(virtualService.Spec.Tcp) > 0 {
			for _, tcpRoute := range virtualService.Spec.Tcp {
				if tcpRoute == nil {
					continue
				}
				if len(tcpRoute.Route) > 0 {
					for _, dest := range tcpRoute.Route {
						if dest == nil || dest.Destination == nil {
							continue
						}
						host := dest.Destination.Host
						drHost := kubernetes.GetHost(host, dr.Namespace, n.Namespaces.GetNames(), n.Conf)
						vsHost := kubernetes.GetHost(dr.Spec.Host, virtualService.Namespace, n.Namespaces.GetNames(), n.Conf)
						if kubernetes.FilterByHost(vsHost.String(), vsHost.Namespace, drHost.Service, drHost.Namespace, n.Conf) {
							allDRs = append(allDRs, models.IstioReference{Name: dr.Name, Namespace: dr.Namespace, ObjectGVK: kubernetes.DestinationRules})
						}
					}
				}
			}
		}

		if len(virtualService.Spec.Tls) > 0 {
			for _, tlsRoute := range virtualService.Spec.Tls {
				if tlsRoute == nil {
					continue
				}
				if len(tlsRoute.Route) > 0 {
					for _, dest := range tlsRoute.Route {
						if dest == nil || dest.Destination == nil {
							continue
						}
						host := dest.Destination.Host
						drHost := kubernetes.GetHost(host, dr.Namespace, n.Namespaces.GetNames(), n.Conf)
						vsHost := kubernetes.GetHost(dr.Spec.Host, virtualService.Namespace, n.Namespaces.GetNames(), n.Conf)
						if kubernetes.FilterByHost(vsHost.String(), vsHost.Namespace, drHost.Service, drHost.Namespace, n.Conf) {
							allDRs = append(allDRs, models.IstioReference{Name: dr.Name, Namespace: dr.Namespace, ObjectGVK: kubernetes.DestinationRules})
						}
					}
				}
			}
		}
	}
	return allDRs
}

func getAllGateways(vs *networking_v1.VirtualService, conf *config.Config) []models.IstioReference {
	allGateways := make([]models.IstioReference, 0)
	namespace := vs.Namespace
	if len(vs.Spec.Gateways) > 0 {
		allGateways = append(allGateways, getGatewayReferences(vs.Spec.Gateways, namespace, conf)...)
	}
	if len(vs.Spec.Http) > 0 {
		for _, httpRoute := range vs.Spec.Http {
			if httpRoute != nil {
				for _, match := range httpRoute.Match {
					if match != nil && match.Gateways != nil {
						allGateways = append(allGateways, getGatewayReferences(match.Gateways, namespace, conf)...)
					}
				}
			}
		}
	}
	// TODO TCPMatch is not completely supported in Istio yet
	if len(vs.Spec.Tls) > 0 {
		for _, tlsRoute := range vs.Spec.Tls {
			if tlsRoute != nil {
				for _, match := range tlsRoute.Match {
					if match != nil {
						allGateways = append(allGateways, getGatewayReferences(match.Gateways, namespace, conf)...)
					}
				}
			}
		}
	}
	return allGateways
}

func getGatewayReferences(gateways []string, namespace string, conf *config.Config) []models.IstioReference {
	result := make([]models.IstioReference, 0)
	for _, gate := range gateways {
		gw := kubernetes.ParseGatewayAsHost(gate, namespace, conf)
		if !gw.IsWildcard() {
			if gate == "mesh" {
				result = append(result, models.IstioReference{Name: gw.Service, ObjectGVK: kubernetes.Gateways})
			} else {
				result = append(result, models.IstioReference{Name: gw.Service, Namespace: gw.Namespace, ObjectGVK: kubernetes.Gateways})
			}
		}
	}
	return result
}

func (n VirtualServiceReferences) getAuthPolicies(vs *networking_v1.VirtualService) []models.IstioReference {
	result := make([]models.IstioReference, 0)
	for _, ap := range n.AuthorizationPolicies {
		namespace := ap.Namespace
		for _, rule := range ap.Spec.Rules {
			if rule == nil {
				continue
			}
			if len(rule.To) > 0 {
				for _, t := range rule.To {
					if t == nil || t.Operation == nil || len(t.Operation.Hosts) == 0 {
						continue
					}
					for _, h := range t.Operation.Hosts {
						fqdn := kubernetes.GetHost(h, namespace, n.Namespaces.GetNames(), n.Conf)
						if !fqdn.IsWildcard() {
							for hostIdx := 0; hostIdx < len(vs.Spec.Hosts); hostIdx++ {
								vHost := vs.Spec.Hosts[hostIdx]

								hostS := kubernetes.ParseHost(vHost, vs.Namespace, n.Conf)
								if hostS.String() == fqdn.String() {
									result = append(result, models.IstioReference{Name: ap.Name, Namespace: ap.Namespace, ObjectGVK: kubernetes.AuthorizationPolicies})
									continue
								}
							}
						}
					}
				}
			}
		}
	}
	return result
}
