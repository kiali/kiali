package business

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apinetworkingv1 "istio.io/api/networking/v1"
	networkingv1 "istio.io/client-go/pkg/apis/networking/v1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

// A Gateway resource can select workloads in other namespaces. Destination
// visibility must follow the selected proxies, rather than the resource's namespace.
func TestValidateIstioObjectGatewayWorkloadNamespace(t *testing.T) {
	for _, tt := range []struct {
		exportTo           []string
		gatewayToNamespace bool
		name               string
		valid              bool
		workloadNamespaces []string
	}{
		{
			exportTo: []string{"istio-system"}, name: "exported only to gateway workload",
			valid: true, workloadNamespaces: []string{"istio-system"},
		},
		{
			exportTo: []string{"."}, name: "private to gateway configuration namespace",
			workloadNamespaces: []string{"istio-system"},
		},
		{
			exportTo: []string{"."}, name: "all selected workload namespaces must resolve the destination",
			workloadNamespaces: []string{"default", "istio-system"},
		},
		{
			exportTo: []string{"."}, gatewayToNamespace: true, name: "namespace scoping excludes remote workloads",
			valid: true, workloadNamespaces: []string{"default", "istio-system"},
		},
		{
			exportTo: []string{"."}, name: "local workload keeps private visibility",
			valid: true, workloadNamespaces: []string{"default"},
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			conf := config.NewConfig()
			config.Set(conf)
			cluster := conf.KubernetesConfig.ClusterName
			const namespace = "default"
			const host = "external.example.com"
			objects := []runtime.Object{
				kubetest.FakeNamespace(namespace), kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("istio-system"),
				&corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
				&networkingv1.Gateway{
					ObjectMeta: metav1.ObjectMeta{Name: "egress", Namespace: namespace},
					Spec: apinetworkingv1.Gateway{
						Selector: map[string]string{"istio": "egressgateway"},
						Servers: []*apinetworkingv1.Server{{
							Hosts: []string{host},
							Port:  &apinetworkingv1.Port{Name: "tls", Number: 443, Protocol: "TLS"},
							Tls:   &apinetworkingv1.ServerTLSSettings{Mode: apinetworkingv1.ServerTLSSettings_PASSTHROUGH},
						}},
					},
				},
				&networkingv1.VirtualService{
					ObjectMeta: metav1.ObjectMeta{Name: "egress-vs", Namespace: namespace},
					Spec: apinetworkingv1.VirtualService{
						Gateways: []string{"default/egress"}, Hosts: []string{host},
						Tls: []*apinetworkingv1.TLSRoute{{
							Match: []*apinetworkingv1.TLSMatchAttributes{{SniHosts: []string{host}}},
							Route: []*apinetworkingv1.RouteDestination{{Destination: &apinetworkingv1.Destination{Host: host}}},
						}},
					},
				},
				&networkingv1.ServiceEntry{
					ObjectMeta: metav1.ObjectMeta{Name: "external", Namespace: namespace},
					Spec:       apinetworkingv1.ServiceEntry{ExportTo: tt.exportTo, Hosts: []string{host}, Resolution: apinetworkingv1.ServiceEntry_DNS},
				},
			}
			for _, ns := range tt.workloadNamespaces {
				objects = append(objects, &appsv1.Deployment{
					ObjectMeta: metav1.ObjectMeta{Name: "egressgateway", Namespace: ns},
					Spec: appsv1.DeploymentSpec{
						Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"istio": "egressgateway"}},
						Template: corev1.PodTemplateSpec{
							ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"istio": "egressgateway"}},
							Spec:       corev1.PodSpec{Containers: []corev1.Container{{Image: "istio/proxyv2", Name: "istio-proxy"}}},
						},
					},
				})
			}
			// This workload must not make a gateway-only route apply in bookinfo.
			objects = append(objects, &appsv1.Deployment{
				ObjectMeta: metav1.ObjectMeta{Name: "other", Namespace: "bookinfo"},
				Spec: appsv1.DeploymentSpec{Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "other"}},
				}},
			})
			mesh := models.Mesh{ControlPlanes: []models.ControlPlane{{
				Cluster: &models.KubeCluster{IsKialiHome: true}, IsGatewayToNamespace: tt.gatewayToNamespace,
				IstiodNamespace:   "istio-system",
				ManagedNamespaces: []models.Namespace{{Name: namespace}, {Name: "bookinfo"}, {Name: "istio-system"}},
				MeshConfig:        models.NewMeshConfig(), RootNamespace: "istio-system",
			}}}
			svc := fakeValidationMeshServiceWithMesh(t, *conf, mesh, objects...)
			ctx := context.Background()
			vInfo, err := svc.NewValidationInfo(ctx, []string{cluster}, nil)
			require.NoError(t, err)
			for _, ns := range tt.workloadNamespaces {
				require.NotEmpty(t, vInfo.wlMap[cluster][ns], "the fixture must discover selected gateway workloads")
			}
			performed, background, err := svc.Validate(ctx, cluster, vInfo)
			require.NoError(t, err)
			require.True(t, performed)
			svc.kialiCache.Validations().Replace(background)
			detail, _, err := svc.ValidateIstioObject(ctx, cluster, namespace, kubernetes.VirtualServices, "egress-vs")
			require.NoError(t, err)
			key := models.BuildKey(kubernetes.VirtualServices, "egress-vs", namespace, cluster)
			for name, results := range map[string]models.IstioValidations{
				"background": background, "detail": detail, "cache": svc.kialiCache.Validations().Items(),
			} {
				require.Contains(t, results, key, name)
				assert.Equal(t, tt.valid, results[key].Valid, name)
				var missingHosts []string
				for _, check := range results[key].Checks {
					if check.Code == "KIA1101" {
						missingHosts = append(missingHosts, check.Path)
					}
				}
				if tt.valid {
					assert.Empty(t, missingHosts, name)
				} else {
					assert.Equal(t, []string{"spec/tls[0]/route[0]/destination/host"}, missingHosts, name)
				}
			}
		})
	}
}
