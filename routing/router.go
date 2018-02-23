package routing

import (
	"net/http"

	"github.com/gorilla/mux"

	"github.com/swift-sunshine/swscore/config"
)

// NewRouter creates the router with all API routes and the static files handler
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
	fileServerHandler := http.FileServer(http.Dir(conf.Server.StaticContentRootDirectory))
	router.PathPrefix("/static").Handler(fileServerHandler)
	router.PathPrefix("/asset-manifest.json").Handler(fileServerHandler)
	router.PathPrefix("/favicon.ico").Handler(fileServerHandler)
	router.PathPrefix("/manifest.json").Handler(fileServerHandler)
	router.PathPrefix("/service-worker.js").Handler(fileServerHandler)

	// "/console" is an alias for "/"
	router.PathPrefix("/console").Handler(http.StripPrefix("/console", fileServerHandler))

	// All other routes are forwarded to index.html and can be handled by the client-side router.
	router.PathPrefix("/").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, conf.Server.StaticContentRootDirectory+"/index.html")
	})

	return router
}
