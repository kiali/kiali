package data

import (
	"strings"

	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// CreateFakeServicesWithSelector creates K8s Services for use with KubeServiceFQDNs.
func CreateFakeServicesWithSelector(service string, namespace string) []core_v1.Service {
	return []core_v1.Service{{
		ObjectMeta: metav1.ObjectMeta{Name: service, Namespace: namespace},
		Spec: core_v1.ServiceSpec{
			Selector: map[string]string{"app": service},
		},
	}}
}

// CreateFakeMultiServices creates K8s Services for use with KubeServiceFQDNs.
func CreateFakeMultiServices(hosts []string, namespace string) []core_v1.Service {
	result := make([]core_v1.Service, 0, len(hosts))
	for _, host := range hosts {
		name := strings.Split(host, ".")[0]
		result = append(result, core_v1.Service{
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace},
			Spec:       core_v1.ServiceSpec{},
		})
	}
	return result
}
