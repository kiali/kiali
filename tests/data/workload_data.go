package data

import "github.com/kiali/kiali/models"

func CreateWorkloadsPerNamespace(namespaces []string, items ...models.WorkloadListItem) map[string]models.WorkloadList {
	allWorkloads := map[string]models.WorkloadList{}
	for _, namespace := range namespaces {
		allWorkloads[namespace] = CreateWorkloadList(namespace, items...)
	}
	return allWorkloads
}

func CreateWorkloadList(namespace string, items ...models.WorkloadListItem) models.WorkloadList {
	return models.WorkloadList{
		Namespace: namespace,
		Workloads: items,
	}
}

func CreateWorkloadListItem(name string, labels map[string]string) models.WorkloadListItem {
	wli := models.WorkloadListItem{
		Name:   name,
		Labels: labels,
	}

	if _, found := labels["app"]; found {
		wli.AppLabel = true
	}

	if _, found := labels["version"]; found {
		wli.VersionLabel = true
	}

	return wli
}
