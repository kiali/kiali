// Benchmarks for IstioAppender performance. These are not unit tests -- they are
// only executed when explicitly requested via the -bench flag. They generate
// synthetic traffic maps with configurable numbers of namespaces, apps,
// DestinationRules, VirtualServices, and gateways, then measure the execution
// time of IstioAppender.AppendGraph.
//
// Run benchmarks:
//
//	go test -run='^$' -bench=BenchmarkIstioAppender -benchmem -count=5 -timeout=600s \
//	  ./graph/telemetry/istio/appender/
//
// Save results to a file for comparison:
//
//	go test -run='^$' -bench=BenchmarkIstioAppender -benchmem -count=5 -timeout=600s \
//	  ./graph/telemetry/istio/appender/ > before.txt
//
// After making changes, run again and compare with benchstat
// (install via: go install golang.org/x/perf/cmd/benchstat@latest):
//
//	benchstat before.txt after.txt
package appender

import (
	"context"
	"fmt"
	"testing"

	api_networking_v1 "istio.io/api/networking/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

type benchScenario struct {
	namespaces     int
	appsPerNs      int
	versionsPerApp int
	drsPerNs       int
	vsPerNs        int
	istioGateways  int
	k8sGateways    int
}

func (s benchScenario) String() string {
	return fmt.Sprintf(
		"%dns_%dapps_%dver_%ddr_%dvs_%digw_%dk8sgw",
		s.namespaces, s.appsPerNs, s.versionsPerApp,
		s.drsPerNs, s.vsPerNs, s.istioGateways, s.k8sGateways,
	)
}

func buildBenchData(b *testing.B, s benchScenario) (*business.Layer, graph.TrafficMap) {
	b.Helper()

	clusterName := config.DefaultClusterID
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = clusterName
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)

	var objects []runtime.Object
	trafficMap := graph.NewTrafficMap()

	for ns := 0; ns < s.namespaces; ns++ {
		nsName := fmt.Sprintf("ns-%d", ns)
		objects = append(objects, kubetest.FakeNamespace(nsName))

		for app := 0; app < s.appsPerNs; app++ {
			appName := fmt.Sprintf("app-%d", app)
			svcName := appName

			objects = append(objects, &core_v1.Service{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      svcName,
					Namespace: nsName,
					Labels:    map[string]string{"app": appName},
				},
				Spec: core_v1.ServiceSpec{
					Ports: []core_v1.ServicePort{{Port: 8080}},
				},
			})

			svcNode, _ := graph.NewNode(clusterName, nsName, svcName, nsName, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
			trafficMap[svcNode.ID] = svcNode

			appNode, _ := graph.NewNode(clusterName, nsName, svcName, nsName, graph.Unknown, appName, "", graph.GraphTypeVersionedApp)
			appNode.Metadata[graph.DestServices] = graph.NewDestServicesMetadata().Add(
				fmt.Sprintf("%s %s", nsName, svcName),
				graph.ServiceName{Namespace: nsName, Name: svcName},
			)
			trafficMap[appNode.ID] = appNode

			for ver := 0; ver < s.versionsPerApp; ver++ {
				version := fmt.Sprintf("v%d", ver)
				wlName := fmt.Sprintf("%s-%s", appName, version)

				objects = append(objects,
					&apps_v1.Deployment{
						ObjectMeta: meta_v1.ObjectMeta{
							Name:      wlName,
							Namespace: nsName,
							Labels:    map[string]string{"app": appName, "version": version},
						},
						Spec: apps_v1.DeploymentSpec{
							Selector: &meta_v1.LabelSelector{
								MatchLabels: map[string]string{"app": appName, "version": version},
							},
							Template: core_v1.PodTemplateSpec{
								ObjectMeta: meta_v1.ObjectMeta{
									Labels: map[string]string{"app": appName, "version": version},
								},
								Spec: core_v1.PodSpec{
									Containers: []core_v1.Container{{
										Name:  "main",
										Image: "test:latest",
									}},
								},
							},
						},
					},
					&apps_v1.ReplicaSet{
						ObjectMeta: meta_v1.ObjectMeta{
							Name:      wlName + "-rs",
							Namespace: nsName,
							Labels:    map[string]string{"app": appName, "version": version},
							OwnerReferences: []meta_v1.OwnerReference{{
								APIVersion: "apps/v1",
								Kind:       "Deployment",
								Name:       wlName,
								Controller: boolPtr(true),
							}},
						},
					},
					&core_v1.Pod{
						ObjectMeta: meta_v1.ObjectMeta{
							Name:      wlName + "-pod-0",
							Namespace: nsName,
							Labels:    map[string]string{"app": appName, "version": version},
							OwnerReferences: []meta_v1.OwnerReference{{
								APIVersion: "apps/v1",
								Kind:       "ReplicaSet",
								Name:       wlName + "-rs",
								Controller: boolPtr(true),
							}},
						},
						Status: core_v1.PodStatus{Phase: core_v1.PodRunning},
					},
				)

				wlNode, _ := graph.NewNode(clusterName, nsName, svcName, nsName, wlName, appName, version, graph.GraphTypeVersionedApp)
				wlNode.Metadata[graph.DestServices] = graph.NewDestServicesMetadata().Add(
					fmt.Sprintf("%s %s", nsName, svcName),
					graph.ServiceName{Namespace: nsName, Name: svcName},
				)
				trafficMap[wlNode.ID] = wlNode
			}
		}

		for dr := 0; dr < s.drsPerNs; dr++ {
			targetApp := fmt.Sprintf("app-%d", dr%s.appsPerNs)
			objects = append(objects, &networking_v1.DestinationRule{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      fmt.Sprintf("dr-%d", dr),
					Namespace: nsName,
				},
				Spec: api_networking_v1.DestinationRule{
					Host: targetApp,
					TrafficPolicy: &api_networking_v1.TrafficPolicy{
						ConnectionPool: &api_networking_v1.ConnectionPoolSettings{
							Http: &api_networking_v1.ConnectionPoolSettings_HTTPSettings{
								MaxRequestsPerConnection: 100,
							},
						},
					},
				},
			})
		}

		for vs := 0; vs < s.vsPerNs; vs++ {
			targetApp := fmt.Sprintf("app-%d", vs%s.appsPerNs)
			objects = append(objects, &networking_v1.VirtualService{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      fmt.Sprintf("vs-%d", vs),
					Namespace: nsName,
				},
				Spec: api_networking_v1.VirtualService{
					Hosts: []string{targetApp},
					Http: []*api_networking_v1.HTTPRoute{{
						Route: []*api_networking_v1.HTTPRouteDestination{{
							Destination: &api_networking_v1.Destination{
								Host: targetApp,
							},
						}},
					}},
				},
			})
		}
	}

	gwNs := "istio-system"
	objects = append(objects, kubetest.FakeNamespace(gwNs))

	for gw := 0; gw < s.istioGateways; gw++ {
		gwName := fmt.Sprintf("istio-gw-%d", gw)
		wlName := fmt.Sprintf("istio-ingressgateway-%d", gw)

		objects = append(objects,
			&networking_v1.Gateway{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      gwName,
					Namespace: gwNs,
				},
				Spec: api_networking_v1.Gateway{
					Selector: map[string]string{"istio": wlName},
					Servers: []*api_networking_v1.Server{{
						Hosts: []string{"*.example.com"},
						Port:  &api_networking_v1.Port{Number: 80, Name: "http", Protocol: "HTTP"},
					}},
				},
			},
			&apps_v1.Deployment{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      wlName,
					Namespace: gwNs,
					Labels: map[string]string{
						"istio":                       wlName,
						"operator.istio.io/component": "IngressGateways",
					},
				},
				Spec: apps_v1.DeploymentSpec{
					Selector: &meta_v1.LabelSelector{
						MatchLabels: map[string]string{"istio": wlName},
					},
					Template: core_v1.PodTemplateSpec{
						ObjectMeta: meta_v1.ObjectMeta{
							Labels: map[string]string{
								"istio":                       wlName,
								"operator.istio.io/component": "IngressGateways",
							},
						},
						Spec: core_v1.PodSpec{
							Containers: []core_v1.Container{{Name: "istio-proxy", Image: "istio-proxy:latest"}},
						},
					},
				},
			},
			&apps_v1.ReplicaSet{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      wlName + "-rs",
					Namespace: gwNs,
					Labels: map[string]string{
						"istio":                       wlName,
						"operator.istio.io/component": "IngressGateways",
					},
					OwnerReferences: []meta_v1.OwnerReference{{
						APIVersion: "apps/v1",
						Kind:       "Deployment",
						Name:       wlName,
						Controller: boolPtr(true),
					}},
				},
			},
			&core_v1.Pod{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      wlName + "-pod-0",
					Namespace: gwNs,
					Labels: map[string]string{
						"istio":                       wlName,
						"operator.istio.io/component": "IngressGateways",
					},
					OwnerReferences: []meta_v1.OwnerReference{{
						APIVersion: "apps/v1",
						Kind:       "ReplicaSet",
						Name:       wlName + "-rs",
						Controller: boolPtr(true),
					}},
				},
				Status: core_v1.PodStatus{Phase: core_v1.PodRunning},
			},
		)

		wlNode, _ := graph.NewNode(clusterName, gwNs, "", gwNs, wlName, graph.Unknown, graph.Unknown, graph.GraphTypeWorkload)
		trafficMap[wlNode.ID] = wlNode
	}

	for gw := 0; gw < s.k8sGateways; gw++ {
		gwName := fmt.Sprintf("k8s-gw-%d", gw)
		wlName := fmt.Sprintf("k8s-gateway-%d", gw)
		hostname := k8s_networking_v1.Hostname(fmt.Sprintf("gw-%d.example.com", gw))

		objects = append(objects,
			&k8s_networking_v1.Gateway{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      gwName,
					Namespace: gwNs,
				},
				Spec: k8s_networking_v1.GatewaySpec{
					GatewayClassName: "istio",
					Listeners: []k8s_networking_v1.Listener{{
						Name:     "http",
						Port:     80,
						Protocol: k8s_networking_v1.HTTPProtocolType,
						Hostname: &hostname,
					}},
				},
			},
			&apps_v1.Deployment{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      wlName,
					Namespace: gwNs,
					Labels:    map[string]string{config.GatewayLabel: gwName},
				},
				Spec: apps_v1.DeploymentSpec{
					Selector: &meta_v1.LabelSelector{
						MatchLabels: map[string]string{config.GatewayLabel: gwName},
					},
					Template: core_v1.PodTemplateSpec{
						ObjectMeta: meta_v1.ObjectMeta{
							Labels: map[string]string{config.GatewayLabel: gwName},
						},
						Spec: core_v1.PodSpec{
							Containers: []core_v1.Container{{Name: "istio-proxy", Image: "istio-proxy:latest"}},
						},
					},
				},
			},
			&apps_v1.ReplicaSet{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      wlName + "-rs",
					Namespace: gwNs,
					Labels:    map[string]string{config.GatewayLabel: gwName},
					OwnerReferences: []meta_v1.OwnerReference{{
						APIVersion: "apps/v1",
						Kind:       "Deployment",
						Name:       wlName,
						Controller: boolPtr(true),
					}},
				},
			},
			&core_v1.Pod{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      wlName + "-pod-0",
					Namespace: gwNs,
					Labels:    map[string]string{config.GatewayLabel: gwName},
					OwnerReferences: []meta_v1.OwnerReference{{
						APIVersion: "apps/v1",
						Kind:       "ReplicaSet",
						Name:       wlName + "-rs",
						Controller: boolPtr(true),
					}},
				},
				Status: core_v1.PodStatus{Phase: core_v1.PodRunning},
			},
		)

		wlNode, _ := graph.NewNode(clusterName, gwNs, "", gwNs, wlName, graph.Unknown, graph.Unknown, graph.GraphTypeWorkload)
		trafficMap[wlNode.ID] = wlNode
	}

	k8s := kubetest.NewFakeK8sClient(objects...)
	biz := business.NewLayerBuilder(b, conf).WithClient(k8s).Build()

	return biz, trafficMap
}

func boolPtr(v bool) *bool { return &v }

func runBenchmark(b *testing.B, s benchScenario) {
	biz, trafficMap := buildBenchData(b, s)
	conf := config.Get()

	clusters := []models.KubeCluster{{Name: conf.KubernetesConfig.ClusterName}}

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		gi := graph.NewGlobalInfo(biz, nil, conf, clusters, NewGlobalIstioInfo())
		gi.Clusters = clusters
		a := IstioAppender{}
		a.AppendGraph(context.Background(), trafficMap, gi, nil)
	}
}

func BenchmarkIstioAppender(b *testing.B) {
	scenarios := []benchScenario{
		{namespaces: 5, appsPerNs: 5, versionsPerApp: 2, drsPerNs: 3, vsPerNs: 3, istioGateways: 1, k8sGateways: 1},
		{namespaces: 20, appsPerNs: 5, versionsPerApp: 2, drsPerNs: 5, vsPerNs: 5, istioGateways: 3, k8sGateways: 3},
		{namespaces: 50, appsPerNs: 5, versionsPerApp: 3, drsPerNs: 10, vsPerNs: 10, istioGateways: 5, k8sGateways: 5},
		{namespaces: 50, appsPerNs: 10, versionsPerApp: 3, drsPerNs: 10, vsPerNs: 10, istioGateways: 10, k8sGateways: 10},
		{namespaces: 50, appsPerNs: 10, versionsPerApp: 3, drsPerNs: 10, vsPerNs: 10, istioGateways: 0, k8sGateways: 0},
		{namespaces: 500, appsPerNs: 5, versionsPerApp: 2, drsPerNs: 5, vsPerNs: 5, istioGateways: 3, k8sGateways: 3},
	}

	for _, s := range scenarios {
		b.Run(s.String(), func(b *testing.B) {
			runBenchmark(b, s)
		})
	}
}
