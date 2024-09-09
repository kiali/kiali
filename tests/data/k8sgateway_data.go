package data

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"
	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

func CreateEmptyHTTPRoute(name string, namespace string, hosts []string) *k8s_networking_v1.HTTPRoute {
	vs := k8s_networking_v1.HTTPRoute{}
	vs.Name = name
	vs.Namespace = namespace
	for _, host := range hosts {
		vs.Spec.Hostnames = append(vs.Spec.Hostnames, k8s_networking_v1.Hostname(host))
	}
	return &vs
}

func CreateHTTPRoute(name string, namespace string, gateway string, hosts []string) *k8s_networking_v1.HTTPRoute {
	return AddGatewayParentRefToHTTPRoute(gateway, namespace, CreateEmptyHTTPRoute(name, namespace, hosts))
}

func AddGatewayParentRefToHTTPRoute(name, namespace string, rt *k8s_networking_v1.HTTPRoute) *k8s_networking_v1.HTTPRoute {
	ns := k8s_networking_v1.Namespace(namespace)
	group := k8s_networking_v1.Group(kubernetes.K8sGateways.Group)
	kind := k8s_networking_v1.Kind(kubernetes.K8sGateways.Kind)
	rt.Spec.ParentRefs = append(rt.Spec.ParentRefs, k8s_networking_v1.ParentReference{
		Name:      k8s_networking_v1.ObjectName(name),
		Namespace: &ns,
		Group:     &group,
		Kind:      &kind})
	return rt
}

func AddServiceParentRefToHTTPRoute(name, namespace string, rt *k8s_networking_v1.HTTPRoute) *k8s_networking_v1.HTTPRoute {
	ns := k8s_networking_v1.Namespace(namespace)
	group := k8s_networking_v1.Group("core")
	kind := k8s_networking_v1.Kind(kubernetes.ServiceType)
	rt.Spec.ParentRefs = append(rt.Spec.ParentRefs, k8s_networking_v1.ParentReference{
		Name:      k8s_networking_v1.ObjectName(name),
		Namespace: &ns,
		Group:     &group,
		Kind:      &kind})
	return rt
}

func AddBackendRefToHTTPRoute(name, namespace string, rt *k8s_networking_v1.HTTPRoute) *k8s_networking_v1.HTTPRoute {
	kind := k8s_networking_v1.Kind("Service")
	var ns k8s_networking_v1.Namespace
	if namespace != "" {
		ns = k8s_networking_v1.Namespace(namespace)
	}
	backendRef := k8s_networking_v1.HTTPBackendRef{
		BackendRef: k8s_networking_v1.BackendRef{
			BackendObjectReference: k8s_networking_v1.BackendObjectReference{
				Kind:      &kind,
				Name:      k8s_networking_v1.ObjectName(name),
				Namespace: &ns,
			},
		},
	}
	rule := k8s_networking_v1.HTTPRouteRule{}
	rule.BackendRefs = append(rule.BackendRefs, backendRef)
	rt.Spec.Rules = append(rt.Spec.Rules, rule)
	return rt
}

func CreateEmptyGRPCRoute(name string, namespace string, hosts []string) *k8s_networking_v1.GRPCRoute {
	vs := k8s_networking_v1.GRPCRoute{}
	vs.Name = name
	vs.Namespace = namespace
	for _, host := range hosts {
		vs.Spec.Hostnames = append(vs.Spec.Hostnames, k8s_networking_v1.Hostname(host))
	}
	return &vs
}

func CreateGRPCRoute(name string, namespace string, gateway string, hosts []string) *k8s_networking_v1.GRPCRoute {
	return AddGatewayParentRefToGRPCRoute(gateway, namespace, CreateEmptyGRPCRoute(name, namespace, hosts))
}

func AddGatewayParentRefToGRPCRoute(name, namespace string, rt *k8s_networking_v1.GRPCRoute) *k8s_networking_v1.GRPCRoute {
	ns := k8s_networking_v1.Namespace(namespace)
	group := k8s_networking_v1.Group(kubernetes.K8sGateways.Group)
	kind := k8s_networking_v1.Kind(kubernetes.K8sGateways.Kind)
	rt.Spec.ParentRefs = append(rt.Spec.ParentRefs, k8s_networking_v1.ParentReference{
		Name:      k8s_networking_v1.ObjectName(name),
		Namespace: &ns,
		Group:     &group,
		Kind:      &kind})
	return rt
}

func AddServiceParentRefToGRPCRoute(name, namespace string, rt *k8s_networking_v1.GRPCRoute) *k8s_networking_v1.GRPCRoute {
	ns := k8s_networking_v1.Namespace(namespace)
	group := k8s_networking_v1.Group("core")
	kind := k8s_networking_v1.Kind(kubernetes.ServiceType)
	rt.Spec.ParentRefs = append(rt.Spec.ParentRefs, k8s_networking_v1.ParentReference{
		Name:      k8s_networking_v1.ObjectName(name),
		Namespace: &ns,
		Group:     &group,
		Kind:      &kind})
	return rt
}

func AddBackendRefToGRPCRoute(name, namespace string, rt *k8s_networking_v1.GRPCRoute) *k8s_networking_v1.GRPCRoute {
	kind := k8s_networking_v1.Kind("Service")
	var ns k8s_networking_v1.Namespace
	if namespace != "" {
		ns = k8s_networking_v1.Namespace(namespace)
	}
	backendRef := k8s_networking_v1.GRPCBackendRef{
		BackendRef: k8s_networking_v1.BackendRef{
			BackendObjectReference: k8s_networking_v1.BackendObjectReference{
				Kind:      &kind,
				Name:      k8s_networking_v1.ObjectName(name),
				Namespace: &ns,
			},
		},
	}
	rule := k8s_networking_v1.GRPCRouteRule{}
	rule.BackendRefs = append(rule.BackendRefs, backendRef)
	rt.Spec.Rules = append(rt.Spec.Rules, rule)
	return rt
}

func CreateEmptyK8sGateway(name, namespace string) *k8s_networking_v1.Gateway {
	gw := k8s_networking_v1.Gateway{}
	gw.Name = name
	gw.Namespace = namespace

	gw.Kind = kubernetes.K8sGateways.Kind
	gw.APIVersion = kubernetes.K8sGateways.Version
	gw.Spec.GatewayClassName = "istio"
	return &gw
}

func AddListenerToK8sGateway(listener k8s_networking_v1.Listener, gw *k8s_networking_v1.Gateway) *k8s_networking_v1.Gateway {
	gw.Spec.Listeners = append(gw.Spec.Listeners, listener)
	return gw
}

func AddGwAddressToK8sGateway(address k8s_networking_v1.GatewayAddress, gw *k8s_networking_v1.Gateway) *k8s_networking_v1.Gateway {
	gw.Spec.Addresses = append(gw.Spec.Addresses, address)
	return gw
}

func CreateListener(name string, hostname string, port int, protocol string) k8s_networking_v1.Listener {
	hn := k8s_networking_v1.Hostname(hostname)
	listener := k8s_networking_v1.Listener{
		Name:     k8s_networking_v1.SectionName(name),
		Hostname: &hn,
		Port:     k8s_networking_v1.PortNumber(port),
		Protocol: k8s_networking_v1.ProtocolType(protocol),
	}
	return listener
}

func CreateSharedListener(name string, hostname string, port int, protocol string) k8s_networking_v1.Listener {
	hn := k8s_networking_v1.Hostname(hostname)
	namespaceFromSelector := k8s_networking_v1.NamespacesFromSelector
	listener := k8s_networking_v1.Listener{
		Name:     k8s_networking_v1.SectionName(name),
		Hostname: &hn,
		Port:     k8s_networking_v1.PortNumber(port),
		Protocol: k8s_networking_v1.ProtocolType(protocol),
		AllowedRoutes: &k8s_networking_v1.AllowedRoutes{
			Namespaces: &k8s_networking_v1.RouteNamespaces{
				From: &namespaceFromSelector,
				Selector: &metav1.LabelSelector{
					MatchLabels: map[string]string{"shared-gateway-access": "true"},
				},
			},
		},
	}
	return listener
}

func CreateSharedToAllListener(name string, hostname string, port int, protocol string) k8s_networking_v1.Listener {
	hn := k8s_networking_v1.Hostname(hostname)
	namespaceFromSelector := k8s_networking_v1.NamespacesFromAll
	listener := k8s_networking_v1.Listener{
		Name:     k8s_networking_v1.SectionName(name),
		Hostname: &hn,
		Port:     k8s_networking_v1.PortNumber(port),
		Protocol: k8s_networking_v1.ProtocolType(protocol),
		AllowedRoutes: &k8s_networking_v1.AllowedRoutes{
			Namespaces: &k8s_networking_v1.RouteNamespaces{
				From: &namespaceFromSelector,
			},
		},
	}
	return listener
}

func CreateGWAddress(addrType k8s_networking_v1.AddressType, value string) k8s_networking_v1.GatewayAddress {
	address := k8s_networking_v1.GatewayAddress{
		Type:  &addrType,
		Value: value,
	}
	return address
}

func UpdateConditionWithError(k8sgw *k8s_networking_v1.Gateway) *k8s_networking_v1.Gateway {
	condition := metav1.Condition{Type: "Ready", Status: "False", Reason: "", Message: "Fake msg"}
	k8sgw.Status.Conditions = append(k8sgw.Status.Conditions, condition)

	return k8sgw
}

func CreateReferenceGrant(name string, namespace string, fromNamespace string) *k8s_networking_v1beta1.ReferenceGrant {
	return CreateReferenceGrantByKind(name, namespace, fromNamespace, k8s_networking_v1.Kind(kubernetes.K8sHTTPRoutes.Kind))
}

func CreateReferenceGrantByKind(name string, namespace string, fromNamespace string, kind k8s_networking_v1.Kind) *k8s_networking_v1beta1.ReferenceGrant {
	rg := k8s_networking_v1beta1.ReferenceGrant{}
	rg.Name = name
	rg.Namespace = namespace
	rg.Spec.From = append(rg.Spec.From, k8s_networking_v1beta1.ReferenceGrantFrom{Kind: kind, Group: k8s_networking_v1beta1.GroupName, Namespace: k8s_networking_v1.Namespace(fromNamespace)})
	rg.Spec.To = append(rg.Spec.To, k8s_networking_v1beta1.ReferenceGrantTo{Kind: kubernetes.ServiceType})
	return &rg
}

func CreateSharedNamespace(name string) models.Namespace {
	return models.Namespace{Name: name, Labels: map[string]string{"shared-gateway-access": "true"}}
}
