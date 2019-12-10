package jaeger

import (
	"encoding/json"
	"net/http"
	"net/url"
	"path"

	"github.com/kiali/kiali/log"
)

func getServices(client http.Client, endpoint *url.URL) (services []string, code int, err error) {
	code = 0
	services = []string{}
	u := endpoint
	u.Path = path.Join(u.Path, "/api/services")

	resp, code, err := makeRequest(client, u.String(), nil)

	if err != nil {
		log.Errorf("Error request Jaeger URL : %s", err)
		return
	}
	var jaegerResponse struct {
		Data []string `json:"data"`
	}

	if err = json.Unmarshal([]byte(resp), &jaegerResponse); err != nil {
		log.Errorf("Error Unmarshal Jaeger Response fetching Services: %s", err)
		return
	}
	services = jaegerResponse.Data
	code = 200
	return
}
