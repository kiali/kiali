package models

import (
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/kubernetes"
)

func addObjectIgnoreValidationsFromObjects(
	rules ObjectIgnoreValidations,
	objects []client.Object,
	objectGVK schema.GroupVersionKind,
	cluster string,
) {
	for _, obj := range objects {
		rule, ok := ParseIgnoreValidationsAnnotation(obj.GetAnnotations())
		if !ok {
			continue
		}
		rules[BuildKey(objectGVK, obj.GetName(), obj.GetNamespace(), cluster)] = rule
	}
}

func (i *IstioConfigList) ObjectIgnoreValidations(cluster string) ObjectIgnoreValidations {
	rules := ObjectIgnoreValidations{}
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.AuthorizationPolicies), kubernetes.AuthorizationPolicies, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.DestinationRules), kubernetes.DestinationRules, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.EnvoyFilters), kubernetes.EnvoyFilters, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.Gateways), kubernetes.Gateways, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.K8sGateways), kubernetes.K8sGateways, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.K8sGRPCRoutes), kubernetes.K8sGRPCRoutes, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.K8sHTTPRoutes), kubernetes.K8sHTTPRoutes, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.K8sInferencePools), kubernetes.K8sInferencePools, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.K8sReferenceGrants), kubernetes.K8sReferenceGrants, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.K8sTCPRoutes), kubernetes.K8sTCPRoutes, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.K8sTLSRoutes), kubernetes.K8sTLSRoutes, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.PeerAuthentications), kubernetes.PeerAuthentications, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.RequestAuthentications), kubernetes.RequestAuthentications, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.ServiceEntries), kubernetes.ServiceEntries, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.Sidecars), kubernetes.Sidecars, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.Telemetries), kubernetes.Telemetries, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.TrafficExtensions), kubernetes.TrafficExtensions, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.VirtualServices), kubernetes.VirtualServices, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.WasmPlugins), kubernetes.WasmPlugins, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.WorkloadEntries), kubernetes.WorkloadEntries, cluster)
	addObjectIgnoreValidationsFromObjects(rules, asClientObjects(i.WorkloadGroups), kubernetes.WorkloadGroups, cluster)
	return rules
}

var (
	serviceValidationGVK  = schema.GroupVersionKind{Group: "", Version: "", Kind: "service"}
	workloadValidationGVK = schema.GroupVersionKind{Group: "", Version: "", Kind: "workload"}
)

func BuildServiceIgnoreValidations(services []core_v1.Service, cluster string) ObjectIgnoreValidations {
	rules := ObjectIgnoreValidations{}
	for _, service := range services {
		rule, ok := ParseIgnoreValidationsAnnotation(service.Annotations)
		if !ok {
			continue
		}
		rules[BuildKey(serviceValidationGVK, service.Name, service.Namespace, cluster)] = rule
	}
	return rules
}

func BuildWorkloadIgnoreValidations(workloadsPerNamespace map[string]Workloads, cluster string) ObjectIgnoreValidations {
	rules := ObjectIgnoreValidations{}
	for namespace, workloads := range workloadsPerNamespace {
		for _, workload := range workloads {
			rule, ok := ParseIgnoreValidationsAnnotation(workload.Annotations)
			if !ok {
				continue
			}
			rules[BuildKey(workloadValidationGVK, workload.Name, namespace, cluster)] = rule
		}
	}
	return rules
}
