package prometheus

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
)

func TestWrapPrometheusAPIIfConfigured(t *testing.T) {
	base := &noopAPI{}
	conf := config.NewConfig()

	api := wrapPrometheusAPIIfConfigured(*conf, base)
	assert.Equal(t, base, api)

	conf.Deployment.Logger.LogPrometheusQueries = true
	api = wrapPrometheusAPIIfConfigured(*conf, base)
	_, ok := api.(*PromQueryTraceAPI)
	assert.True(t, ok)
}
