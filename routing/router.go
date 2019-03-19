package routing

import (
	"net/http"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// NewRouter creates the router with all API routes and the static files handler
func NewRouter() *mux.Router {

	conf := config.Get()
	webRoot := conf.Server.WebRoot
	webRootWithSlash := webRoot + "/"

	rootRouter := mux.NewRouter().StrictSlash(false)
	appRouter := rootRouter

	// Due to PathPrefix matching behavoir on sub-routers
	// we need to explicitly redirect /foo -> /foo/
	// See https://github.com/gorilla/mux/issues/31
	if webRoot != "/" {
		rootRouter.HandleFunc(webRoot, func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, webRootWithSlash, http.StatusFound)
		})

		// help the user out - if a request comes in for "/", redirect to our true webroot
		rootRouter.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, webRootWithSlash, http.StatusFound)
		})

		appRouter = rootRouter.PathPrefix(conf.Server.WebRoot).Subrouter()
	}

	appRouter = appRouter.StrictSlash(true)

	// Build our API server routes and install them.
	apiRoutes := NewRoutes()
	authenticationHandler, _ := handlers.NewAuthenticationHandler()
	for _, route := range apiRoutes.Routes {
		var handlerFunction http.Handler = authenticationHandler.HandleUnauthenticated(route.HandlerFunc)
		handlerFunction = metricHandler(handlerFunction, route)
		if route.Authenticated {
			handlerFunction = authenticationHandler.Handle(route.HandlerFunc)
		}
		appRouter.
			Methods(route.Method).
			Path(route.Pattern).
			Name(route.Name).
			Handler(handlerFunction)
	}

	// All client-side routes are prefixed with /console.
	// They are forwarded to index.html and will be handled by react-router.
	appRouter.PathPrefix("/console").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, conf.Server.StaticContentRootDirectory+"/index.html")
	})

	// Build our static files routes by first creating the file server handler that will serve
	// the webapp js files and other static content. Then tell the router about our fixed
	// routes which pass all static file requests to the file handler.
	staticFileServer := http.FileServer(http.Dir(conf.Server.StaticContentRootDirectory))
	if webRoot != "/" {
		staticFileServer = http.StripPrefix(webRootWithSlash, staticFileServer)
	}
	appRouter.PathPrefix("/").Handler(staticFileServer)

	return rootRouter
}

func metricHandler(next http.Handler, route Route) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		promtimer := internalmetrics.GetAPIProcessingTimePrometheusTimer(route.Name)
		defer promtimer.ObserveDuration()
		next.ServeHTTP(w, r)
	})
}
