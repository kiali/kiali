package data

import (
	api_networking_v1alpha3 "istio.io/api/networking/v1alpha3"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

	"github.com/kiali/kiali/config"
)

func CreateEmptyGateway(name, namespace string, selector map[string]string) *networking_v1alpha3.Gateway {
	gw := networking_v1alpha3.Gateway{}
	gw.Name = name
	gw.Namespace = namespace
	gw.Kind = "Gateway"
	gw.APIVersion = "networking.istio.io/v1alpha3"
	gw.ClusterName = config.Get().ExternalServices.Istio.IstioIdentityDomain
	gw.Spec.Selector = selector
	return &gw
}

func AddServerToGateway(server *api_networking_v1alpha3.Server, gw *networking_v1alpha3.Gateway) *networking_v1alpha3.Gateway {
	gw.Spec.Servers = append(gw.Spec.Servers, server)
	return gw
}

func CreateServer(hosts []string, port uint32, portName, protocolName string) *api_networking_v1alpha3.Server {
	server := api_networking_v1alpha3.Server{
		Hosts: hosts,
		Port:  CreateEmptyPortDefinition(port, portName, protocolName),
	}
	return &server
}

func AddGatewaysToVirtualService(gateways []string, vs *networking_v1alpha3.VirtualService) *networking_v1alpha3.VirtualService {
	vs.Spec.Gateways = gateways
	return vs
}
