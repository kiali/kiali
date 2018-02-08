package routing

import (
	"github.com/swift-sunshine/swscore/handlers"
	"net/http"
)

type Route struct {
	Name        string
	Method      string
	Pattern     string
	HandlerFunc http.HandlerFunc
}

type Routes []Route

var paths = Routes{
	Route{
		"Root",
		"GET",
		"/",
		handlers.Root,
	},
}
