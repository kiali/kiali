package mesh

import (
	"context"
	nethttp "net/http"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/status"
)

type Response struct {
	Message string
	Code    int
}

// StatusGetter var allows test code to mock out this function with a mock
var StatusGetter func(context.Context, *config.Config, kubernetes.ClientFactory, cache.KialiCache, *grafana.Service) status.StatusInfo = status.Get

// Error panics with InternalServerError (500) and the provided message
func Error(message string) {
	Panic(message, nethttp.StatusInternalServerError)
}

// BadRequest panics with BadRequest and the provided message
func BadRequest(message string) {
	Panic(message, nethttp.StatusBadRequest)
}

// Forbidden panics with Forbidden and the provided message
func Forbidden(message string) {
	Panic(message, nethttp.StatusForbidden)
}

// Panic panics with the provided HTTP response code and message
func Panic(message string, code int) Response {
	panic(Response{
		Message: message,
		Code:    code,
	})
}

// CheckError panics with the supplied error if it is non-nil
func CheckError(err error) {
	if err != nil {
		panic(err.Error())
	}
}

// CheckUnavailable panics with StatusServiceUnavailable (503) and the supplied error if it is non-nil
func CheckUnavailable(err error) {
	if err != nil {
		Panic(err.Error(), nethttp.StatusServiceUnavailable)
	}
}

// IsOK just validates that a telemetry label value is not empty
func IsOK(telemetryVal string) bool {
	return telemetryVal != ""
}
