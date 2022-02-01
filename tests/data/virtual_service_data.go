package data

import (
	"time"

	"github.com/gogo/protobuf/types"
	api_networking_v1alpha3 "istio.io/api/networking/v1alpha3"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
)

func CreateEmptyVirtualService(name string, namespace string, hosts []string) *networking_v1alpha3.VirtualService {
	vs := networking_v1alpha3.VirtualService{}
	vs.Name = name
	vs.Namespace = namespace
	vs.Spec.Hosts = hosts
	vs.ClusterName = "svc.cluster.local"
	return &vs
}

// TODO Naming etc
func CreateVirtualService() *networking_v1alpha3.VirtualService {
	return AddHttpRoutesToVirtualService(CreateHttpRouteDestination("reviews", "v1", -1),
		AddTcpRoutesToVirtualService(CreateTcpRoute("reviews", "v1", -1),
			CreateEmptyVirtualService("reviews", "test", []string{"reviews"}),
		),
	)
}

func AddHttpRoutesToVirtualService(route *api_networking_v1alpha3.HTTPRouteDestination, vs *networking_v1alpha3.VirtualService) *networking_v1alpha3.VirtualService {
	if len(vs.Spec.Http) == 0 {
		vs.Spec.Http = []*api_networking_v1alpha3.HTTPRoute{
			{
				Route: []*api_networking_v1alpha3.HTTPRouteDestination{
					route,
				},
			},
		}
	} else {
		vs.Spec.Http[0].Route = append(vs.Spec.Http[0].Route, route)
	}
	return vs
}

func AddTcpRoutesToVirtualService(route *api_networking_v1alpha3.TCPRoute, vs *networking_v1alpha3.VirtualService) *networking_v1alpha3.VirtualService {
	vs.Spec.Tcp = append(vs.Spec.Tcp, route)
	return vs
}

func AddTlsRoutesToVirtualService(route *api_networking_v1alpha3.TLSRoute, vs *networking_v1alpha3.VirtualService) *networking_v1alpha3.VirtualService {
	vs.Spec.Tls = append(vs.Spec.Tls, route)
	return vs
}

func CreateHttpRouteDestination(host string, subset string, weight int32) *api_networking_v1alpha3.HTTPRouteDestination {
	httpRouteDestination := &api_networking_v1alpha3.HTTPRouteDestination{
		Destination: &api_networking_v1alpha3.Destination{
			Host:   host,
			Subset: subset,
		},
		Weight: weight,
	}
	return httpRouteDestination
}

func CreateTcpRoute(host string, subset string, weight int32) *api_networking_v1alpha3.TCPRoute {
	route := api_networking_v1alpha3.TCPRoute{
		Route: []*api_networking_v1alpha3.RouteDestination{
			{
				Destination: &api_networking_v1alpha3.Destination{
					Host:   host,
					Subset: subset,
				},
				Weight: weight,
			},
		},
	}
	return &route
}

func CreateTlsRoute(host string, subset string, weight int32) *api_networking_v1alpha3.TLSRoute {
	route := api_networking_v1alpha3.TLSRoute{
		// TODO Add "Match", currently Route host is needed
		Route: []*api_networking_v1alpha3.RouteDestination{
			{
				Destination: &api_networking_v1alpha3.Destination{
					Host:   host,
					Subset: subset,
				},
				Weight: weight,
			},
		},
	}
	return &route
}

// Example from https://istio.io/docs/reference/config/istio.networking.v1alpha3/#Destination
func CreateVirtualServiceWithServiceEntryTarget() *networking_v1alpha3.VirtualService {
	vs := CreateEmptyVirtualService("my-wiki-rule", "wikipedia", []string{"wikipedia.org"})
	timeout, _ := time.ParseDuration("5s")
	vs.Spec.Http = []*api_networking_v1alpha3.HTTPRoute{
		{
			Timeout: types.DurationProto(timeout),
			Route: []*api_networking_v1alpha3.HTTPRouteDestination{
				{
					Destination: &api_networking_v1alpha3.Destination{
						Host: "wikipedia.org",
					},
				},
			},
		},
	}
	return vs
}
