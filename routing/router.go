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

	staticFileServer := http.FileServer(http.Dir(conf.Server.StaticContentRootDirectory))

	if webRoot != "/" {
		// help the user out - if a request comes in for "/", redirect to our true webroot
		rootRouter.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, webRootWithSlash, http.StatusFound)
		})

		appRouter = rootRouter.PathPrefix(conf.Server.WebRoot).Subrouter()
		staticFileServer = http.StripPrefix(webRootWithSlash, staticFileServer)

		// Because of OIDC, when we receive a request for the webroot without
		// the trailing slash, we can not redirect the user to the correct
		// webroot as the hash params are lost (and they are not sent to the
		// server).
		//
		// See https://github.com/kiali/kiali/issues/3103
		rootRouter.HandleFunc(webRoot, func(w http.ResponseWriter, r *http.Request) {
			r.URL.Path = webRootWithSlash
			rootRouter.ServeHTTP(w, r)
		})
	} else {
		webRootWithSlash = "/"
	}

	appRouter = appRouter.StrictSlash(true)

	// Build our API server routes and install them.
	apiRoutes := NewRoutes()
	authenticationHandler, _ := handlers.NewAuthenticationHandler()
	for _, route := range apiRoutes.Routes {
		handlerFunction := metricHandler(route.HandlerFunc, route)
		if route.Authenticated {
			handlerFunction = authenticationHandler.Handle(handlerFunction)
		} else {
			handlerFunction = authenticationHandler.HandleUnauthenticated(handlerFunction)
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

	if conf.Auth.Strategy == config.AuthStrategyOpenId {
		rootRouter.Methods("GET").Path(webRootWithSlash).HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !handlers.OpenIdCodeFlowHandler(w, r) {
				// If the OpenID handler does not handle the request, pass the
				// request to the file server.
				staticFileServer.ServeHTTP(w, r)
			}
		})
	}

	rootRouter.PathPrefix(webRootWithSlash).Handler(staticFileServer)

	return rootRouter
}

func metricHandler(next http.Handler, route Route) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		promtimer := internalmetrics.GetAPIProcessingTimePrometheusTimer(route.Name)
		defer promtimer.ObserveDuration()
		next.ServeHTTP(w, r)
	})
}
