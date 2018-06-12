package routing

import (
	"net/http"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/config"
)

// NewRouter creates the router with all API routes and the static files handler
func NewRouter() *mux.Router {

	router := mux.NewRouter().StrictSlash(true)

	// Build our API server routes and install them.
	routes := NewRoutes()
	for _, route := range routes.Routes {
		var handlerFunction http.Handler
		if handlerFunction = route.HandlerFunc; route.Authenticated {
			handlerFunction = config.AuthenticationHandler(handlerFunction)
		}
		router.
			Methods(route.Method).
			Path(route.Pattern).
			Name(route.Name).
			Handler(handlerFunction)
	}
	conf := config.Get()
	// All client-side routes are prefixed with /console.
	// They are forwarded to index.html and will be handled by react-router.
	router.PathPrefix("/console").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, conf.Server.StaticContentRootDirectory+"/index.html")
	})

	// Build our static files routes by first creating the file server handler that will serve
	// the webapp js files and other static content. Then tell the router about our fixed
	// routes which pass all static file requests to the file handler.
	fileServerHandler := http.FileServer(http.Dir(conf.Server.StaticContentRootDirectory))
	router.PathPrefix("/").Handler(fileServerHandler)

	return router
}
