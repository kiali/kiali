package models

import (
	"testing"
	"time"

	"github.com/kiali/kiali/config"
	osappsv1 "github.com/openshift/api/apps/v1"
	"github.com/stretchr/testify/assert"
	appsv1 "k8s.io/api/apps/v1"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestParseDeploymentToWorkload(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	w := Workload{}
	w.ParseDeployment(fakeDeployment())

	assert.Equal("reviews-v1", w.Name)
	assert.Equal("bar", w.Labels["foo"])
	assert.Equal("v1", w.Labels["version"])
	assert.Equal("2709198702082918", w.ResourceVersion)
	assert.Equal("Deployment", w.Type)
	assert.Equal(int32(1), w.Replicas)
	assert.Equal(int32(1), w.AvailableReplicas)
	assert.Equal(int32(0), w.UnavailableReplicas)
}

func TestParseReplicaSetToWorkload(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	w := Workload{}
	w.ParseReplicaSet(fakeReplicaSet())

	assert.Equal("reviews-v1", w.Name)
	assert.Equal("bar", w.Labels["foo"])
	assert.Equal("v1", w.Labels["version"])
	assert.Equal("2709198702082918", w.ResourceVersion)
	assert.Equal("ReplicaSet", w.Type)
	assert.Equal(int32(1), w.Replicas)
	assert.Equal(int32(1), w.AvailableReplicas)
	assert.Equal(int32(0), w.UnavailableReplicas)
}

func TestParseReplicationControllerToWorkload(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	w := Workload{}
	w.ParseReplicationController(fakeReplicationController())

	assert.Equal("reviews-v1", w.Name)
	assert.Equal("bar", w.Labels["foo"])
	assert.Equal("v1", w.Labels["version"])
	assert.Equal("2709198702082918", w.ResourceVersion)
	assert.Equal("ReplicationController", w.Type)
	assert.Equal(int32(1), w.Replicas)
	assert.Equal(int32(1), w.AvailableReplicas)
	assert.Equal(int32(0), w.UnavailableReplicas)
}

func TestParseDeploymentConfigToWorkload(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	w := Workload{}
	w.ParseDeploymentConfig(fakeDeploymentConfig())

	assert.Equal("reviews-v1", w.Name)
	assert.Equal("bar", w.Labels["foo"])
	assert.Equal("v1", w.Labels["version"])
	assert.Equal("2709198702082918", w.ResourceVersion)
	assert.Equal(int32(1), w.Replicas)
	assert.Equal(int32(1), w.AvailableReplicas)
	assert.Equal(int32(0), w.UnavailableReplicas)
}

func TestParsePodToWorkload(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	w := Workload{}
	w.ParsePod(fakePod())

	assert.Equal("reviews-v1", w.Name)
	assert.Equal("bar", w.Labels["foo"])
	assert.Equal("v1", w.Labels["version"])
	assert.Equal("2709198702082918", w.ResourceVersion)
	assert.Equal("Pod", w.Type)
	assert.Equal(int32(1), w.Replicas)
	assert.Equal(int32(1), w.AvailableReplicas)
	assert.Equal(int32(0), w.UnavailableReplicas)
}

func TestParsePodsToWorkload(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	w := Workload{}
	w.ParsePods("workload-from-controller", "Controller", []v1.Pod{*fakePod()})

	assert.Equal("workload-from-controller", w.Name)
	assert.Equal("bar", w.Labels["foo"])
	assert.Equal("v1", w.Labels["version"])
	assert.Equal("2709198702082918", w.ResourceVersion)
	assert.Equal("Controller", w.Type)
	assert.Equal(int32(1), w.Replicas)
	assert.Equal(int32(1), w.AvailableReplicas)
	assert.Equal(int32(0), w.UnavailableReplicas)
}

func fakeDeployment() *appsv1.Deployment {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")

	return &appsv1.Deployment{
		TypeMeta: meta_v1.TypeMeta{
			Kind: "Deployment",
		},
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "reviews-v1",
			CreationTimestamp: meta_v1.NewTime(t1),
			ResourceVersion:   "2709198702082918",
		},
		Spec: appsv1.DeploymentSpec{
			Template: v1.PodTemplateSpec{
				ObjectMeta: meta_v1.ObjectMeta{
					Labels: map[string]string{"foo": "bar", "version": "v1"},
				},
			},
		},
		Status: appsv1.DeploymentStatus{
			Replicas:            1,
			AvailableReplicas:   1,
			UnavailableReplicas: 0,
		},
	}
}

func fakeReplicaSet() *appsv1.ReplicaSet {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")

	return &appsv1.ReplicaSet{
		TypeMeta: meta_v1.TypeMeta{
			Kind: "ReplicaSet",
		},
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "reviews-v1",
			CreationTimestamp: meta_v1.NewTime(t1),
			ResourceVersion:   "2709198702082918",
		},
		Spec: appsv1.ReplicaSetSpec{
			Template: v1.PodTemplateSpec{
				ObjectMeta: meta_v1.ObjectMeta{
					Labels: map[string]string{"foo": "bar", "version": "v1"},
				},
			},
		},
		Status: appsv1.ReplicaSetStatus{
			Replicas:          1,
			AvailableReplicas: 1,
		},
	}
}

func fakeReplicationController() *v1.ReplicationController {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")

	return &v1.ReplicationController{
		TypeMeta: meta_v1.TypeMeta{
			Kind: "ReplicationController",
		},
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "reviews-v1",
			CreationTimestamp: meta_v1.NewTime(t1),
			ResourceVersion:   "2709198702082918",
		},
		Spec: v1.ReplicationControllerSpec{
			Template: &v1.PodTemplateSpec{
				ObjectMeta: meta_v1.ObjectMeta{
					Labels: map[string]string{"foo": "bar", "version": "v1"},
				},
			},
		},
		Status: v1.ReplicationControllerStatus{
			Replicas:          1,
			AvailableReplicas: 1,
		},
	}
}

func fakeDeploymentConfig() *osappsv1.DeploymentConfig {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")

	return &osappsv1.DeploymentConfig{
		TypeMeta: meta_v1.TypeMeta{
			Kind: "DeploymentConfig",
		},
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "reviews-v1",
			CreationTimestamp: meta_v1.NewTime(t1),
			ResourceVersion:   "2709198702082918",
		},
		Spec: osappsv1.DeploymentConfigSpec{
			Template: &v1.PodTemplateSpec{
				ObjectMeta: meta_v1.ObjectMeta{
					Labels: map[string]string{"foo": "bar", "version": "v1"},
				},
			},
		},
		Status: osappsv1.DeploymentConfigStatus{
			Replicas:            1,
			AvailableReplicas:   1,
			UnavailableReplicas: 0,
		},
	}
}

func fakePod() *v1.Pod {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")

	return &v1.Pod{
		TypeMeta: meta_v1.TypeMeta{
			Kind: "Pod",
		},
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "reviews-v1",
			CreationTimestamp: meta_v1.NewTime(t1),
			ResourceVersion:   "2709198702082918",
			Labels:            map[string]string{"foo": "bar", "version": "v1"},
		},
		Status: v1.PodStatus{
			Phase: "Running",
		},
	}
}
