package data

import (
	"time"

	"google.golang.org/protobuf/types/known/durationpb"
	api_networking_v1 "istio.io/api/networking/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
)

func CreateEmptyVirtualService(name string, namespace string, hosts []string) *networking_v1.VirtualService {
	vs := networking_v1.VirtualService{}
	vs.Name = name
	vs.Namespace = namespace
	vs.Spec.Hosts = hosts
	return &vs
}

// TODO Naming etc
func CreateVirtualService() *networking_v1.VirtualService {
	return AddHttpRoutesToVirtualService(CreateHttpRouteDestination("reviews", "v1", -1),
		AddTcpRoutesToVirtualService(CreateTcpRoute("reviews", "v1", -1),
			CreateEmptyVirtualService("reviews", "test", []string{"reviews"}),
		),
	)
}

func AddHttpRoutesToVirtualService(route *api_networking_v1.HTTPRouteDestination, vs *networking_v1.VirtualService) *networking_v1.VirtualService {
	if len(vs.Spec.Http) == 0 {
		vs.Spec.Http = []*api_networking_v1.HTTPRoute{
			{
				Route: []*api_networking_v1.HTTPRouteDestination{
					route,
				},
			},
		}
	} else {
		vs.Spec.Http[0].Route = append(vs.Spec.Http[0].Route, route)
	}
	return vs
}

func AddTcpRoutesToVirtualService(route *api_networking_v1.TCPRoute, vs *networking_v1.VirtualService) *networking_v1.VirtualService {
	vs.Spec.Tcp = append(vs.Spec.Tcp, route)
	return vs
}

func AddTlsRoutesToVirtualService(route *api_networking_v1.TLSRoute, vs *networking_v1.VirtualService) *networking_v1.VirtualService {
	vs.Spec.Tls = append(vs.Spec.Tls, route)
	return vs
}

func CreateHttpRouteDestination(host string, subset string, weight int32) *api_networking_v1.HTTPRouteDestination {
	httpRouteDestination := &api_networking_v1.HTTPRouteDestination{
		Destination: &api_networking_v1.Destination{
			Host:   host,
			Subset: subset,
		},
		Weight: weight,
	}
	return httpRouteDestination
}

func CreateTcpRoute(host string, subset string, weight int32) *api_networking_v1.TCPRoute {
	route := api_networking_v1.TCPRoute{
		Route: []*api_networking_v1.RouteDestination{
			{
				Destination: &api_networking_v1.Destination{
					Host:   host,
					Subset: subset,
				},
				Weight: weight,
			},
		},
	}
	return &route
}

func CreateTlsRoute(host string, subset string, weight int32) *api_networking_v1.TLSRoute {
	route := api_networking_v1.TLSRoute{
		// TODO Add "Match", currently Route host is needed
		Route: []*api_networking_v1.RouteDestination{
			{
				Destination: &api_networking_v1.Destination{
					Host:   host,
					Subset: subset,
				},
				Weight: weight,
			},
		},
	}
	return &route
}

// Example from https://istio.io/docs/reference/config/istio.networking.v1/#Destination
func CreateVirtualServiceWithServiceEntryTarget() *networking_v1.VirtualService {
	vs := CreateEmptyVirtualService("my-wiki-rule", "wikipedia", []string{"wikipedia.org"})
	timeout, _ := time.ParseDuration("5s")
	vs.Spec.Http = []*api_networking_v1.HTTPRoute{
		{
			Timeout: durationpb.New(timeout),
			Route: []*api_networking_v1.HTTPRouteDestination{
				{
					Destination: &api_networking_v1.Destination{
						Host: "wikipedia.org",
					},
				},
			},
		},
	}
	return vs
}
