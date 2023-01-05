package data

import (
	k8s_networking_v1alpha2 "sigs.k8s.io/gateway-api/apis/v1alpha2"

	"github.com/kiali/kiali/kubernetes"
)

func CreateEmptyHTTPRoute(name string, namespace string, hosts []string) *k8s_networking_v1alpha2.HTTPRoute {
	vs := k8s_networking_v1alpha2.HTTPRoute{}
	vs.Name = name
	vs.Namespace = namespace
	for _, host := range hosts {
		vs.Spec.Hostnames = append(vs.Spec.Hostnames, k8s_networking_v1alpha2.Hostname(host))
	}
	return &vs
}

func CreateHTTPRoute(name string, namespace string, gateway string, hosts []string) *k8s_networking_v1alpha2.HTTPRoute {
	return AddParentRefToHTTPRoute(gateway, namespace, CreateEmptyHTTPRoute(name, namespace, hosts))
}

func AddParentRefToHTTPRoute(name, namespace string, rt *k8s_networking_v1alpha2.HTTPRoute) *k8s_networking_v1alpha2.HTTPRoute {
	ns := k8s_networking_v1alpha2.Namespace(namespace)
	group := k8s_networking_v1alpha2.Group(kubernetes.K8sNetworkingGroupVersionV1Beta1.Group)
	kind := k8s_networking_v1alpha2.Kind(kubernetes.K8sActualGatewayType)
	rt.Spec.ParentRefs = append(rt.Spec.ParentRefs, k8s_networking_v1alpha2.ParentReference{
		Name:      k8s_networking_v1alpha2.ObjectName(name),
		Namespace: &ns,
		Group:     &group,
		Kind:      &kind})
	return rt
}

func CreateEmptyK8sGateway(name, namespace string) *k8s_networking_v1alpha2.Gateway {
	gw := k8s_networking_v1alpha2.Gateway{}
	gw.Name = name
	gw.Namespace = namespace
	gw.Kind = kubernetes.K8sActualGatewayType
	gw.APIVersion = kubernetes.K8sApiNetworkingVersionV1Alpha2
	gw.Spec.GatewayClassName = "istio"
	return &gw
}
