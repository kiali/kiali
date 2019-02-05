package business

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"time"

	"github.com/kiali/kiali/config"
)

type Trace struct {
	Id string `json:"traceID"`
}

type RequestTrace struct {
	Traces []Trace `json:"data"`
}

// ConfigToJS generates env.js file from Kiali config
func getErrorTracesFromJaeger(service string) (err error, errorTraces int) {
	errorTraces = 0
	err = nil

	if config.Get().ExternalServices.Jaeger.Service != "" {
		u, errParse := url.Parse(fmt.Sprintf("http://%s/api/traces", config.Get().ExternalServices.Jaeger.Service))
		if errParse != nil {
			err = errParse
		} else {
			q := u.Query()
			q.Set("lookback", "1h")
			q.Set("service", service)
			t := time.Now().UnixNano() / 1000
			q.Set("start", fmt.Sprintf("%d", t-60*60*1000*1000))
			q.Set("end", fmt.Sprintf("%d", t))
			q.Set("tags", "{\"error\":\"true\"}")
			u.RawQuery = q.Encode()
			timeout := time.Duration(3000 * time.Millisecond)
			client := http.Client{
				Timeout: timeout,
			}
			resp, reqError := client.Get(u.String())
			if reqError != nil {
				err = reqError
			} else {
				defer resp.Body.Close()
				body, errRead := ioutil.ReadAll(resp.Body)
				if errRead != nil {
					err = errRead
					return err, errorTraces
				}
				var traces RequestTrace
				if errMarshal := json.Unmarshal([]byte(body), &traces); errMarshal != nil {
					err = errMarshal
					return err, errorTraces
				}
				errorTraces = len(traces.Traces)
			}
		}
	}
	return err, errorTraces
}
