package routing

import (
	"net/http"

	"github.com/gorilla/mux"

	"github.com/swift-sunshine/swscore/config"
)

func NewRouter(conf *config.Config) *mux.Router {

	router := mux.NewRouter().StrictSlash(true)

	// Build our API server routes and install them.
	routes := NewRoutes()
	for _, route := range routes.Routes {
		router.
			Methods(route.Method).
			Path(route.Pattern).
			Name(route.Name).
			Handler(route.HandlerFunc)
	}

	// Build our console routes by first creating the file server handler that will serve
	// the webapp js files and other static content. Then tell the router about our fixed
	// routes which pass all static file requests to the file handler.
	fileServerHandler := http.FileServer(http.Dir(conf.Server.Static_Content_Root_Directory))
	router.PathPrefix("/console").Handler(http.StripPrefix("/console", fileServerHandler))
	router.PathPrefix("/").Handler(fileServerHandler)

	return router
}
