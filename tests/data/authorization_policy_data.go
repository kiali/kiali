package data

import (
	api_security_v1 "istio.io/api/security/v1"
	api_v1beta1 "istio.io/api/type/v1beta1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
)

func CreateAuthorizationPolicy(sourceNamespaces, operationMethods, operationHosts []string, selector map[string]string) *security_v1.AuthorizationPolicy {
	ap := security_v1.AuthorizationPolicy{}
	ap.Name = "auth-policy"
	ap.Namespace = "bookinfo"
	ap.Spec.Selector = &api_v1beta1.WorkloadSelector{
		MatchLabels: selector,
	}
	ap.Spec.Rules = []*api_security_v1.Rule{
		{
			From: []*api_security_v1.Rule_From{
				{
					Source: &api_security_v1.Source{
						Namespaces: sourceNamespaces,
					},
				},
			},
			To: []*api_security_v1.Rule_To{
				{
					Operation: &api_security_v1.Operation{
						Methods: operationMethods,
						Hosts:   operationHosts,
					},
				},
			},
			When: []*api_security_v1.Condition{
				{
					Key:    "request.headers",
					Values: []string{"HTTP"},
				},
			},
		},
	}
	return &ap
}

func CreateEmptyAuthorizationPolicy(name, namespace string) *security_v1.AuthorizationPolicy {
	ap := security_v1.AuthorizationPolicy{}
	ap.Name = name
	ap.Namespace = namespace
	ap.Spec = api_security_v1.AuthorizationPolicy{}
	return &ap
}

func CreateEmptyMeshAuthorizationPolicy(name string) *security_v1.AuthorizationPolicy {
	return CreateEmptyAuthorizationPolicy(name, "istio-system")
}

func CreateAuthorizationPolicyWithMetaAndSelector(name, namespace string, selector map[string]string) *security_v1.AuthorizationPolicy {
	ap := security_v1.AuthorizationPolicy{}
	ap.Name = name
	ap.Namespace = namespace
	ap.Spec.Selector = &api_v1beta1.WorkloadSelector{
		MatchLabels: selector,
	}
	return &ap
}

func CreateAuthorizationPolicyWithPrincipals(name, namespace string, principalsList []string) *security_v1.AuthorizationPolicy {
	ap := security_v1.AuthorizationPolicy{}
	ap.Name = name
	ap.Namespace = namespace
	ap.Spec.Rules = []*api_security_v1.Rule{
		{
			From: []*api_security_v1.Rule_From{
				{
					Source: &api_security_v1.Source{
						Principals: principalsList,
					},
				},
			},
		},
	}
	return &ap
}
