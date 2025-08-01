package appender

import (
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

// package-private test util functions (used by multiple test files)

// Setup mocks

func setupMocked() (*prometheus.Client, *prometheustest.PromAPIMock, error) {
	return setupMockedWithQueryScope("")
}

func setupMockedWithQueryScope(meshId string) (*prometheus.Client, *prometheustest.PromAPIMock, error) {
	testConfig := config.NewConfig()
	if meshId != "" {
		testConfig.ExternalServices.Prometheus.QueryScope = map[string]string{"mesh_id": meshId}
	}
	config.Set(testConfig)
	api := new(prometheustest.PromAPIMock)
	client, err := prometheus.NewClient(*config.NewConfig(), "")
	if err != nil {
		return nil, nil, err
	}
	client.Inject(api)
	return client, api, nil
}

func mockQuery(api *prometheustest.PromAPIMock, query string, ret *model.Vector) {
	api.On(
		"Query",
		mock.Anything,
		query,
		mock.AnythingOfType("time.Time"),
	).Return(*ret, nil)
	api.On(
		"Query",
		mock.Anything,
		query,
		mock.AnythingOfType("time.Time"),
	).Return(*ret, nil)
}
