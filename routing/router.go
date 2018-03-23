package routing

import (
	"net/http"

	"github.com/gorilla/mux"

	"github.com/kiali/swscore/config"
	"io/ioutil"
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

	// All Jaeger Query routes are prefixed with /jaeger
	// All querys type /jaeger/(.)* are redirect to <Jaeger Host>/api/ with Queryparams.
	router.PathPrefix("/jaeger/{rest:.*}").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		url := config.Get().JaegerServiceURL + "/api/" + mux.Vars(r)["rest"] + "?" + r.URL.RawQuery
		proxyReq, err := http.NewRequest(r.Method, url, nil)
		proxyReq.Header = make(http.Header)
		client := &http.Client{}
		proxyRes, err := client.Do(proxyReq)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		result, err := ioutil.ReadAll(proxyRes.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		defer r.Body.Close()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(proxyRes.StatusCode)
		w.Write(result)
	})

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
