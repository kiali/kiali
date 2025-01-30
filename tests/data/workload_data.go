package data

import (
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"

	networkingv1 "istio.io/api/networking/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

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

func CreateWorkloadGroups(conf config.Config) []*networking_v1.WorkloadGroup {
	appLabel := conf.IstioLabels.AppLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []*networking_v1.WorkloadGroup{
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.WorkloadGroups.GroupVersion().String(),
				Kind:       kubernetes.WorkloadGroups.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "ratings-vm",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: networkingv1.WorkloadGroup{
				Metadata: &networkingv1.WorkloadGroup_ObjectMeta{
					Labels: map[string]string{appLabel: "ratings-vm"},
				},
				Template: &networkingv1.WorkloadEntry{
					ServiceAccount: "bookinfo-ratings",
				},
			},
		},
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.WorkloadGroups.GroupVersion().String(),
				Kind:       kubernetes.WorkloadGroups.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "ratings-vm2",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: networkingv1.WorkloadGroup{
				Metadata: &networkingv1.WorkloadGroup_ObjectMeta{
					Labels: map[string]string{appLabel: "ratings-vm2"},
				},
				Template: &networkingv1.WorkloadEntry{
					ServiceAccount: "bookinfo-ratings",
				},
			},
		},
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.WorkloadGroups.GroupVersion().String(),
				Kind:       kubernetes.WorkloadGroups.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "ratings-vm-no-entry",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: networkingv1.WorkloadGroup{
				Metadata: &networkingv1.WorkloadGroup_ObjectMeta{
					Labels: map[string]string{appLabel: "ratings-vm-no-entry"},
				},
				Template: &networkingv1.WorkloadEntry{
					ServiceAccount: "bookinfo-ratings",
				},
			},
		},
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.WorkloadGroups.GroupVersion().String(),
				Kind:       kubernetes.WorkloadGroups.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "ratings-vm-no-labels",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: networkingv1.WorkloadGroup{
				Template: &networkingv1.WorkloadEntry{
					ServiceAccount: "bookinfo-ratings",
				},
			},
		},
	}
}

func CreateWorkloadGroupWithSA(sa string) *networking_v1.WorkloadGroup {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return &networking_v1.WorkloadGroup{
		TypeMeta: meta_v1.TypeMeta{
			APIVersion: kubernetes.WorkloadGroups.GroupVersion().String(),
			Kind:       kubernetes.WorkloadGroups.Kind,
		},
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "ratings-vm",
			Namespace:         "bookinfo",
			CreationTimestamp: meta_v1.NewTime(t1),
		},
		Spec: networkingv1.WorkloadGroup{
			Metadata: &networkingv1.WorkloadGroup_ObjectMeta{
				Labels: map[string]string{"app": "ratings-vm"},
			},
			Template: &networkingv1.WorkloadEntry{
				ServiceAccount: sa,
			},
		},
	}
}

func CreateWorkloadGroupWithLabels(namespace, name string, labels map[string]string) *networking_v1.WorkloadGroup {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return &networking_v1.WorkloadGroup{
		TypeMeta: meta_v1.TypeMeta{
			APIVersion: kubernetes.WorkloadGroups.GroupVersion().String(),
			Kind:       kubernetes.WorkloadGroups.Kind,
		},
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              name,
			Namespace:         namespace,
			CreationTimestamp: meta_v1.NewTime(t1),
		},
		Spec: networkingv1.WorkloadGroup{
			Metadata: &networkingv1.WorkloadGroup_ObjectMeta{
				Labels: labels,
			},
			Template: &networkingv1.WorkloadEntry{
				ServiceAccount: "sa",
			},
		},
	}
}

func CreateWorkloadGroupSidecars(conf config.Config) []*networking_v1.Sidecar {
	appLabel := conf.IstioLabels.AppLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []*networking_v1.Sidecar{
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.Sidecars.GroupVersion().String(),
				Kind:       kubernetes.Sidecars.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "bookinfo-ratings-vm",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
				Labels:            map[string]string{appLabel: "ratings-vm"},
			},
			Spec: networkingv1.Sidecar{
				WorkloadSelector: &networkingv1.WorkloadSelector{
					Labels: map[string]string{appLabel: "ratings-vm"},
				},
			},
		},
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.Sidecars.GroupVersion().String(),
				Kind:       kubernetes.Sidecars.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "bookinfo-ratings-vm2",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
				Labels:            map[string]string{appLabel: "ratings-vm2"},
			},
			Spec: networkingv1.Sidecar{
				WorkloadSelector: &networkingv1.WorkloadSelector{
					Labels: map[string]string{appLabel: "ratings-vm2"},
				},
			},
		},
	}
}

func CreateWorkloadEntries(conf config.Config) []*networking_v1.WorkloadEntry {
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	classLabel := "class"
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []*networking_v1.WorkloadEntry{
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.WorkloadEntries.GroupVersion().String(),
				Kind:       kubernetes.WorkloadEntries.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "ratings-vm",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: networkingv1.WorkloadEntry{
				Labels:         map[string]string{appLabel: "ratings-vm", classLabel: "vm", versionLabel: "v3"},
				Network:        "vm-us-east",
				ServiceAccount: "bookinfo-ratings",
			},
		},
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.WorkloadEntries.GroupVersion().String(),
				Kind:       kubernetes.WorkloadEntries.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "ratings-vm2",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: networkingv1.WorkloadEntry{
				Labels:         map[string]string{appLabel: "ratings-vm2", classLabel: "vm2", versionLabel: "v4"},
				Network:        "vm-us-east",
				ServiceAccount: "bookinfo-ratings",
			},
		},
	}
}
