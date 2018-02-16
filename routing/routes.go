package routing

import (
	"net/http"

	"github.com/swift-sunshine/swscore/handlers"
)

// Route describes a single route
type Route struct {
	Name        string
	Method      string
	Pattern     string
	HandlerFunc http.HandlerFunc
}

// Routes holds an array of Route
type Routes struct {
	Routes []Route
}

// NewRoutes creates and returns all the API routes
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
			"/api/namespaces/{namespace}/services",
			handlers.ServiceList,
		},
		{
			"NamespaceList",
			"GET",
			"/api/namespaces",
			handlers.NamespaceList,
		},
	}

	return
}
