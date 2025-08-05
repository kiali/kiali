package workloads

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
	workload := data.CreateWorkload("valid-ambient-workload", map[string]string{})
	workload.Namespace = ns1
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
		conf.IstioLabels.AmbientNamespaceLabel:               conf.IstioLabels.AmbientNamespaceLabelValue,
		conf.IstioLabels.InjectionLabelName:                  "enabled",
		conf.IstioLabels.InjectionLabelRev:                   "latest",
		conf.ExternalServices.Istio.IstioInjectionAnnotation: "enabled",
	}

	// Test workload with both sidecar and ambient annotation
	workload := data.CreateWorkload("mixed-workload", labels)
	workload.Namespace = ns1

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
	workload := data.CreateWorkload("mixed-workload", labels)
	workload.Namespace = ns1
	workload.IsAmbient = false

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
	workload := data.CreateWorkload("mixed-workload", labels)
	workload.Namespace = ns1
	workload.IsAmbient = true
	workload.WaypointWorkloads = make([]models.WorkloadReferenceInfo, 0)

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
		conf.IstioLabels.InjectionLabelName:                  "enabled",
		conf.IstioLabels.InjectionLabelRev:                   "latest",
		conf.ExternalServices.Istio.IstioInjectionAnnotation: "enabled",
	}

	// Test workload with sidecar labels and ambient pod
	workload := data.CreateWorkload("mixed-workload", labels)
	workload.Namespace = ns1
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
	workload := data.CreateWorkload("mixed-workload", labels)
	workload.Namespace = ns1
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
	workload := data.CreateWorkload("mixed-workload", labels)
	workload.Namespace = ns1
	workload.IstioSidecar = true

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
	workload := data.CreateWorkload("mixed-workload", labels)
	workload.Namespace = ns1
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
