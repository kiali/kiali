package checkers

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	networkingv1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestNoServiceCheckerGatewayWorkloadScope(t *testing.T) {
	for _, tt := range []struct {
		applies            bool
		emptySelector      bool
		gatewayToNamespace bool
		name               string
		namespace          string
		reference          string
	}{
		{applies: true, name: "qualified reference selects remote workload", namespace: "istio-system", reference: "default/egress"},
		{applies: true, name: "local reference selects remote workload", namespace: "istio-system", reference: "egress"},
		{applies: true, name: "legacy reference selects remote workload", namespace: "istio-system", reference: "egress.default.svc.cluster.local"},
		{name: "resource namespace has no selected workload", namespace: "default", reference: "default/egress"},
		{name: "nonmatching workload is ignored", namespace: "bookinfo", reference: "default/egress"},
		{gatewayToNamespace: true, name: "namespace scoping excludes remote workload", namespace: "istio-system", reference: "default/egress"},
		{applies: true, emptySelector: true, name: "empty selector includes unrelated workload", namespace: "bookinfo", reference: "default/egress"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			gateway := data.CreateEmptyGateway("egress", "default", map[string]string{"istio": "egressgateway"})
			if tt.emptySelector {
				gateway.Spec.Selector = nil
			}
			vs := data.AddHttpRoutesToVirtualService(
				data.CreateHttpRouteDestination("missing.example.com", "", 100),
				data.CreateEmptyVirtualService("egress-vs", "default", []string{"missing.example.com"}),
			)
			vs.Spec.Gateways = []string{tt.reference}
			results := NoServiceChecker{
				IdentityDomain: "svc.cluster.local", IsGatewayToNamespace: tt.gatewayToNamespace,
				IstioConfigList: &models.IstioConfigList{
					Gateways: []*networkingv1.Gateway{gateway}, VirtualServices: []*networkingv1.VirtualService{vs},
				},
				ValidatingNamespace: tt.namespace,
				WorkloadsPerNamespace: map[string]models.Workloads{
					"bookinfo":     {data.CreateWorkload("bookinfo", "other", map[string]string{"app": "other"})},
					"istio-system": {data.CreateWorkload("istio-system", "egressgateway", map[string]string{"istio": "egressgateway"})},
				},
			}.Check()
			key := models.BuildKey(kubernetes.VirtualServices, vs.Name, vs.Namespace, "")
			require.Contains(t, results, key)
			assert.Equal(t, !tt.applies, results[key].Valid)
			var missingHost bool
			for _, check := range results[key].Checks {
				missingHost = missingHost || check.Code == "KIA1101"
			}
			assert.Equal(t, tt.applies, missingHost)
		})
	}
}

func BenchmarkNoServiceCheckerGatewayScope(b *testing.B) {
	for _, size := range []struct {
		gateways  int
		workloads int
	}{{gateways: 10, workloads: 100}, {gateways: 100, workloads: 1000}} {
		for _, gatewayRoute := range []bool{false, true} {
			b.Run(fmt.Sprintf("gateways=%d/workloads=%d/gateway_route=%t", size.gateways, size.workloads, gatewayRoute), func(b *testing.B) {
				vs := data.AddHttpRoutesToVirtualService(
					data.CreateHttpRouteDestination("external.example.com", "", 100),
					data.CreateEmptyVirtualService("vs", "default", []string{"external.example.com"}),
				)
				if gatewayRoute {
					vs.Spec.Gateways = []string{"default/gateway-0"}
				}
				checker := NoServiceChecker{
					IdentityDomain: "svc.cluster.local",
					IstioConfigList: &models.IstioConfigList{
						ServiceEntries:  []*networkingv1.ServiceEntry{data.CreateEmptyMeshExternalServiceEntry("external", "default", []string{"external.example.com"})},
						VirtualServices: []*networkingv1.VirtualService{vs},
					},
					ValidatingNamespace: "client", WorkloadsPerNamespace: map[string]models.Workloads{},
				}
				for i := 0; i < size.gateways; i++ {
					checker.IstioConfigList.Gateways = append(checker.IstioConfigList.Gateways,
						data.CreateEmptyGateway(fmt.Sprintf("gateway-%d", i), "default", map[string]string{"istio": "egressgateway"}))
				}
				for i := 0; i < size.workloads; i++ {
					checker.WorkloadsPerNamespace["client"] = append(checker.WorkloadsPerNamespace["client"],
						data.CreateWorkload("client", fmt.Sprintf("workload-%d", i), map[string]string{"app": "other"}))
				}
				b.ReportAllocs()
				b.ResetTimer()
				for i := 0; i < b.N; i++ {
					checker.Check()
				}
			})
		}
	}
}

func TestGatewayWorkloadScopeLazyCache(t *testing.T) {
	workload := data.CreateWorkload("client", "proxy", map[string]string{"role": "other"})
	checker := NoServiceChecker{
		IdentityDomain: "svc.cluster.local",
		IstioConfigList: &models.IstioConfigList{
			Gateways: []*networkingv1.Gateway{
				data.CreateEmptyGateway("first", "default", map[string]string{"role": "first"}),
				data.CreateEmptyGateway("second", "default", map[string]string{"role": "second"}),
			},
			VirtualServices: []*networkingv1.VirtualService{data.CreateEmptyVirtualService("vs", "default", nil)},
		},
		ValidatingNamespace: "client", WorkloadsPerNamespace: map[string]models.Workloads{"client": {workload}},
	}
	resolve := checker.gatewayWorkloadScope()
	require.NotNil(t, resolve)
	first := kubernetes.ParseHost("first", "default", checker.IdentityDomain)
	second := kubernetes.ParseHost("second", "default", checker.IdentityDomain)
	applies, known := resolve(first)
	assert.True(t, known)
	assert.False(t, applies)

	// Mutating the fixture verifies that resolved results are reused and that
	// unreferenced selectors have not been evaluated eagerly.
	workload.Labels["role"] = "first"
	applies, known = resolve(first)
	assert.True(t, known)
	assert.False(t, applies, "reuse the negative result")
	workload.Labels["role"] = "second"
	applies, known = resolve(second)
	assert.True(t, known)
	assert.True(t, applies, "resolve previously unreferenced gateways only when needed")
	workload.Labels["role"] = "other"
	applies, known = resolve(second)
	assert.True(t, known)
	assert.True(t, applies, "reuse the positive result")
	applies, known = checker.gatewayWorkloadScope()(second)
	assert.True(t, known)
	assert.False(t, applies, "a new validation gets a fresh cache")
	_, known = resolve(kubernetes.ParseHost("missing", "default", checker.IdentityDomain))
	assert.False(t, known, "unknown references retain their fallback")
}
