package data

import "github.com/kiali/kiali/models"

func CreateWorkloadList(namespace string, items ...models.WorkloadListItem) models.WorkloadList {
	return models.WorkloadList{
		Namespace: models.Namespace{Name: namespace},
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
