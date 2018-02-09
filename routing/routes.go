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

type Routes []Route

// Constant that defines all the paths and the handlers for those paths
var paths = Routes{
	Route{
		"Root",
		"GET",
		"/api",
		handlers.Root,
	},
}
