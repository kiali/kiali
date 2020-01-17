package jaeger

import (
	"errors"
	"net/http"
	"net/url"
	"path"

	"github.com/kiali/kiali/config"
)

func getJaegerInfo(client http.Client, endpoint *url.URL) (*JaegerInfo, int, error) {
	jaegerConfig := config.Get().ExternalServices.Tracing
	integration := true
	error := ""
	if !jaegerConfig.Enabled {
		return nil, http.StatusNoContent, nil
	}

	externalUrl := jaegerConfig.URL
	if externalUrl == "" {
		return nil, http.StatusServiceUnavailable, errors.New("Jaeger URL is not set in Kiali configuration")
	}

	if jaegerConfig.InClusterURL == "" {
		return nil, http.StatusServiceUnavailable, errors.New("Jaeger URL in cluster is not set in Kiali configuration")
	}

	u := endpoint
	u.Path = path.Join(u.Path, "/api/services")

	_, code, err := makeRequest(client, u.String(), nil)
	if err != nil || code != 200 {
		integration = false
		error = "Error with internal connection with Jaeger"
		if err != nil {
			error += ": " + err.Error()
		}
	}

	info := &JaegerInfo{
		URL:                externalUrl,
		NamespaceSelector:  jaegerConfig.NamespaceSelector,
		Integration:        integration,
		IntegrationMessage: error,
	}

	return info, http.StatusOK, nil
}
