package checkers

import (
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
