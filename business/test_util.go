package business

import (
	"time"

	osapps_v1 "github.com/openshift/api/apps/v1"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

// Consolidate fake/mock data used in tests per package

func FakeDeployments() []apps_v1.Deployment {
	conf := config.NewConfig()
	config.Set(conf)
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []apps_v1.Deployment{
		{
			TypeMeta: meta_v1.TypeMeta{
				Kind: "Deployment",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v1",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "httpbin"},
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
				Kind: "Deployment",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v2",
				CreationTimestamp: meta_v1.NewTime(t1),
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{appLabel: "httpbin", versionLabel: "v2"},
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
				Kind: "Deployment",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v3",
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
	config.Set(conf)
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []apps_v1.Deployment{
		{
			TypeMeta: meta_v1.TypeMeta{
				Kind: "Deployment",
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

func FakeReplicaSets() []apps_v1.ReplicaSet {
	conf := config.NewConfig()
	config.Set(conf)
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []apps_v1.ReplicaSet{
		{
			TypeMeta: meta_v1.TypeMeta{
				Kind: "ReplicaSet",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v1",
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
				Kind: "ReplicaSet",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v2",
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
				Kind: "ReplicaSet",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v3",
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
	config.Set(conf)
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	controller := true
	return []apps_v1.ReplicaSet{
		{
			TypeMeta: meta_v1.TypeMeta{
				Kind: "ReplicaSet",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "duplicated-v1-12345",
				CreationTimestamp: meta_v1.NewTime(t1),
				OwnerReferences: []meta_v1.OwnerReference{meta_v1.OwnerReference{
					Controller: &controller,
					Kind:       "Deployment",
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

func FakeReplicationControllers() []core_v1.ReplicationController {
	conf := config.NewConfig()
	config.Set(conf)
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []core_v1.ReplicationController{
		{
			TypeMeta: meta_v1.TypeMeta{
				Kind: "ReplicationController",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v1",
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
				Kind: "ReplicationController",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v2",
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
				Kind: "ReplicationController",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v3",
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

func FakeDeploymentConfigs() []osapps_v1.DeploymentConfig {
	conf := config.NewConfig()
	config.Set(conf)
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []osapps_v1.DeploymentConfig{
		{
			TypeMeta: meta_v1.TypeMeta{
				Kind: "DeploymentConfig",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v1",
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
				Kind: "DeploymentConfig",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v2",
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
				Kind: "DeploymentConfig",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v3",
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

func FakeStatefulSets() []apps_v1.StatefulSet {
	conf := config.NewConfig()
	config.Set(conf)
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []apps_v1.StatefulSet{
		{
			TypeMeta: meta_v1.TypeMeta{
				Kind: "StatefulSet",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v1",
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
				Kind: "StatefulSet",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v2",
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
				Kind: "StatefulSet",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "httpbin-v3",
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

func FakeDuplicatedStatefulSets() []apps_v1.StatefulSet {
	conf := config.NewConfig()
	config.Set(conf)
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []apps_v1.StatefulSet{
		{
			TypeMeta: meta_v1.TypeMeta{
				Kind: "StatefulSet",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "duplicated-v1",
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

func FakeDepSyncedWithRS() []apps_v1.Deployment {
	conf := config.NewConfig()
	config.Set(conf)
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []apps_v1.Deployment{
		{
			TypeMeta: meta_v1.TypeMeta{
				Kind: "Deployment",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "details-v1",
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

func FakeRSSyncedWithPods() []apps_v1.ReplicaSet {
	conf := config.NewConfig()
	config.Set(conf)
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	controller := true
	return []apps_v1.ReplicaSet{
		{
			TypeMeta: meta_v1.TypeMeta{
				Kind: "ReplicaSet",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "details-v1-3618568057",
				CreationTimestamp: meta_v1.NewTime(t1),
				OwnerReferences: []meta_v1.OwnerReference{meta_v1.OwnerReference{
					Controller: &controller,
					Kind:       "Deployment",
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

func FakePodsSyncedWithDeployments() []core_v1.Pod {
	conf := config.NewConfig()
	config.Set(conf)
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	controller := true
	return []core_v1.Pod{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "details-v1-3618568057-dnkjp",
				CreationTimestamp: meta_v1.NewTime(t1),
				Labels:            map[string]string{appLabel: "httpbin", versionLabel: "v1"},
				OwnerReferences: []meta_v1.OwnerReference{meta_v1.OwnerReference{
					Controller: &controller,
					Kind:       "ReplicaSet",
					Name:       "details-v1-3618568057",
				}},
				Annotations: kubetest.FakeIstioAnnotations(),
			},
			Spec: core_v1.PodSpec{
				Containers: []core_v1.Container{
					core_v1.Container{Name: "details", Image: "whatever"},
					core_v1.Container{Name: "istio-proxy", Image: "docker.io/istio/proxy:0.7.1"},
				},
				InitContainers: []core_v1.Container{
					core_v1.Container{Name: "istio-init", Image: "docker.io/istio/proxy_init:0.7.1"},
					core_v1.Container{Name: "enable-core-dump", Image: "alpine"},
				},
			},
		},
	}
}

func FakePodSyncedWithDeployments() *core_v1.Pod {
	conf := config.NewConfig()
	config.Set(conf)
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	controller := true
	return &core_v1.Pod{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "details-v1-3618568057-dnkjp",
			CreationTimestamp: meta_v1.NewTime(t1),
			Labels:            map[string]string{appLabel: "httpbin", versionLabel: "v1"},
			OwnerReferences: []meta_v1.OwnerReference{meta_v1.OwnerReference{
				Controller: &controller,
				Kind:       "ReplicaSet",
				Name:       "details-v1-3618568057",
			}},
			Annotations: kubetest.FakeIstioAnnotations(),
		},
		Spec: core_v1.PodSpec{
			Containers: []core_v1.Container{
				core_v1.Container{Name: "details", Image: "whatever"},
				core_v1.Container{Name: "istio-proxy", Image: "docker.io/istio/proxy:0.7.1"},
			},
			InitContainers: []core_v1.Container{
				core_v1.Container{Name: "istio-init", Image: "docker.io/istio/proxy_init:0.7.1"},
				core_v1.Container{Name: "enable-core-dump", Image: "alpine"},
			},
		},
	}
}

func FakePodLogsSyncedWithDeployments() *kubernetes.PodLogs {
	return &kubernetes.PodLogs{
		Logs: "Fake Log Entry 1\nFake Log Entry 2",
	}
}

func FakePodsSyncedWithDuplicated() []core_v1.Pod {
	conf := config.NewConfig()
	config.Set(conf)
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	controller := true
	return []core_v1.Pod{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "duplicated-v1-3618568057-1",
				CreationTimestamp: meta_v1.NewTime(t1),
				Labels:            map[string]string{appLabel: "duplicated", versionLabel: "v1"},
				OwnerReferences: []meta_v1.OwnerReference{meta_v1.OwnerReference{
					Controller: &controller,
					Kind:       "StatefulSet",
					Name:       "duplicated-v1",
				}},
				Annotations: kubetest.FakeIstioAnnotations(),
			},
			Spec: core_v1.PodSpec{
				Containers: []core_v1.Container{
					core_v1.Container{Name: "details", Image: "whatever"},
					core_v1.Container{Name: "istio-proxy", Image: "docker.io/istio/proxy:0.7.1"},
				},
				InitContainers: []core_v1.Container{
					core_v1.Container{Name: "istio-init", Image: "docker.io/istio/proxy_init:0.7.1"},
					core_v1.Container{Name: "enable-core-dump", Image: "alpine"},
				},
			},
		},
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "duplicated-v1-3618568057-3",
				CreationTimestamp: meta_v1.NewTime(t1),
				Labels:            map[string]string{appLabel: "duplicated", versionLabel: "v1"},
				OwnerReferences: []meta_v1.OwnerReference{meta_v1.OwnerReference{
					Controller: &controller,
					Kind:       "StatefulSet",
					Name:       "duplicated-v1",
				}},
				Annotations: kubetest.FakeIstioAnnotations(),
			},
			Spec: core_v1.PodSpec{
				Containers: []core_v1.Container{
					core_v1.Container{Name: "details", Image: "whatever"},
					core_v1.Container{Name: "istio-proxy", Image: "docker.io/istio/proxy:0.7.1"},
				},
				InitContainers: []core_v1.Container{
					core_v1.Container{Name: "istio-init", Image: "docker.io/istio/proxy_init:0.7.1"},
					core_v1.Container{Name: "enable-core-dump", Image: "alpine"},
				},
			},
		},
	}
}

func FakePodsNoController() []core_v1.Pod {
	conf := config.NewConfig()
	config.Set(conf)
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")

	return []core_v1.Pod{
		{
			TypeMeta: meta_v1.TypeMeta{
				Kind: "Pod",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "orphan-pod",
				CreationTimestamp: meta_v1.NewTime(t1),
				Labels:            map[string]string{appLabel: "httpbin", versionLabel: "v1"},
				Annotations:       kubetest.FakeIstioAnnotations(),
			},
			Spec: core_v1.PodSpec{
				Containers: []core_v1.Container{
					core_v1.Container{Name: "details", Image: "whatever"},
					core_v1.Container{Name: "istio-proxy", Image: "docker.io/istio/proxy:0.7.1"},
				},
				InitContainers: []core_v1.Container{
					core_v1.Container{Name: "istio-init", Image: "docker.io/istio/proxy_init:0.7.1"},
					core_v1.Container{Name: "enable-core-dump", Image: "alpine"},
				},
			},
		},
	}
}

func FakePodsFromDaemonSet() []core_v1.Pod {
	conf := config.NewConfig()
	config.Set(conf)
	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	controller := true
	return []core_v1.Pod{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "daemon-pod",
				CreationTimestamp: meta_v1.NewTime(t1),
				Labels:            map[string]string{appLabel: "httpbin", versionLabel: "v1"},
				OwnerReferences: []meta_v1.OwnerReference{meta_v1.OwnerReference{
					Controller: &controller,
					Kind:       "DaemonSet",
					Name:       "daemon-controller",
				}},
				Annotations: kubetest.FakeIstioAnnotations(),
			},
			Spec: core_v1.PodSpec{
				Containers: []core_v1.Container{
					core_v1.Container{Name: "details", Image: "whatever"},
					core_v1.Container{Name: "istio-proxy", Image: "docker.io/istio/proxy:0.7.1"},
				},
				InitContainers: []core_v1.Container{
					core_v1.Container{Name: "istio-init", Image: "docker.io/istio/proxy_init:0.7.1"},
					core_v1.Container{Name: "enable-core-dump", Image: "alpine"},
				},
			},
		},
	}
}

func FakeServices() []core_v1.Service {
	return []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{Name: "httpbin"},
			Spec: core_v1.ServiceSpec{
				Selector: map[string]string{"app": "httpbin"},
			},
		},
	}
}
