package sidecars

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestSidecarWithoutSelectorOutOfControlPlane(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	vals, valid := GlobalChecker{
		Cluster:   config.DefaultClusterID,
		Discovery: &istiotest.FakeDiscovery{},
		Sidecar:   data.CreateSidecar("sidecar1", "bookinfo"),
	}.Check()

	assert.Empty(vals)
	assert.True(valid)
}

func TestSidecarWithoutSelectorInControlPlane(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vals, valid := GlobalChecker{
		Cluster:   config.DefaultClusterID,
		Discovery: &istiotest.FakeDiscovery{},
		Sidecar:   data.CreateSidecar("sidecar1", config.IstioNamespaceDefault),
	}.Check()

	assert.Empty(vals)
	assert.True(valid)
}

func TestSidecarWithSelectorOutOfControlPlane(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	vals, valid := GlobalChecker{
		Cluster:   config.DefaultClusterID,
		Discovery: &istiotest.FakeDiscovery{},
		Sidecar: data.AddSelectorToSidecar(map[string]string{
			"app": "reviews",
		}, data.CreateSidecar("sidecar1", "bookinfo")),
	}.Check()

	assert.Empty(vals)
	assert.True(valid)
}

func TestSidecarWithSelectorInControlPlane(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vals, valid := GlobalChecker{
		Cluster:   config.DefaultClusterID,
		Discovery: &istiotest.FakeDiscovery{},
		Sidecar: data.AddSelectorToSidecar(map[string]string{
			"app": "reviews",
		}, data.CreateSidecar("sidecar1", config.IstioNamespaceDefault)),
	}.Check()

	assert.NotEmpty(vals)
	assert.True(valid)

	assert.Len(vals, 1)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("sidecar.global.selector", vals[0]))
}
