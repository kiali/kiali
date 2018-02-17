package prometheus

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/prometheus/client_golang/api"
	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/swift-sunshine/swscore/config"
)

const istio_request_query = "istio_request_count{destination_service=~\"%s.%s.*\"}"

// Client for Prometheus API.
// It hides the way we query Prometheus offering a layer with a high level defined API.
type Client struct {
	p8s api.Client
}

// NewClient creates a new client to the Prometheus API.
// It returns an error on any problem.
func NewClient() (*Client, error) {
	client := Client{}
	if config.Get() == nil {
		return nil, errors.New("config.Get() must be not null")
	}
	p8s, err := api.NewClient(api.Config{Address: config.Get().PrometheusServiceUrl})
	if err != nil {
		return nil, err
	}
	client.p8s = p8s
	return &client, nil
}

// GetSourceServices returns a map of source services for a given service identified by its namespace and service name.
// Returned map has a destination version as a key and a "<origin service>/<origin version>" pair as value.
// Destination service is not included in the map as it is passed as argument.
// It returns an error on any problem.
func (in *Client) GetSourceServices(namespace string, servicename string) (map[string]string, error) {
	query := fmt.Sprintf(istio_request_query, servicename, namespace)
	api := v1.NewAPI(in.p8s)
	result, err := api.Query(context.Background(), query, time.Now())
	if err != nil {
		return nil, err
	}
	routes := make(map[string]string)
	switch result.Type() {
	case model.ValVector:
		matrix := result.(model.Vector)
		for _, sample := range matrix {
			metric := sample.Metric
			index := fmt.Sprintf("%s", metric["destination_version"])
			sourceService := string(metric["source_service"])
			// .svc sufix is a pure Istio label, I guess we can skip it at the moment for clarity
			if i := strings.Index(sourceService, ".svc"); i > 0 {
				sourceService = sourceService[:i]
			}
			routes[index] = fmt.Sprintf("%s/%s", sourceService, metric["source_version"])
		}
	}
	return routes, nil
}

// API returns the Prometheus V1 HTTP API for performing calls not supported natively by thi client
func (in *Client) Api() v1.API {
	return v1.NewAPI(in.p8s)
}
