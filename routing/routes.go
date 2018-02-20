package routing

import (
	"net/http"

	"github.com/swift-sunshine/swscore/handlers"
)

type Route struct {
	Name        string
	Method      string
	Pattern     string
	HandlerFunc http.HandlerFunc
}

type Routes struct {
	Routes []Route
}

func NewRoutes() (r *Routes) {
	r = new(Routes)

	r.Routes = []Route{
		{
			"Root",
			"GET",
			"/api",
			handlers.Root,
		},
		{
			"ServiceList",
			"GET",
			"/api/services",
			handlers.ServiceList,
		},

		{
			"ServiceShow",
			"GET",
			"/api/namespaces/{namespace_id}/services/{id}",
			handlers.ServiceShow,
		},
		{
			"ServicesNamespace",
			"GET",
			"/api/namespaces/{id}/services",
			handlers.ServicesNamespace,
		},
	}

	return
}
