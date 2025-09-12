package ambient

import (
	"testing"

	"github.com/stretchr/testify/assert"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

const (
	ns1 = "bookinfo"
)

func TestValidAmbientWorkloads(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)
	var vals []*models.IstioCheck
	var valid bool

	// Test workload with no ambient issues
	workload := data.CreateWorkload(ns1, "valid-ambient-workload", map[string]string{})
	workload.IsAmbient = true
	workload.IstioSidecar = false

	labels := map[string]string{
		conf.IstioLabels.AmbientNamespaceLabel: conf.IstioLabels.AmbientNamespaceLabelValue,
	}

	vals, valid = NewAmbientWorkloadChecker(
		conf.KubernetesConfig.ClusterName,
		conf,
		workload,
		ns1,
		models.Namespaces{models.Namespace{Name: ns1, Labels: labels}},
		[]*security_v1.AuthorizationPolicy{},
	).Check()

	assert.Empty(vals)
	assert.True(valid)
}

func TestWorkloadBothSidecarAndAmbientLabels(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	labels := map[string]string{
		conf.IstioLabels.AmbientNamespaceLabel: conf.IstioLabels.AmbientNamespaceLabelValue,
		conf.IstioLabels.InjectionLabelName:    "enabled",
		conf.IstioLabels.InjectionLabelRev:     "latest",
		config.IstioInjectionAnnotation:        "enabled",
	}

	// Test workload with both sidecar and ambient annotation
	workload := data.CreateWorkload(ns1, "mixed-workload", labels)

	vals, valid := NewAmbientWorkloadChecker(
		conf.KubernetesConfig.ClusterName,
		conf,
		workload,
		ns1,
		models.Namespaces{models.Namespace{Name: ns1, Labels: labels}},
		[]*security_v1.AuthorizationPolicy{},
	).Check()

	assert.NotEmpty(vals)
	assert.False(valid)
	assert.NoError(validations.ConfirmIstioCheckMessage("workload.ambient.sidecarandlabel", vals[0]))
}

func TestWorkloadWaypointAndNotAmbient(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	labels := map[string]string{
		conf.IstioLabels.AmbientWaypointUseLabel: "true",
	}

	// Test workload with waypoint annotation and isAmbient
	workload := data.CreateWorkload(ns1, "mixed-workload", labels)
	workload.IsAmbient = false
	workload.Pods = models.Pods{data.CreatePod("w-pod", labels, false, true, false)}

	vals, valid := NewAmbientWorkloadChecker(
		conf.KubernetesConfig.ClusterName,
		conf,
		workload,
		ns1,
		models.Namespaces{models.Namespace{Name: ns1, Labels: labels}},
		[]*security_v1.AuthorizationPolicy{},
	).Check()

	assert.NotEmpty(vals)
	assert.False(valid)
	assert.NoError(validations.ConfirmIstioCheckMessage("workload.ambient.waypointandnotambient", vals[0]))
}

func TestWorkloadReferencesNonExistentWaypoint(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	labels := map[string]string{
		conf.IstioLabels.AmbientWaypointUseLabel: "true",
	}

	// Test workload with waypoint annotation and empty Waypoints
	workload := data.CreateWorkload(ns1, "mixed-workload", labels)
	workload.IsAmbient = true
	workload.WaypointWorkloads = make([]models.WorkloadReferenceInfo, 0)
	workload.Pods = models.Pods{data.CreatePod("w-pod", labels, true, false, false)}

	vals, valid := NewAmbientWorkloadChecker(
		conf.KubernetesConfig.ClusterName,
		conf,
		workload,
		ns1,
		models.Namespaces{models.Namespace{Name: ns1, Labels: labels}},
		[]*security_v1.AuthorizationPolicy{},
	).Check()

	assert.NotEmpty(vals)
	assert.False(valid)
	assert.NoError(validations.ConfirmIstioCheckMessage("workload.ambient.waypointnotfound", vals[0]))
}

func TestWorkloadPodWithSidecarLabelAndAmbientRedirection(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	labels := map[string]string{
		conf.IstioLabels.InjectionLabelName: "enabled",
		conf.IstioLabels.InjectionLabelRev:  "latest",
		config.IstioInjectionAnnotation:     "enabled",
	}

	// Test workload with sidecar labels and ambient pod
	workload := data.CreateWorkload(ns1, "mixed-workload", labels)
	workload.Pods = models.Pods{data.CreatePod("ambient-pod", labels, true, false, false)}

	vals, valid := NewAmbientWorkloadChecker(
		conf.KubernetesConfig.ClusterName,
		conf,
		workload,
		ns1,
		models.Namespaces{models.Namespace{Name: ns1, Labels: labels}},
		[]*security_v1.AuthorizationPolicy{},
	).Check()

	assert.NotEmpty(vals)
	assert.False(valid)
	assert.NoError(validations.ConfirmIstioCheckMessage("workload.ambient.podsidecarlabelandambientredirection", vals[0]))
}

func TestWorkloadPodWithSidecarInjectAndAmbientLabel(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	labels := map[string]string{
		conf.IstioLabels.AmbientNamespaceLabel: conf.IstioLabels.AmbientNamespaceLabelValue,
	}

	// Test workload with ambient labels and ambient pod
	workload := data.CreateWorkload(ns1, "mixed-workload", labels)
	workload.Pods = models.Pods{data.CreatePod("ambient-pod", labels, false, true, false)}

	vals, valid := NewAmbientWorkloadChecker(
		conf.KubernetesConfig.ClusterName,
		conf,
		workload,
		ns1,
		models.Namespaces{models.Namespace{Name: ns1, Labels: labels}},
		[]*security_v1.AuthorizationPolicy{},
	).Check()

	assert.NotEmpty(vals)
	assert.False(valid)
	assert.NoError(validations.ConfirmIstioCheckMessage("workload.ambient.podsidecarinjectandambientlabel", vals[0]))
}

func TestWorkloadSidecarInAmbientNamespace(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	labels := map[string]string{}

	// Test workload with sidecar and ambient namespace
	workload := data.CreateWorkload(ns1, "mixed-workload", labels)
	workload.IstioSidecar = true
	workload.Pods = models.Pods{data.CreatePod("ambient-pod", labels, false, true, false)}

	vals, valid := NewAmbientWorkloadChecker(
		conf.KubernetesConfig.ClusterName,
		conf,
		workload,
		ns1,
		models.Namespaces{models.Namespace{Name: ns1, Labels: labels, IsAmbient: true}},
		[]*security_v1.AuthorizationPolicy{},
	).Check()

	assert.NotEmpty(vals)
	assert.False(valid)
	assert.NoError(validations.ConfirmIstioCheckMessage("workload.ambient.sidecarinambientnamespace", vals[0]))
}

func TestWorkloadHasAuthPolicyAndNoWaypoint(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	labels := map[string]string{}

	// Test workload with sidecar and ambient namespace
	workload := data.CreateWorkload(ns1, "mixed-workload", labels)
	workload.WaypointWorkloads = make([]models.WorkloadReferenceInfo, 0)

	vals, valid := NewAmbientWorkloadChecker(
		conf.KubernetesConfig.ClusterName,
		conf,
		workload,
		ns1,
		models.Namespaces{models.Namespace{Name: ns1, Labels: labels}},
		[]*security_v1.AuthorizationPolicy{data.CreateEmptyAuthorizationPolicy("test", ns1)},
	).Check()

	assert.NotEmpty(vals)
	assert.False(valid)
	assert.NoError(validations.ConfirmIstioCheckMessage("workload.ambient.authpolicybutnowaypoint", vals[0]))
}

func TestWorkloadZeroReplicasInAmbientNamespace(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	labels := map[string]string{}

	// Test workload with 0 replicas (no pods) in ambient namespace
	// This should NOT trigger KIA1316 error because there are no pods to check for sidecars or Ambient
	workload := data.CreateWorkload(ns1, "zero-replica-workload", labels)
	workload.Pods = models.Pods{} // No pods = 0 replicas

	vals, valid := NewAmbientWorkloadChecker(
		conf.KubernetesConfig.ClusterName,
		conf,
		workload,
		ns1,
		models.Namespaces{models.Namespace{Name: ns1, Labels: labels, IsAmbient: true}},
		[]*security_v1.AuthorizationPolicy{},
	).Check()

	// Should not have any validation errors because there are no pods to check
	assert.Empty(vals)
	assert.True(valid)
}

func TestWaypointZeroReplicas(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	// Test waypoint with 0 replicas (no pods)
	// This should NOT trigger KIA1312 or KIA1316 errors because waypoints are always ambient
	waypointLabels := map[string]string{
		config.WaypointLabel: config.WaypointLabelValue,
	}

	workload := data.CreateWorkload("ns1", "zero-replica-waypoint", waypointLabels)
	workload.IstioSidecar = false // This should be false when there are no pods
	workload.IsAmbient = true     // Waypoints should always be ambient
	workload.Pods = models.Pods{} // No pods = 0 replicas

	vals, valid := NewAmbientWorkloadChecker(
		conf.KubernetesConfig.ClusterName,
		conf,
		workload,
		ns1,
		models.Namespaces{models.Namespace{Name: ns1, Labels: map[string]string{}, IsAmbient: true}},
		[]*security_v1.AuthorizationPolicy{},
	).Check()

	// Should not have any validation errors because waypoints are always ambient
	assert.Empty(vals)
	assert.True(valid)
}
