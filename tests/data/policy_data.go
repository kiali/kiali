package data

import (
	"fmt"
	"math/rand/v2"

	api_security_v1 "istio.io/api/security/v1"
	api_security_v1beta1 "istio.io/api/security/v1beta1"
	api_v1beta1 "istio.io/api/type/v1beta1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
)

func CreateEmptyPeerAuthentication(name, namespace string, mtls *api_security_v1.PeerAuthentication_MutualTLS) *security_v1.PeerAuthentication {
	pa := security_v1.PeerAuthentication{}
	pa.Name = name
	pa.Namespace = namespace
	pa.ResourceVersion = fmt.Sprintf("%d", rand.Int64())
	pa.Spec.Mtls = mtls
	return &pa
}

func CreateEmptyMeshPeerAuthentication(name string, mtls *api_security_v1.PeerAuthentication_MutualTLS) *security_v1.PeerAuthentication {
	return CreateEmptyPeerAuthentication(name, "istio-system", mtls)
}

func CreateEmptyPeerAuthenticationWithSelector(name, namespace string, selector map[string]string) *security_v1.PeerAuthentication {
	pa := security_v1.PeerAuthentication{}
	pa.Name = name
	pa.Namespace = namespace
	pa.Spec.Selector = &api_v1beta1.WorkloadSelector{
		MatchLabels: selector,
	}
	return &pa
}

func AddSelectorToPeerAuthn(selector map[string]string, mp *security_v1.PeerAuthentication) *security_v1.PeerAuthentication {
	mp.Spec.Selector = &api_v1beta1.WorkloadSelector{
		MatchLabels: selector,
	}
	return mp
}

func CreateMTLS(mode string) *api_security_v1.PeerAuthentication_MutualTLS {
	mtls := api_security_v1.PeerAuthentication_MutualTLS{}
	if m, ok := api_security_v1beta1.PeerAuthentication_MutualTLS_Mode_value[mode]; ok {
		mtls.Mode = api_security_v1.PeerAuthentication_MutualTLS_Mode(m)
	}
	return &mtls
}

func CreateOneLabelSelector(value string) map[string]string {
	return map[string]string{
		"app": value,
	}
}
