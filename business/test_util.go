package business

import (
	"fmt"
	"io"
	"os"
	"time"

	osapps_v1 "github.com/openshift/api/apps/v1"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/log"
)

// Consolidate fake/mock data used in tests per package

func FakeDeployments(conf config.Config) []apps_v1.Deployment {
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
				Namespace:         "Namespace",
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
				Namespace:         "Namespace",
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

func FakeReplicaSets(conf config.Config) []apps_v1.ReplicaSet {
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
				Kind: "ReplicaSet",
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
				Kind: "ReplicaSet",
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
				Kind: "ReplicaSet",
			},
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "duplicated-v1-12345",

				CreationTimestamp: meta_v1.NewTime(t1),
				OwnerReferences: []meta_v1.OwnerReference{{
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
	// Enable ReplicationController, those are not fetched by default
	conf.KubernetesConfig.ExcludeWorkloads = []string{}

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
				Kind: "ReplicationController",
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
				Kind: "ReplicationController",
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

func FakeDeploymentConfigs() []osapps_v1.DeploymentConfig {
	conf := config.NewConfig()
	conf.KubernetesConfig.ExcludeWorkloads = []string{}

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
				Kind: "DeploymentConfig",
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
				Kind: "DeploymentConfig",
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

func FakeStatefulSets() []apps_v1.StatefulSet {
	conf := config.NewConfig()
	conf.KubernetesConfig.ExcludeWorkloads = []string{}

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
				Kind: "StatefulSet",
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
				Kind: "StatefulSet",
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

func FakeDaemonSets() []apps_v1.DaemonSet {
	conf := config.NewConfig()
	conf.KubernetesConfig.ExcludeWorkloads = []string{}

	appLabel := conf.IstioLabels.AppLabelName
	versionLabel := conf.IstioLabels.VersionLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []apps_v1.DaemonSet{
		{
			TypeMeta: meta_v1.TypeMeta{
				Kind: "DaemonSet",
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
				Kind: "DaemonSet",
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
				Kind: "DaemonSet",
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

func FakeDuplicatedStatefulSets() []apps_v1.StatefulSet {
	conf := config.NewConfig()

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

func FakeDepSyncedWithRS() []apps_v1.Deployment {
	conf := config.NewConfig()

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

func FakeRSSyncedWithPods() []apps_v1.ReplicaSet {
	conf := config.NewConfig()

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
				Namespace:         "Namespace",
				CreationTimestamp: meta_v1.NewTime(t1),
				OwnerReferences: []meta_v1.OwnerReference{{
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
					Kind:       "ReplicaSet",
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

func FakePodSyncedWithDeployments() *core_v1.Pod {
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
			Labels:            map[string]string{appLabel: "httpbin", versionLabel: "v1"},
			OwnerReferences: []meta_v1.OwnerReference{{
				Controller: &controller,
				Kind:       "ReplicaSet",
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

func FakePodsSyncedWithDuplicated() []core_v1.Pod {
	conf := config.NewConfig()

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
					Kind:       "StatefulSet",
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
					Kind:       "StatefulSet",
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

func FakePodsNoController() []core_v1.Pod {
	conf := config.NewConfig()

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

func FakePodsFromCustomController() []core_v1.Pod {
	conf := config.NewConfig()

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
					Kind:       "ReplicaSet",
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

func FakeZtunnelPods() []core_v1.Pod {
	conf := config.NewConfig()

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
					Kind:       "ReplicaSet",
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

func FakeZtunnelDaemonSet() []apps_v1.DaemonSet {
	conf := config.NewConfig()
	conf.KubernetesConfig.ExcludeWorkloads = []string{}

	appLabel := conf.IstioLabels.AppLabelName
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return []apps_v1.DaemonSet{
		{
			TypeMeta: meta_v1.TypeMeta{
				Kind: "DaemonSet",
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

func FakeCustomControllerRSSyncedWithPods() []apps_v1.ReplicaSet {
	conf := config.NewConfig()

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

func FakeServices() []core_v1.Service {
	return []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "httpbin",
				Namespace: "Namespace",
				Labels:    map[string]string{"app": "httpbin"},
			},
			Spec: core_v1.ServiceSpec{
				Selector: map[string]string{"app": "httpbin"},
			},
		},
	}
}

func readFile(fileName string) (string, error) {

	f, err := os.OpenFile(fileName, os.O_RDONLY, 0644)
	defer f.Close()

	content, err := io.ReadAll(f)
	if err != nil {
		return "", fmt.Errorf("error opening file %s", err)
	}
	return string(content), nil
}
