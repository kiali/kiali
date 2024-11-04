package models

import (
	"testing"
	"time"

	osapps_v1 "github.com/openshift/api/apps/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
)

func TestParseDeploymentToWorkload(t *testing.T) {
	assert := assert.New(t)
	cfg := config.NewConfig()
	cfg.AdditionalDisplayDetails = []config.AdditionalDisplayItem{
		{
			Annotation: "annotation-2",
			Title:      "Annotation 2",
		},
		{
			Annotation: "annotation-1",
			Title:      "Annotation 1",
		},
		{
			Annotation: "annotation-4",
			Title:      "Annotation 4",
		},
	}
	config.Set(cfg)

	w := Workload{}
	d := fakeDeployment()
	w.ParseDeployment(d)

	assert.Equal("reviews-v1", w.Name)
	assert.Equal("bar", w.Labels["foo"])
	assert.Equal("v1", w.Labels["version"])
	assert.Equal("2709198702082918", w.ResourceVersion)
	assert.Equal("Deployment", w.Type)
	assert.Equal(int32(1), w.DesiredReplicas)
	assert.Equal(int32(1), w.CurrentReplicas)
	assert.Equal(int32(1), w.AvailableReplicas)
	assert.Len(w.AdditionalDetails, 2)
	assert.Equal("Annotation 2", w.AdditionalDetails[0].Title)
	assert.Equal("value-annot-2", w.AdditionalDetails[0].Value)
	assert.Equal("Annotation 1", w.AdditionalDetails[1].Title)
	assert.Equal("value-annot-1", w.AdditionalDetails[1].Value)
	// TODO: The parsing is actually clobbering the Deployment.Annotations if Template.Annotations
	// is set but fixing it may cause unintended side effects so putting this test after the rest.
	d.Spec.Template.Annotations = map[string]string{"food": "pizza", "drink": "soda"}
	w.ParseDeployment(d)
	assert.Equal(w.TemplateAnnotations, d.Spec.Template.Annotations)
}

func TestParseReplicaSetToWorkload(t *testing.T) {
	assert := assert.New(t)
	cfg := config.NewConfig()
	cfg.AdditionalDisplayDetails = []config.AdditionalDisplayItem{
		{
			Annotation: "annotation",
			Title:      "Annotation",
		},
	}
	config.Set(cfg)

	w := Workload{}
	w.ParseReplicaSet(fakeReplicaSet())

	assert.Equal("reviews-v1", w.Name)
	assert.Equal("bar", w.Labels["foo"])
	assert.Equal("v1", w.Labels["version"])
	assert.Equal("2709198702082918", w.ResourceVersion)
	assert.Equal("ReplicaSet", w.Type)
	assert.Equal(int32(1), w.DesiredReplicas)
	assert.Equal(int32(1), w.CurrentReplicas)
	assert.Equal(int32(1), w.AvailableReplicas)
	assert.Len(w.AdditionalDetails, 1)
	assert.Equal("Annotation", w.AdditionalDetails[0].Title)
	assert.Equal("value-annot", w.AdditionalDetails[0].Value)
}

func TestParseReplicationControllerToWorkload(t *testing.T) {
	assert := assert.New(t)
	cfg := config.NewConfig()
	cfg.AdditionalDisplayDetails = []config.AdditionalDisplayItem{
		{
			Annotation: "annotation",
			Title:      "Annotation",
		},
	}
	config.Set(cfg)

	w := Workload{}
	w.ParseReplicationController(fakeReplicationController())

	assert.Equal("reviews-v1", w.Name)
	assert.Equal("bar", w.Labels["foo"])
	assert.Equal("v1", w.Labels["version"])
	assert.Equal("2709198702082918", w.ResourceVersion)
	assert.Equal("ReplicationController", w.Type)
	assert.Equal(int32(1), w.DesiredReplicas)
	assert.Equal(int32(1), w.CurrentReplicas)
	assert.Equal(int32(1), w.AvailableReplicas)
	assert.Len(w.AdditionalDetails, 1)
	assert.Equal("Annotation", w.AdditionalDetails[0].Title)
	assert.Equal("value-annot", w.AdditionalDetails[0].Value)
}

func TestParseDeploymentConfigToWorkload(t *testing.T) {
	assert := assert.New(t)
	cfg := config.NewConfig()
	cfg.AdditionalDisplayDetails = []config.AdditionalDisplayItem{
		{
			Annotation: "annotation",
			Title:      "Annotation",
		},
	}
	config.Set(cfg)

	w := Workload{}
	w.ParseDeploymentConfig(fakeDeploymentConfig())

	assert.Equal("reviews-v1", w.Name)
	assert.Equal("bar", w.Labels["foo"])
	assert.Equal("v1", w.Labels["version"])
	assert.Equal("2709198702082918", w.ResourceVersion)
	assert.Equal(int32(1), w.DesiredReplicas)
	assert.Equal(int32(1), w.CurrentReplicas)
	assert.Equal(int32(1), w.AvailableReplicas)
	assert.Len(w.AdditionalDetails, 1)
	assert.Equal("Annotation", w.AdditionalDetails[0].Title)
	assert.Equal("value-annot", w.AdditionalDetails[0].Value)
}

func TestParsePodToWorkload(t *testing.T) {
	assert := assert.New(t)
	cfg := config.NewConfig()
	cfg.AdditionalDisplayDetails = []config.AdditionalDisplayItem{
		{
			Annotation: "annotation",
			Title:      "Annotation",
		},
	}
	config.Set(cfg)

	w := Workload{}
	w.ParsePod(fakePod())

	assert.Equal("reviews-v1", w.Name)
	assert.Equal("bar", w.Labels["foo"])
	assert.Equal("v1", w.Labels["version"])
	assert.Equal("2709198702082918", w.ResourceVersion)
	assert.Equal("Pod", w.Type)
	assert.Equal(int32(1), w.DesiredReplicas)
	assert.Equal(int32(1), w.CurrentReplicas)
	assert.Equal(int32(1), w.AvailableReplicas)
	assert.Len(w.AdditionalDetails, 1)
	assert.Equal("Annotation", w.AdditionalDetails[0].Title)
	assert.Equal("value-annot", w.AdditionalDetails[0].Value)
}

func TestParsePodsToWorkload(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	w := Workload{}
	w.ParsePods("workload-from-controller", "Controller", []core_v1.Pod{*fakePod()})

	assert.Equal("workload-from-controller", w.Name)
	assert.Equal("bar", w.Labels["foo"])
	assert.Equal("v1", w.Labels["version"])
	assert.Equal("2709198702082918", w.ResourceVersion)
	assert.Equal("Controller", w.Type)
	assert.Equal(int32(1), w.DesiredReplicas)
	assert.Equal(int32(1), w.CurrentReplicas)
	assert.Equal(int32(1), w.AvailableReplicas)
}

func TestParsePodWithoutLabelsToWorkload(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	fakePod := fakePod()
	fakePod.Labels = nil
	w := Workload{}
	w.ParsePod(fakePod)

	assert.Equal(map[string]string{}, w.Labels)
}

func TestIsGatewayLabelsToWorkload(t *testing.T) {
	cases := map[string]struct {
		Labels              map[string]string
		ShouldBeGateway     bool
		TemplateAnnotations map[string]string
	}{
		"istioctl created egress gateway should be a gateway": {
			Labels: map[string]string{
				"operator.istio.io/component": "EgressGateways",
				"version":                     "v1",
			},
			ShouldBeGateway: true,
		},
		"istioctl created ingress gateway should be a gateway": {
			Labels: map[string]string{
				"operator.istio.io/component": "IngressGateways",
				"version":                     "v1",
			},
			ShouldBeGateway: true,
		},
		"gateway with bad label should not be a gateway": {
			Labels: map[string]string{
				"operator.istio.io/component": "EgressGateway",
				"istio-system":                "ingressgateway",
			},
			ShouldBeGateway: false,
		},
		"gateway-injection created gateway should be a gateway": {
			TemplateAnnotations: map[string]string{
				"inject.istio.io/templates": "gateway",
			},
			ShouldBeGateway: true,
		},
		"gateway-api created gateway should be a gateway": {
			Labels: map[string]string{
				"istio.io/gateway-name": "gateway",
			},
			ShouldBeGateway: true,
		},
		"gateway with istio ingress label should be a gateway": {
			Labels: map[string]string{
				"istio": "ingressgateway",
			},
			ShouldBeGateway: true,
		},
		"gateway with istio egress label should be a gateway": {
			Labels: map[string]string{
				"istio": "egressgateway",
			},
			ShouldBeGateway: true,
		},
		"no labels and no annotations should not be a gateway": {
			ShouldBeGateway: false,
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)

			w := Workload{}
			w.Labels = tc.Labels
			w.TemplateAnnotations = tc.TemplateAnnotations

			require.Equal(tc.ShouldBeGateway, w.IsGateway())
		})
	}
}

func fakeDeployment() *apps_v1.Deployment {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	replicas := int32(1)
	return &apps_v1.Deployment{
		TypeMeta: meta_v1.TypeMeta{
			Kind: "Deployment",
		},
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "reviews-v1",
			CreationTimestamp: meta_v1.NewTime(t1),
			ResourceVersion:   "2709198702082918",
			Annotations: map[string]string{
				"annotation-1": "value-annot-1",
				"annotation-2": "value-annot-2",
				"annotation-3": "value-annot-3",
			},
		},
		Spec: apps_v1.DeploymentSpec{
			Template: core_v1.PodTemplateSpec{
				ObjectMeta: meta_v1.ObjectMeta{
					Labels: map[string]string{"foo": "bar", "version": "v1"},
				},
			},
			Replicas: &replicas,
		},
		Status: apps_v1.DeploymentStatus{
			Replicas:          1,
			AvailableReplicas: 1,
		},
	}
}

func fakeReplicaSet() *apps_v1.ReplicaSet {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	replicas := int32(1)
	return &apps_v1.ReplicaSet{
		TypeMeta: meta_v1.TypeMeta{
			Kind: "ReplicaSet",
		},
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "reviews-v1",
			CreationTimestamp: meta_v1.NewTime(t1),
			ResourceVersion:   "2709198702082918",
			Annotations:       map[string]string{"annotation": "value-annot"},
		},
		Spec: apps_v1.ReplicaSetSpec{
			Template: core_v1.PodTemplateSpec{
				ObjectMeta: meta_v1.ObjectMeta{
					Labels: map[string]string{"foo": "bar", "version": "v1"},
				},
			},
			Replicas: &replicas,
		},
		Status: apps_v1.ReplicaSetStatus{
			Replicas:          1,
			AvailableReplicas: 1,
		},
	}
}

func fakeReplicationController() *core_v1.ReplicationController {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	replicas := int32(1)
	return &core_v1.ReplicationController{
		TypeMeta: meta_v1.TypeMeta{
			Kind: "ReplicationController",
		},
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "reviews-v1",
			CreationTimestamp: meta_v1.NewTime(t1),
			ResourceVersion:   "2709198702082918",
			Annotations:       map[string]string{"annotation": "value-annot"},
		},
		Spec: core_v1.ReplicationControllerSpec{
			Template: &core_v1.PodTemplateSpec{
				ObjectMeta: meta_v1.ObjectMeta{
					Labels: map[string]string{"foo": "bar", "version": "v1"},
				},
			},
			Replicas: &replicas,
		},
		Status: core_v1.ReplicationControllerStatus{
			Replicas:          1,
			AvailableReplicas: 1,
		},
	}
}

func fakeDeploymentConfig() *osapps_v1.DeploymentConfig {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	return &osapps_v1.DeploymentConfig{
		TypeMeta: meta_v1.TypeMeta{
			Kind: "DeploymentConfig",
		},
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "reviews-v1",
			CreationTimestamp: meta_v1.NewTime(t1),
			ResourceVersion:   "2709198702082918",
			Annotations:       map[string]string{"annotation": "value-annot"},
		},
		Spec: osapps_v1.DeploymentConfigSpec{
			Template: &core_v1.PodTemplateSpec{
				ObjectMeta: meta_v1.ObjectMeta{
					Labels: map[string]string{"foo": "bar", "version": "v1"},
				},
			},
			Replicas: 1,
		},
		Status: osapps_v1.DeploymentConfigStatus{
			Replicas:          1,
			AvailableReplicas: 1,
		},
	}
}

func fakePod() *core_v1.Pod {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")

	return &core_v1.Pod{
		TypeMeta: meta_v1.TypeMeta{
			Kind: "Pod",
		},
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "reviews-v1",
			CreationTimestamp: meta_v1.NewTime(t1),
			ResourceVersion:   "2709198702082918",
			Labels:            map[string]string{"foo": "bar", "version": "v1"},
			Annotations:       map[string]string{"annotation": "value-annot"},
		},
		Status: core_v1.PodStatus{
			Phase: "Running",
		},
	}
}
