package business

import (
	"fmt"
	"io"
	"os"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/log"

	osapps_v1 "github.com/openshift/api/apps/v1"

	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Consolidate fake/mock data used in tests per package

func FakeDeployments(conf config.Config) []apps_v1.Deployment {
	appLabelName := conf.IstioLabels.AppLabelName
	versionLabelName := conf.IstioLabels.VersionLabelName
	if appLabelName == "" {
		appLabelName = "app"
		versionLabelName = "version"
	}

	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []apps_v1.Deployment{
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.Deployments.GroupVersion().String(),
				Kind:       kubernetes.Deployments.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v1",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabelName: "httpbin"},
					},
				},
			},
			Status: apps_v1.DeploymentStatus{
				Replicas:            1,
				AvailableReplicas:   1,
				UnavailableReplicas: 0,
			},
		},
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.Deployments.GroupVersion().String(),
				Kind:       kubernetes.Deployments.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v2",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabelName: "httpbin", versionLabelName: "v2"},
					},
				},
			},
			Status: apps_v1.DeploymentStatus{
				Replicas:            2,
				AvailableReplicas:   1,
				UnavailableReplicas: 1,
			},
		},
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.Deployments.GroupVersion().String(),
				Kind:       kubernetes.Deployments.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v3",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{},
					},
				},
			},
			Status: apps_v1.DeploymentStatus{
				Replicas:            2,
				AvailableReplicas:   0,
				UnavailableReplicas: 2,
			},
		},
	}
}

func FakeDuplicatedDeployments() []apps_v1.Deployment {
	conf := config.NewConfig()

	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []apps_v1.Deployment{
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.Deployments.GroupVersion().String(),
				Kind:       kubernetes.Deployments.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "duplicated-v1",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "duplicated", versionLabel: "v1"},
					},
				},
			},
			Status: apps_v1.DeploymentStatus{
				Replicas:            1,
				AvailableReplicas:   1,
				UnavailableReplicas: 0,
			},
		},
	}
}

func FakeReplicaSets(conf config.Config) []apps_v1.ReplicaSet {
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []apps_v1.ReplicaSet{
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.ReplicaSets.GroupVersion().String(),
				Kind:       kubernetes.ReplicaSets.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v1",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: apps_v1.ReplicaSetSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "httpbin"},
					},
				},
			},
			Status: apps_v1.ReplicaSetStatus{
				Replicas:          1,
				AvailableReplicas: 1,
				ReadyReplicas:     1,
			},
		},
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.ReplicaSets.GroupVersion().String(),
				Kind:       kubernetes.ReplicaSets.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v2",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: apps_v1.ReplicaSetSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "httpbin", versionLabel: "v2"},
					},
				},
			},
			Status: apps_v1.ReplicaSetStatus{
				Replicas:          2,
				AvailableReplicas: 1,
				ReadyReplicas:     1,
			},
		},
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.ReplicaSets.GroupVersion().String(),
				Kind:       kubernetes.ReplicaSets.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v3",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: apps_v1.ReplicaSetSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{},
					},
				},
			},
			Status: apps_v1.ReplicaSetStatus{
				Replicas:          2,
				AvailableReplicas: 0,
				ReadyReplicas:     2,
			},
		},
	}
}

func FakeDuplicatedReplicaSets() []apps_v1.ReplicaSet {
	conf := config.NewConfig()

	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	controller := true
	return []apps_v1.ReplicaSet{
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.ReplicaSets.GroupVersion().String(),
				Kind:       kubernetes.ReplicaSets.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "duplicated-v1-12345",

				CreationTimestamp: meta_v1.NewTime(t1),
				OwnerReferences: []meta_v1.OwnerReference{{
					Controller: &controller,
					APIVersion: kubernetes.Deployments.GroupVersion().String(),
					Kind:       kubernetes.Deployments.Kind,
					Name:       "duplicated-v1",
				}},
			},
			Spec: apps_v1.ReplicaSetSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "duplicated", versionLabel: "v1"},
					},
				},
			},
			Status: apps_v1.ReplicaSetStatus{
				Replicas:          1,
				AvailableReplicas: 1,
				ReadyReplicas:     1,
			},
		},
	}
}

func FakeReplicationControllers(conf *config.Config) []core_v1.ReplicationController {
	// Enable ReplicationController, those are not fetched by default
	conf.KubernetesConfig.ExcludeWorkloads = []string{}

	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []core_v1.ReplicationController{
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.ReplicationControllers.GroupVersion().String(),
				Kind:       kubernetes.ReplicationControllers.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v1",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: core_v1.ReplicationControllerSpec{
				Template: &core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "httpbin"},
					},
				},
			},
			Status: core_v1.ReplicationControllerStatus{
				Replicas:          1,
				AvailableReplicas: 1,
				ReadyReplicas:     1,
			},
		},
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.ReplicationControllers.GroupVersion().String(),
				Kind:       kubernetes.ReplicationControllers.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v2",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: core_v1.ReplicationControllerSpec{
				Template: &core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "httpbin", versionLabel: "v2"},
					},
				},
			},
			Status: core_v1.ReplicationControllerStatus{
				Replicas:          2,
				AvailableReplicas: 1,
				ReadyReplicas:     1,
			},
		},
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.ReplicationControllers.GroupVersion().String(),
				Kind:       kubernetes.ReplicationControllers.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v3",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: core_v1.ReplicationControllerSpec{
				Template: &core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{},
					},
				},
			},
			Status: core_v1.ReplicationControllerStatus{
				Replicas:          2,
				AvailableReplicas: 0,
				ReadyReplicas:     2,
			},
		},
	}
}

func FakeDeploymentConfigs(conf *config.Config) []osapps_v1.DeploymentConfig {
	conf.KubernetesConfig.ExcludeWorkloads = []string{}

	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []osapps_v1.DeploymentConfig{
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.DeploymentConfigs.GroupVersion().String(),
				Kind:       kubernetes.DeploymentConfigs.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v1",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: osapps_v1.DeploymentConfigSpec{
				Template: &core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "httpbin"},
					},
				},
			},
			Status: osapps_v1.DeploymentConfigStatus{
				Replicas:            1,
				AvailableReplicas:   1,
				UnavailableReplicas: 0,
			},
		},
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.DeploymentConfigs.GroupVersion().String(),
				Kind:       kubernetes.DeploymentConfigs.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v2",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: osapps_v1.DeploymentConfigSpec{
				Template: &core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "httpbin", versionLabel: "v2"},
					},
				},
			},
			Status: osapps_v1.DeploymentConfigStatus{
				Replicas:            2,
				AvailableReplicas:   1,
				UnavailableReplicas: 1,
			},
		},
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.DeploymentConfigs.GroupVersion().String(),
				Kind:       kubernetes.DeploymentConfigs.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v3",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: osapps_v1.DeploymentConfigSpec{
				Template: &core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{},
					},
				},
			},
			Status: osapps_v1.DeploymentConfigStatus{
				Replicas:            2,
				AvailableReplicas:   0,
				UnavailableReplicas: 2,
			},
		},
	}
}

func FakeStatefulSets(conf *config.Config) []apps_v1.StatefulSet {
	conf.KubernetesConfig.ExcludeWorkloads = []string{}

	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []apps_v1.StatefulSet{
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.StatefulSets.GroupVersion().String(),
				Kind:       kubernetes.StatefulSets.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v1",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: apps_v1.StatefulSetSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "httpbin"},
					},
				},
			},
			Status: apps_v1.StatefulSetStatus{
				Replicas:      1,
				ReadyReplicas: 1,
			},
		},
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.StatefulSets.GroupVersion().String(),
				Kind:       kubernetes.StatefulSets.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v2",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: apps_v1.StatefulSetSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "httpbin", versionLabel: "v2"},
					},
				},
			},
			Status: apps_v1.StatefulSetStatus{
				Replicas:      2,
				ReadyReplicas: 1,
			},
		},
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.StatefulSets.GroupVersion().String(),
				Kind:       kubernetes.StatefulSets.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v3",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: apps_v1.StatefulSetSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{},
					},
				},
			},
			Status: apps_v1.StatefulSetStatus{
				Replicas:      2,
				ReadyReplicas: 2,
			},
		},
	}
}

func FakeDaemonSets(conf *config.Config) []apps_v1.DaemonSet {
	conf.KubernetesConfig.ExcludeWorkloads = []string{}

	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []apps_v1.DaemonSet{
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.DaemonSets.GroupVersion().String(),
				Kind:       kubernetes.DaemonSets.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v1",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: apps_v1.DaemonSetSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "httpbin"},
					},
				},
			},
			Status: apps_v1.DaemonSetStatus{
				DesiredNumberScheduled: 1,
				CurrentNumberScheduled: 1,
				NumberAvailable:        1,
			},
		},
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.DaemonSets.GroupVersion().String(),
				Kind:       kubernetes.DaemonSets.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v2",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: apps_v1.DaemonSetSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "httpbin", versionLabel: "v2"},
					},
				},
			},
			Status: apps_v1.DaemonSetStatus{
				DesiredNumberScheduled: 2,
				CurrentNumberScheduled: 1,
				NumberAvailable:        1,
			},
		},
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.DaemonSets.GroupVersion().String(),
				Kind:       kubernetes.DaemonSets.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v3",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: apps_v1.DaemonSetSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{},
					},
				},
			},
			Status: apps_v1.DaemonSetStatus{
				DesiredNumberScheduled: 2,
				CurrentNumberScheduled: 2,
				NumberAvailable:        2,
			},
		},
	}
}

func FakeDuplicatedStatefulSets(conf *config.Config) []apps_v1.StatefulSet {
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []apps_v1.StatefulSet{
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.StatefulSets.GroupVersion().String(),
				Kind:       kubernetes.StatefulSets.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "duplicated-v1",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: apps_v1.StatefulSetSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "duplicated", versionLabel: "v1"},
					},
				},
			},
			Status: apps_v1.StatefulSetStatus{
				Replicas:      1,
				ReadyReplicas: 1,
			},
		},
	}
}

func FakeDepSyncedWithRS(conf *config.Config) []apps_v1.Deployment {
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []apps_v1.Deployment{
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.Deployments.GroupVersion().String(),
				Kind:       kubernetes.Deployments.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "details-v1",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "details", versionLabel: "v1"},
					},
				},
			},
			Status: apps_v1.DeploymentStatus{
				Replicas:            1,
				AvailableReplicas:   1,
				UnavailableReplicas: 0,
			},
		},
	}
}

func FakeRSSyncedWithPods(conf *config.Config) []apps_v1.ReplicaSet {
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	controller := true
	return []apps_v1.ReplicaSet{
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.ReplicaSets.GroupVersion().String(),
				Kind:       kubernetes.ReplicaSets.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "details-v1-3618568057",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
				OwnerReferences: []meta_v1.OwnerReference{{
					Controller: &controller,
					APIVersion: kubernetes.Deployments.GroupVersion().String(),
					Kind:       kubernetes.Deployments.Kind,
					Name:       "details-v1",
				}},
			},
			Spec: apps_v1.ReplicaSetSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "details", versionLabel: "v1"},
					},
				},
			},
			Status: apps_v1.ReplicaSetStatus{
				Replicas:          1,
				AvailableReplicas: 1,
				ReadyReplicas:     0,
			},
		},
	}
}

func FakePodsSyncedWithDeployments(conf *config.Config) []core_v1.Pod {
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	controller := true
	return []core_v1.Pod{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "details-v1-3618568057-dnkjp",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
				Labels:            map[string]string{appLabel: "httpbin", versionLabel: "v1"},
				OwnerReferences: []meta_v1.OwnerReference{{
					Controller: &controller,
					APIVersion: kubernetes.ReplicaSets.GroupVersion().String(),
					Kind:       kubernetes.ReplicaSets.Kind,
					Name:       "details-v1-3618568057",
				}},
				Annotations: kubetest.FakeIstioAnnotations(),
			},
			Spec: core_v1.PodSpec{
				Containers: []core_v1.Container{
					{Name: "details", Image: "whatever"},
					{Name: "istio-proxy", Image: "docker.io/istio/proxy:0.7.1"},
				},
				InitContainers: []core_v1.Container{
					{Name: "istio-init", Image: "docker.io/istio/proxy_init:0.7.1"},
					{Name: "enable-core-dump", Image: "alpine"},
				},
			},
		},
	}
}

func FakePodSyncedWithDeployments(conf *config.Config) *core_v1.Pod {
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	controller := true
	return &core_v1.Pod{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "details-v1-3618568057-dnkjp",
			Namespace:         "Namespace",
			CreationTimestamp: meta_v1.NewTime(t1),
			Labels:            map[string]string{appLabel: "httpbin", versionLabel: "v1"},
			OwnerReferences: []meta_v1.OwnerReference{{
				Controller: &controller,
				APIVersion: kubernetes.ReplicaSets.GroupVersion().String(),
				Kind:       kubernetes.ReplicaSets.Kind,
				Name:       "details-v1-3618568057",
			}},
			Annotations: kubetest.FakeIstioAnnotations(),
		},
		Spec: core_v1.PodSpec{
			Containers: []core_v1.Container{
				{Name: "details", Image: "whatever"},
				{Name: "istio-proxy", Image: "docker.io/istio/proxy:0.7.1"},
			},
			InitContainers: []core_v1.Container{
				{Name: "istio-init", Image: "docker.io/istio/proxy_init:0.7.1"},
				{Name: "enable-core-dump", Image: "alpine"},
			},
		},
	}
}

func FakePodWithWaypointAndDeployments() *core_v1.Pod {
	conf := config.NewConfig()

	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	controller := true
	return &core_v1.Pod{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "details-v1-3618568057-dnkjp",
			Namespace:         "Namespace",
			CreationTimestamp: meta_v1.NewTime(t1),
			Labels:            map[string]string{appLabel: "details", versionLabel: "v1"},
			OwnerReferences: []meta_v1.OwnerReference{{
				Controller: &controller,
				APIVersion: kubernetes.ReplicaSets.GroupVersion().String(),
				Kind:       kubernetes.ReplicaSets.Kind,
				Name:       "details-v1-3618568057",
			}},
			Annotations: kubetest.FakeIstioAnnotations(),
		},
		Spec: core_v1.PodSpec{
			Containers: []core_v1.Container{
				{Name: "details", Image: "whatever"},
			},
			InitContainers: []core_v1.Container{},
		},
	}
}

func FakePodLogsSyncedWithDeployments() *kubernetes.PodLogs {
	return &kubernetes.PodLogs{
		Logs: `2018-01-02T03:34:28+00:00 INFO #1 Log Message
2018-01-02T04:34:28+00:00 WARN #2 Log Message
2018-01-02T05:34:28+00:00 #3 Log Message
2018-01-02T06:34:28+00:00 #4 Log error Message`,
	}
}

func FakePodLogsProxy() *kubernetes.PodLogs {
	return &kubernetes.PodLogs{
		Logs: `2021-02-01T21:34:35+00:00 [2021-02-01T21:34:35.533Z] "GET /hotels/Ljubljana HTTP/1.1" 200 - via_upstream - "-" 0 99 14 14 "-" "Go-http-client/1.1" "7e7e2dd0-0a96-4535-950b-e303805b7e27" "hotels.travel-agency:8000" "127.0.2021-02-01T21:34:38.761055140Z 0.1:8000" inbound|8000|| 127.0.0.1:33704 10.129.0.72:8000 10.128.0.79:39880 outbound_.8000_._.hotels.travel-agency.svc.cluster.local default`,
	}
}

func FakePodLogsZtunnel() *kubernetes.PodLogs {
	content, err := readFile("../tests/data/logs/ztunnel.log")
	if err != nil {
		log.Errorf("Error reading logs file: %s", err.Error())
	}
	return &kubernetes.PodLogs{
		Logs: content,
	}
}

func FakePodLogsWaypoint() *kubernetes.PodLogs {
	content, err := readFile("../tests/data/logs/waypoint.log")
	if err != nil {
		log.Errorf("Error reading logs file: %s", err.Error())
	}
	return &kubernetes.PodLogs{
		Logs: content,
	}
}

func FakePodsSyncedWithDuplicated(conf *config.Config) []core_v1.Pod {
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	controller := true
	return []core_v1.Pod{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "duplicated-v1-3618568057-1",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
				Labels:            map[string]string{appLabel: "duplicated", versionLabel: "v1"},
				OwnerReferences: []meta_v1.OwnerReference{{
					Controller: &controller,
					APIVersion: kubernetes.StatefulSets.GroupVersion().String(),
					Kind:       kubernetes.StatefulSets.Kind,
					Name:       "duplicated-v1",
				}},
				Annotations: kubetest.FakeIstioAnnotations(),
			},
			Spec: core_v1.PodSpec{
				Containers: []core_v1.Container{
					{Name: "details", Image: "whatever"},
					{Name: "istio-proxy", Image: "docker.io/istio/proxy:0.7.1"},
				},
				InitContainers: []core_v1.Container{
					{Name: "istio-init", Image: "docker.io/istio/proxy_init:0.7.1"},
					{Name: "enable-core-dump", Image: "alpine"},
				},
			},
		},
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "duplicated-v1-3618568057-3",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
				Labels:            map[string]string{appLabel: "duplicated", versionLabel: "v1"},
				OwnerReferences: []meta_v1.OwnerReference{{
					Controller: &controller,
					APIVersion: kubernetes.StatefulSets.GroupVersion().String(),
					Kind:       kubernetes.StatefulSets.Kind,
					Name:       "duplicated-v1",
				}},
				Annotations: kubetest.FakeIstioAnnotations(),
			},
			Spec: core_v1.PodSpec{
				Containers: []core_v1.Container{
					{Name: "details", Image: "whatever"},
					{Name: "istio-proxy", Image: "docker.io/istio/proxy:0.7.1"},
				},
				InitContainers: []core_v1.Container{
					{Name: "istio-init", Image: "docker.io/istio/proxy_init:0.7.1"},
					{Name: "enable-core-dump", Image: "alpine"},
				},
			},
		},
	}
}

func FakePodsNoController(conf *config.Config) []core_v1.Pod {
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")

	return []core_v1.Pod{
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.Pods.GroupVersion().String(),
				Kind:       kubernetes.Pods.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "orphan-pod",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
				Labels:            map[string]string{appLabel: "httpbin", versionLabel: "v1"},
				Annotations:       kubetest.FakeIstioAnnotations(),
			},
			Spec: core_v1.PodSpec{
				Containers: []core_v1.Container{
					{Name: "details", Image: "whatever"},
					{Name: "istio-proxy", Image: "docker.io/istio/proxy:0.7.1"},
				},
				InitContainers: []core_v1.Container{
					{Name: "istio-init", Image: "docker.io/istio/proxy_init:0.7.1"},
					{Name: "enable-core-dump", Image: "alpine"},
				},
			},
		},
	}
}

func FakePodsFromCustomController(conf *config.Config) []core_v1.Pod {
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	controller := true
	return []core_v1.Pod{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "custom-controller-pod",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
				Labels:            map[string]string{appLabel: "httpbin", versionLabel: "v1"},
				OwnerReferences: []meta_v1.OwnerReference{{
					Controller: &controller,
					APIVersion: kubernetes.ReplicaSets.GroupVersion().String(),
					Kind:       kubernetes.ReplicaSets.Kind,
					Name:       "custom-controller-RS-123",
				}},
				Annotations: kubetest.FakeIstioAnnotations(),
			},
			Spec: core_v1.PodSpec{
				Containers: []core_v1.Container{
					{Name: "details", Image: "whatever"},
					{Name: "istio-proxy", Image: "docker.io/istio/proxy:0.7.1"},
				},
				InitContainers: []core_v1.Container{
					{Name: "istio-init", Image: "docker.io/istio/proxy_init:0.7.1"},
					{Name: "enable-core-dump", Image: "alpine"},
				},
			},
		},
	}
}

func FakeZtunnelPods(conf *config.Config) []core_v1.Pod {
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	controller := true
	return []core_v1.Pod{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "ztunnel",
				Namespace:         "istio-system",
				CreationTimestamp: meta_v1.NewTime(t1),
				Labels:            map[string]string{appLabel: "ztunnel", versionLabel: "v1"},
				OwnerReferences: []meta_v1.OwnerReference{{
					Controller: &controller,
					APIVersion: kubernetes.ReplicaSets.GroupVersion().String(),
					Kind:       kubernetes.ReplicaSets.Kind,
					Name:       "ztunnel",
				}},
				Annotations: kubetest.FakeIstioAnnotations(),
			},
			Spec: core_v1.PodSpec{
				Containers: []core_v1.Container{
					{Name: "ztunnel-lrzrn", Image: "whatever"},
				},
				InitContainers: []core_v1.Container{
					{Name: "istio-init", Image: "docker.io/istio/proxy_init:0.7.1"},
				},
			},
		},
	}
}

func FakeWaypointPod() []core_v1.Pod {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []core_v1.Pod{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "waypoint",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
				Labels:            map[string]string{config.WaypointLabel: config.WaypointLabelValue},
				Annotations:       kubetest.FakeIstioAnnotations(),
			},
			Spec: core_v1.PodSpec{
				Containers: []core_v1.Container{
					{Name: "waypoint-dcd74f8b4-nf7jc", Image: "gcr.io/istio-release/proxyv2:1.24.1-distroless"},
				},
			},
		},
	}
}

func FakeWaypointNamespaceEnrolledPods(conf *config.Config, waypoint bool) []core_v1.Pod {
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	waypointLabel := conf.IstioLabels.AmbientWaypointUseLabel

	wpLabels := map[string]string{appLabel: "details", versionLabel: "v1"}
	if waypoint {
		wpLabels = map[string]string{appLabel: "details", versionLabel: "v1", waypointLabel: "waypoint"}
	}

	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []core_v1.Pod{
		{ObjectMeta: meta_v1.ObjectMeta{
			Name:              "details",
			Namespace:         "Namespace",
			CreationTimestamp: meta_v1.NewTime(t1),
			Labels:            wpLabels,
			Annotations:       kubetest.FakeIstioAmbientAnnotations(),
		},
			Spec: core_v1.PodSpec{
				Containers: []core_v1.Container{
					{Name: "details", Image: "whatever"},
				},
			},
		},
		{ObjectMeta: meta_v1.ObjectMeta{
			Name:              "productpage",
			Namespace:         "Namespace",
			CreationTimestamp: meta_v1.NewTime(t1),
			Labels:            map[string]string{appLabel: "productpage", versionLabel: "v1"},
			Annotations:       kubetest.FakeIstioAmbientAnnotations(),
		},
			Spec: core_v1.PodSpec{
				Containers: []core_v1.Container{
					{Name: "productpage", Image: "whatever"},
				},
			},
		},
	}
}

func FakeWaypointNServiceEnrolledPods(conf *config.Config) []core_v1.Service {
	waypointLabel := conf.IstioLabels.AmbientWaypointUseLabel

	return []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "details",
				Namespace: "Namespace",
				Labels:    map[string]string{"app": "details", waypointLabel: "waypoint"},
			},
			Spec: core_v1.ServiceSpec{
				Selector: map[string]string{"app": "details"},
			},
		},
	}
}

func FakeZtunnelDaemonSet(conf *config.Config) []apps_v1.DaemonSet {
	conf.KubernetesConfig.ExcludeWorkloads = []string{}

	appLabel := conf.IstioLabels.AppLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []apps_v1.DaemonSet{
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.DaemonSets.GroupVersion().String(),
				Kind:       kubernetes.DaemonSets.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "ztunnel",
				Namespace:         "istio-system",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: apps_v1.DaemonSetSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "ztunnel"},
					},
				},
				Selector: &meta_v1.LabelSelector{
					MatchLabels: map[string]string{appLabel: "ztunnel"},
				},
			},
			Status: apps_v1.DaemonSetStatus{
				DesiredNumberScheduled: 1,
				CurrentNumberScheduled: 1,
				NumberAvailable:        1,
			},
		},
	}
}

func FakeCustomControllerRSSyncedWithPods(conf *config.Config) []apps_v1.ReplicaSet {
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	controller := true
	return []apps_v1.ReplicaSet{
		{
			TypeMeta: meta_v1.TypeMeta{
				APIVersion: kubernetes.ReplicaSets.GroupVersion().String(),
				Kind:       kubernetes.ReplicaSets.Kind,
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "custom-controller-RS-123",
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
				OwnerReferences: []meta_v1.OwnerReference{{
					Controller: &controller,
					Kind:       "CustomController",
					Name:       "custom-controller",
				}},
			},
			Spec: apps_v1.ReplicaSetSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "details", versionLabel: "v1"},
					},
				},
			},
			Status: apps_v1.ReplicaSetStatus{
				Replicas:          1,
				AvailableReplicas: 1,
				ReadyReplicas:     0,
			},
		},
	}
}

func FakeServices(conf config.Config) []core_v1.Service {
	appLabelName := conf.IstioLabels.AppLabelName
	if appLabelName == "" {
		appLabelName = "app"
	}

	return []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "httpbin",
				Namespace: "Namespace",
				Labels:    map[string]string{appLabelName: "httpbin"},
			},
			Spec: core_v1.ServiceSpec{
				Selector: map[string]string{appLabelName: "httpbin"},
			},
		},
	}
}

func readFile(fileName string) (string, error) {

	f, err := os.OpenFile(fileName, os.O_RDONLY, 0644)
	if err != nil {
		return "", fmt.Errorf("error opening file %s", err)
	}
	defer func(f *os.File) {
		errClose := f.Close()
		if errClose != nil {
			log.Errorf("error closing file %s", err)
		}
	}(f)

	content, err := io.ReadAll(f)
	if err != nil {
		return "", fmt.Errorf("error reading file %s", err)
	}
	return string(content), nil
}
