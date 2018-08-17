package models

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestDeploymentInvidividualParse(t *testing.T) {
	assert := assert.New(t)

	deployment := Workload{}
	deployment.Parse(fakeDeployment())

	assert.Equal("reviews-v1", deployment.Name)
	assert.Equal("{version: 1.0}", deployment.TemplateAnnotations["sidecar.istio.io/status"])
	assert.Equal("bar", deployment.Labels["foo"])
	assert.Equal("v1", deployment.Labels["version"])
	assert.Equal("2709198702082918", deployment.ResourceVersion)
	assert.Equal(int32(1), deployment.Replicas)
	assert.Equal(int32(1), deployment.AvailableReplicas)
	assert.Equal(int32(0), deployment.UnavailableReplicas)
}

func TestDeploymentWorkloadOverview(t *testing.T) {
	assert := assert.New(t)

	deployment := WorkloadOverview{}
	k18sDeployment := fakeDeployment()
	deployment.Parse(*k18sDeployment)

	assert.Equal("reviews-v1", deployment.Name)
	assert.Equal("bar", deployment.Labels["foo"])
	assert.Equal("v1", deployment.Labels["version"])
	assert.Equal("2709198702082918", deployment.ResourceVersion)
	assert.Equal("2018-03-08T17:44:00+03:00", deployment.CreatedAt)
}

func fakeDeployment() *v1beta1.Deployment {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")

	return &v1beta1.Deployment{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "reviews-v1",
			CreationTimestamp: meta_v1.NewTime(t1),
			ResourceVersion:   "2709198702082918",
			Labels:            map[string]string{"foo": "bar", "version": "v1"},
		},
		Spec: v1beta1.DeploymentSpec{
			Template: v1.PodTemplateSpec{
				ObjectMeta: meta_v1.ObjectMeta{
					Annotations: map[string]string{
						"sidecar.istio.io/status": "{version: 1.0}",
					},
				},
			},
		},
		Status: v1beta1.DeploymentStatus{
			Replicas:            1,
			AvailableReplicas:   1,
			UnavailableReplicas: 0,
		},
	}
}
