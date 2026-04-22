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
)

func TestWorkloadMtlsStatus(t *testing.T) {
	defaultDomain := "svc.cluster.local"

	cases := map[string]struct {
		status         MtlsStatus
		identityDomain string
		expected       string
	}{
		"strict PA": {
			status: MtlsStatus{
				PeerAuthentications: []*security_v1.PeerAuthentication{
					peerAuthnWithSelector("pa1", "bookinfo", map[string]string{"app": "reviews"}, "STRICT"),
				},
				MatchingLabels: labels.Set{"app": "reviews"},
				Services:       []core_v1.Service{},
			},
			identityDomain: defaultDomain,
			expected:       MTLSEnabled,
		},
		"disabled PA": {
			status: MtlsStatus{
				PeerAuthentications: []*security_v1.PeerAuthentication{
					peerAuthnWithSelector("pa1", "bookinfo", map[string]string{"app": "reviews"}, "DISABLE"),
				},
				MatchingLabels: labels.Set{"app": "reviews"},
				Services:       []core_v1.Service{},
			},
			identityDomain: defaultDomain,
			expected:       MTLSDisabled,
		},
		"permissive with matching ISTIO_MUTUAL DR": {
			status: MtlsStatus{
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
			},
			identityDomain: defaultDomain,
			expected:       MTLSEnabled,
		},
		"permissive with matching MUTUAL DR": {
			status: MtlsStatus{
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
			},
			identityDomain: defaultDomain,
			expected:       MTLSEnabled,
		},
		"permissive with no DR": {
			status: MtlsStatus{
				PeerAuthentications: []*security_v1.PeerAuthentication{
					peerAuthnWithSelector("pa1", "bookinfo", map[string]string{"app": "reviews"}, "PERMISSIVE"),
				},
				DestinationRules: []*networking_v1.DestinationRule{},
				MatchingLabels:   labels.Set{"app": "reviews"},
				Services: []core_v1.Service{
					k8sService("reviews", "bookinfo", map[string]string{"app": "reviews"}),
				},
			},
			identityDomain: defaultDomain,
			expected:       MTLSNotEnabled,
		},
		"permissive with disabled DR": {
			status: MtlsStatus{
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
			},
			identityDomain: defaultDomain,
			expected:       MTLSDisabled,
		},
		"PA selector does not match workload": {
			status: MtlsStatus{
				PeerAuthentications: []*security_v1.PeerAuthentication{
					peerAuthnWithSelector("pa1", "bookinfo", map[string]string{"app": "ratings"}, "STRICT"),
				},
				MatchingLabels: labels.Set{"app": "reviews"},
				Services:       []core_v1.Service{},
			},
			identityDomain: defaultDomain,
			expected:       MTLSNotEnabled,
		},
		"no-selector PA skipped": {
			status: MtlsStatus{
				PeerAuthentications: []*security_v1.PeerAuthentication{
					peerAuthnNoSelector("pa-mesh", "istio-system", "STRICT"),
				},
				MatchingLabels: labels.Set{"app": "reviews"},
				Services:       []core_v1.Service{},
			},
			identityDomain: defaultDomain,
			expected:       MTLSNotEnabled,
		},
		"nil MatchLabels PA skipped": {
			status: MtlsStatus{
				PeerAuthentications: []*security_v1.PeerAuthentication{{
					ObjectMeta: meta_v1.ObjectMeta{Name: "pa-expressions", Namespace: "bookinfo"},
					Spec: api_security_v1.PeerAuthentication{
						Selector: &api_type_v1beta1.WorkloadSelector{MatchLabels: nil},
						Mtls: &api_security_v1.PeerAuthentication_MutualTLS{
							Mode: api_security_v1.PeerAuthentication_MutualTLS_STRICT,
						},
					},
				}},
				MatchingLabels: labels.Set{"app": "reviews"},
				Services: []core_v1.Service{
					k8sService("reviews", "bookinfo", map[string]string{"app": "reviews"}),
				},
			},
			identityDomain: defaultDomain,
			expected:       MTLSNotEnabled,
		},
		"permissive with service from wrong namespace ignored": {
			status: MtlsStatus{
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
			},
			identityDomain: defaultDomain,
			expected:       MTLSNotEnabled,
		},
		"permissive with service selector mismatch": {
			status: MtlsStatus{
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
			},
			identityDomain: defaultDomain,
			expected:       MTLSNotEnabled,
		},
		"permissive with service having no selector": {
			status: MtlsStatus{
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
			},
			identityDomain: defaultDomain,
			expected:       MTLSNotEnabled,
		},
		"strict PA with non-default domain": {
			status: MtlsStatus{
				PeerAuthentications: []*security_v1.PeerAuthentication{
					peerAuthnWithSelector("pa1", "bookinfo", map[string]string{"app": "reviews"}, "STRICT"),
				},
				MatchingLabels: labels.Set{"app": "reviews"},
				Services:       []core_v1.Service{},
			},
			identityDomain: "svc.example.org",
			expected:       MTLSEnabled,
		},
		"permissive with matching DR and non-default domain": {
			status: MtlsStatus{
				PeerAuthentications: []*security_v1.PeerAuthentication{
					peerAuthnWithSelector("pa1", "bookinfo", map[string]string{"app": "reviews"}, "PERMISSIVE"),
				},
				DestinationRules: []*networking_v1.DestinationRule{
					destinationRuleWithMTLS("dr1", "bookinfo", "reviews.bookinfo.svc.example.org", "ISTIO_MUTUAL"),
				},
				MatchingLabels: labels.Set{"app": "reviews"},
				Services: []core_v1.Service{
					k8sService("reviews", "bookinfo", map[string]string{"app": "reviews"}),
				},
			},
			identityDomain: "svc.example.org",
			expected:       MTLSEnabled,
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tc.expected, tc.status.WorkloadMtlsStatus("bookinfo", tc.identityDomain))
		})
	}
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
