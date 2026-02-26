package mtls

import (
	"testing"

	"github.com/stretchr/testify/assert"
	api_networking_v1 "istio.io/api/networking/v1"
	api_security_v1 "istio.io/api/security/v1"
	api_type_v1beta1 "istio.io/api/type/v1beta1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
)

func TestWorkloadMtlsStatusStrictPA(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	status := MtlsStatus{
		PeerAuthentications: []*security_v1.PeerAuthentication{
			peerAuthnWithSelector("pa1", "bookinfo", map[string]string{"app": "reviews"}, "STRICT"),
		},
		MatchingLabels: labels.Set{"app": "reviews"},
		Services:       []core_v1.Service{},
	}

	assert.Equal(MTLSEnabled, status.WorkloadMtlsStatus("bookinfo", conf))
}

func TestWorkloadMtlsStatusDisabledPA(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	status := MtlsStatus{
		PeerAuthentications: []*security_v1.PeerAuthentication{
			peerAuthnWithSelector("pa1", "bookinfo", map[string]string{"app": "reviews"}, "DISABLE"),
		},
		MatchingLabels: labels.Set{"app": "reviews"},
		Services:       []core_v1.Service{},
	}

	assert.Equal(MTLSDisabled, status.WorkloadMtlsStatus("bookinfo", conf))
}

func TestWorkloadMtlsStatusPermissiveWithMatchingDR(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	status := MtlsStatus{
		PeerAuthentications: []*security_v1.PeerAuthentication{
			peerAuthnWithSelector("pa1", "bookinfo", map[string]string{"app": "reviews"}, "PERMISSIVE"),
		},
		DestinationRules: []*networking_v1.DestinationRule{
			destinationRuleWithMTLS("dr1", "bookinfo", "reviews.bookinfo.svc.cluster.local", "ISTIO_MUTUAL"),
		},
		MatchingLabels: labels.Set{"app": "reviews"},
		Services: []core_v1.Service{
			k8sService("reviews", "bookinfo", map[string]string{"app": "reviews"}),
		},
	}

	assert.Equal(MTLSEnabled, status.WorkloadMtlsStatus("bookinfo", conf))
}

func TestWorkloadMtlsStatusPermissiveWithMutualDR(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	status := MtlsStatus{
		PeerAuthentications: []*security_v1.PeerAuthentication{
			peerAuthnWithSelector("pa1", "bookinfo", map[string]string{"app": "reviews"}, "PERMISSIVE"),
		},
		DestinationRules: []*networking_v1.DestinationRule{
			destinationRuleWithMTLS("dr1", "bookinfo", "reviews.bookinfo.svc.cluster.local", "MUTUAL"),
		},
		MatchingLabels: labels.Set{"app": "reviews"},
		Services: []core_v1.Service{
			k8sService("reviews", "bookinfo", map[string]string{"app": "reviews"}),
		},
	}

	assert.Equal(MTLSEnabled, status.WorkloadMtlsStatus("bookinfo", conf))
}

func TestWorkloadMtlsStatusPermissiveNoDR(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	status := MtlsStatus{
		PeerAuthentications: []*security_v1.PeerAuthentication{
			peerAuthnWithSelector("pa1", "bookinfo", map[string]string{"app": "reviews"}, "PERMISSIVE"),
		},
		DestinationRules: []*networking_v1.DestinationRule{},
		MatchingLabels:   labels.Set{"app": "reviews"},
		Services: []core_v1.Service{
			k8sService("reviews", "bookinfo", map[string]string{"app": "reviews"}),
		},
	}

	assert.Equal(MTLSNotEnabled, status.WorkloadMtlsStatus("bookinfo", conf))
}

func TestWorkloadMtlsStatusPermissiveDisabledDR(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	status := MtlsStatus{
		PeerAuthentications: []*security_v1.PeerAuthentication{
			peerAuthnWithSelector("pa1", "bookinfo", map[string]string{"app": "reviews"}, "PERMISSIVE"),
		},
		DestinationRules: []*networking_v1.DestinationRule{
			destinationRuleWithMTLS("dr1", "bookinfo", "reviews.bookinfo.svc.cluster.local", "DISABLE"),
		},
		MatchingLabels: labels.Set{"app": "reviews"},
		Services: []core_v1.Service{
			k8sService("reviews", "bookinfo", map[string]string{"app": "reviews"}),
		},
	}

	assert.Equal(MTLSDisabled, status.WorkloadMtlsStatus("bookinfo", conf))
}

func TestWorkloadMtlsStatusPASelectorDoesNotMatchWorkload(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	status := MtlsStatus{
		PeerAuthentications: []*security_v1.PeerAuthentication{
			peerAuthnWithSelector("pa1", "bookinfo", map[string]string{"app": "ratings"}, "STRICT"),
		},
		MatchingLabels: labels.Set{"app": "reviews"},
		Services:       []core_v1.Service{},
	}

	assert.Equal(MTLSNotEnabled, status.WorkloadMtlsStatus("bookinfo", conf))
}

func TestWorkloadMtlsStatusNoSelectorPASkipped(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	status := MtlsStatus{
		PeerAuthentications: []*security_v1.PeerAuthentication{
			peerAuthnNoSelector("pa-mesh", "istio-system", "STRICT"),
		},
		MatchingLabels: labels.Set{"app": "reviews"},
		Services:       []core_v1.Service{},
	}

	assert.Equal(MTLSNotEnabled, status.WorkloadMtlsStatus("bookinfo", conf))
}

// Verifies the fix for PAs that have a Selector with only MatchExpressions and
// no MatchLabels. Before the fix, labels.Set(nil).AsSelector() produced an
// empty selector that matches everything, sweeping in all services.
func TestWorkloadMtlsStatusNilMatchLabelsSkipped(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	pa := &security_v1.PeerAuthentication{
		ObjectMeta: meta_v1.ObjectMeta{Name: "pa-expressions", Namespace: "bookinfo"},
		Spec: api_security_v1.PeerAuthentication{
			Selector: &api_type_v1beta1.WorkloadSelector{
				MatchLabels: nil,
			},
			Mtls: &api_security_v1.PeerAuthentication_MutualTLS{
				Mode: api_security_v1.PeerAuthentication_MutualTLS_STRICT,
			},
		},
	}

	status := MtlsStatus{
		PeerAuthentications: []*security_v1.PeerAuthentication{pa},
		MatchingLabels:      labels.Set{"app": "reviews"},
		Services: []core_v1.Service{
			k8sService("reviews", "bookinfo", map[string]string{"app": "reviews"}),
		},
	}

	assert.Equal(MTLSNotEnabled, status.WorkloadMtlsStatus("bookinfo", conf))
}

// Verifies that services from other namespaces are not matched in the
// PERMISSIVE DR lookup.
func TestWorkloadMtlsStatusPermissiveServiceWrongNamespaceIgnored(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	status := MtlsStatus{
		PeerAuthentications: []*security_v1.PeerAuthentication{
			peerAuthnWithSelector("pa1", "bookinfo", map[string]string{"app": "reviews"}, "PERMISSIVE"),
		},
		DestinationRules: []*networking_v1.DestinationRule{
			destinationRuleWithMTLS("dr1", "other-ns", "reviews.other-ns.svc.cluster.local", "ISTIO_MUTUAL"),
		},
		MatchingLabels: labels.Set{"app": "reviews"},
		Services: []core_v1.Service{
			k8sService("reviews", "other-ns", map[string]string{"app": "reviews"}),
		},
	}

	assert.Equal(MTLSNotEnabled, status.WorkloadMtlsStatus("bookinfo", conf))
}

// Verifies that services whose Spec.Selector does not match the PA selector
// are not considered.
func TestWorkloadMtlsStatusPermissiveServiceSelectorMismatch(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	status := MtlsStatus{
		PeerAuthentications: []*security_v1.PeerAuthentication{
			peerAuthnWithSelector("pa1", "bookinfo", map[string]string{"app": "reviews"}, "PERMISSIVE"),
		},
		DestinationRules: []*networking_v1.DestinationRule{
			destinationRuleWithMTLS("dr1", "bookinfo", "ratings.bookinfo.svc.cluster.local", "ISTIO_MUTUAL"),
		},
		MatchingLabels: labels.Set{"app": "reviews"},
		Services: []core_v1.Service{
			k8sService("ratings", "bookinfo", map[string]string{"app": "ratings"}),
		},
	}

	assert.Equal(MTLSNotEnabled, status.WorkloadMtlsStatus("bookinfo", conf))
}

// Verifies services with no Spec.Selector are skipped.
func TestWorkloadMtlsStatusPermissiveServiceNoSelector(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	status := MtlsStatus{
		PeerAuthentications: []*security_v1.PeerAuthentication{
			peerAuthnWithSelector("pa1", "bookinfo", map[string]string{"app": "reviews"}, "PERMISSIVE"),
		},
		DestinationRules: []*networking_v1.DestinationRule{
			destinationRuleWithMTLS("dr1", "bookinfo", "reviews.bookinfo.svc.cluster.local", "ISTIO_MUTUAL"),
		},
		MatchingLabels: labels.Set{"app": "reviews"},
		Services: []core_v1.Service{{
			ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo"},
			Spec:       core_v1.ServiceSpec{},
		}},
	}

	assert.Equal(MTLSNotEnabled, status.WorkloadMtlsStatus("bookinfo", conf))
}

func peerAuthnWithSelector(name, namespace string, selectorLabels map[string]string, mode string) *security_v1.PeerAuthentication {
	return &security_v1.PeerAuthentication{
		ObjectMeta: meta_v1.ObjectMeta{Name: name, Namespace: namespace},
		Spec: api_security_v1.PeerAuthentication{
			Selector: &api_type_v1beta1.WorkloadSelector{
				MatchLabels: selectorLabels,
			},
			Mtls: &api_security_v1.PeerAuthentication_MutualTLS{
				Mode: parsePAMode(mode),
			},
		},
	}
}

func peerAuthnNoSelector(name, namespace, mode string) *security_v1.PeerAuthentication {
	return &security_v1.PeerAuthentication{
		ObjectMeta: meta_v1.ObjectMeta{Name: name, Namespace: namespace},
		Spec: api_security_v1.PeerAuthentication{
			Mtls: &api_security_v1.PeerAuthentication_MutualTLS{
				Mode: parsePAMode(mode),
			},
		},
	}
}

func parsePAMode(mode string) api_security_v1.PeerAuthentication_MutualTLS_Mode {
	switch mode {
	case "STRICT":
		return api_security_v1.PeerAuthentication_MutualTLS_STRICT
	case "PERMISSIVE":
		return api_security_v1.PeerAuthentication_MutualTLS_PERMISSIVE
	case "DISABLE":
		return api_security_v1.PeerAuthentication_MutualTLS_DISABLE
	default:
		return api_security_v1.PeerAuthentication_MutualTLS_UNSET
	}
}

func destinationRuleWithMTLS(name, namespace, host, mode string) *networking_v1.DestinationRule {
	return &networking_v1.DestinationRule{
		ObjectMeta: meta_v1.ObjectMeta{Name: name, Namespace: namespace},
		Spec: api_networking_v1.DestinationRule{
			Host: host,
			TrafficPolicy: &api_networking_v1.TrafficPolicy{
				Tls: &api_networking_v1.ClientTLSSettings{
					Mode: parseDRMode(mode),
				},
			},
		},
	}
}

func parseDRMode(mode string) api_networking_v1.ClientTLSSettings_TLSmode {
	switch mode {
	case "ISTIO_MUTUAL":
		return api_networking_v1.ClientTLSSettings_ISTIO_MUTUAL
	case "MUTUAL":
		return api_networking_v1.ClientTLSSettings_MUTUAL
	case "DISABLE":
		return api_networking_v1.ClientTLSSettings_DISABLE
	default:
		return api_networking_v1.ClientTLSSettings_DISABLE
	}
}

func k8sService(name, namespace string, selector map[string]string) core_v1.Service {
	return core_v1.Service{
		ObjectMeta: meta_v1.ObjectMeta{Name: name, Namespace: namespace},
		Spec: core_v1.ServiceSpec{
			Selector: selector,
		},
	}
}
