package routing

import (
	"context"
	"fmt"
	"io"
	"net/http"
	hpprof "net/http/pprof"
	"os"
	"path/filepath"
	rpprof "runtime/pprof"
	"strings"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/business/authentication"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/handlers"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/log"
	kialiprometheus "github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/tracing"
)

// NewRouter creates the router with all API routes and the static files handler
func NewRouter(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom kialiprometheus.ClientInterface,
	traceClientLoader func() tracing.ClientInterface,
	cpm business.ControlPlaneMonitor,
	grafana *grafana.Service,
	discovery *istio.Discovery,
) (*mux.Router, error) {
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

	fileServerHandler := func(w http.ResponseWriter, r *http.Request) {
		urlPath := r.RequestURI
		if r.URL != nil {
			urlPath = r.URL.Path
		}

		if urlPath == webRootWithSlash || urlPath == webRoot || urlPath == webRootWithSlash+"index.html" {
			serveIndexFile(w)
		} else if urlPath == webRootWithSlash+"env.js" {
			serveEnvJsFile(w)
		} else {
			staticFileServer.ServeHTTP(w, r)
		}
	}

	appRouter = appRouter.StrictSlash(true)

	persistor := authentication.NewCookieSessionPersistor(conf)
	strategy := conf.Auth.Strategy

	var authController authentication.AuthController
	if strategy == config.AuthStrategyToken {
		authController = authentication.NewTokenAuthController(persistor, clientFactory, kialiCache, conf, discovery)
	} else if strategy == config.AuthStrategyOpenId {
		authController = authentication.NewOpenIdAuthController(persistor, kialiCache, clientFactory, conf, discovery)
	} else if strategy == config.AuthStrategyOpenshift {
		openshiftOAuthService, err := business.NewOpenshiftOAuthService(context.TODO(), conf, clientFactory.GetSAClients(), clientFactory)
		if err != nil {
			log.Errorf("Error creating OpenshiftOAuthService: %v", err)
			return nil, err
		}
		openshiftAuth, err := authentication.NewOpenshiftAuthController(persistor, openshiftOAuthService, conf)
		if err != nil {
			log.Errorf("Error creating OpenshiftAuthController: %v", err)
			return nil, err
		}
		authController = openshiftAuth
	} else if strategy == config.AuthStrategyHeader {
		authController = authentication.NewHeaderAuthController(persistor, clientFactory.GetSAHomeClusterClient())
	}

	// Build our API server routes and install them.
	apiRoutes := NewRoutes(conf, kialiCache, clientFactory, prom, traceClientLoader, cpm, authController, grafana, discovery)
	authenticationHandler := handlers.NewAuthenticationHandler(*conf, authController, clientFactory.GetSAHomeClusterClient())

	allRoutes := apiRoutes.Routes

	// Add the Profiler handlers if enabled
	if conf.Server.Profiler.Enabled {
		log.Infof("Profiler is enabled")
		allRoutes = append(allRoutes,
			Route{
				Method:        "GET",
				Name:          "PProf Index",
				Pattern:       "/debug/pprof/", // the ending slash is important
				HandlerFunc:   hpprof.Index,
				Authenticated: true,
			},
			Route{
				Method:        "GET",
				Name:          "PProf Cmdline",
				Pattern:       "/debug/pprof/cmdline",
				HandlerFunc:   hpprof.Cmdline,
				Authenticated: true,
			},
			Route{
				Method:        "GET",
				Name:          "PProf Profile",
				Pattern:       "/debug/pprof/profile",
				HandlerFunc:   hpprof.Profile,
				Authenticated: true,
			},
			Route{
				Method:        "GET",
				Name:          "PProf Symbol",
				Pattern:       "/debug/pprof/symbol",
				HandlerFunc:   hpprof.Symbol,
				Authenticated: true,
			},
			Route{
				Method:        "GET",
				Name:          "PProf Trace",
				Pattern:       "/debug/pprof/trace",
				HandlerFunc:   hpprof.Trace,
				Authenticated: true,
			},
		)
		for _, p := range rpprof.Profiles() {
			allRoutes = append(allRoutes,
				Route{
					Method:        "GET",
					Name:          "PProf " + p.Name(),
					Pattern:       "/debug/pprof/" + p.Name(),
					HandlerFunc:   hpprof.Handler(p.Name()).ServeHTTP,
					Authenticated: true,
				},
			)
		}
	}

	for _, route := range allRoutes {
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

	if authController != nil {
		if ac, ok := authController.(*authentication.OpenIdAuthController); ok {
			ac.PostRoutes(appRouter)
		} else if ac, ok := authController.(*authentication.OpenshiftAuthController); ok {
			ac.PostRoutes(appRouter)
		}
	}

	// All client-side routes are prefixed with /console.
	// They are forwarded to index.html and will be handled by react-router.
	appRouter.PathPrefix("/console").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		serveIndexFile(w)
	})

	if authController != nil {
		if ac, ok := authController.(*authentication.OpenIdAuthController); ok {
			authCallback := ac.GetAuthCallbackHandler(http.HandlerFunc(fileServerHandler))
			rootRouter.Methods("GET").Path(webRootWithSlash).Handler(authCallback)
			// Need a URL to catch for openshift too.
		} else if ac, ok := authController.(*authentication.OpenshiftAuthController); ok {
			authCallback := ac.GetAuthCallbackHandler(http.HandlerFunc(fileServerHandler))
			rootRouter.Methods("GET").Path(webRootWithSlash).Handler(authCallback)
		}
	}

	rootRouter.PathPrefix(webRootWithSlash).HandlerFunc(fileServerHandler)

	return rootRouter, nil
}

// statusResponseWriter contains a ResponseWriter and a StatusCode to read in the metrics middleware
type statusResponseWriter struct {
	http.ResponseWriter
	StatusCode int
}

// WriteHeader will be called by any function that needs to set an status code, in this function the StatusCode is also set
func (srw *statusResponseWriter) WriteHeader(code int) {
	srw.ResponseWriter.WriteHeader(code)
	srw.StatusCode = code
}

// updateMetric evaluates the StatusCode, if there is an error, increase the API failure counter, otherwise save the duration
func updateMetric(route string, srw *statusResponseWriter, timer *prometheus.Timer) {
	// Always measure the duration even if the API call ended in an error
	timer.ObserveDuration()
	// Increase the error counter on 500 and 503 errors
	if srw.StatusCode == http.StatusInternalServerError || srw.StatusCode == http.StatusServiceUnavailable {
		internalmetrics.GetAPIFailureMetric(route).Inc()
	}
}

func metricHandler(next http.Handler, route Route) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// By default, if there is no call to WriteHeader, an 200 will be
		srw := &statusResponseWriter{
			ResponseWriter: w,
			StatusCode:     http.StatusOK,
		}
		promtimer := internalmetrics.GetAPIProcessingTimePrometheusTimer(route.Name)
		defer updateMetric(route.Name, srw, promtimer)
		next.ServeHTTP(srw, r)
	})
}

// serveEnvJsFile generates the env.js file needed by the UI from Kiali configs. The
// generated file is sent to the HTTP response.
func serveEnvJsFile(w http.ResponseWriter) {
	conf := config.Get()
	var body string
	if len(conf.Server.WebHistoryMode) > 0 {
		body += fmt.Sprintf("window.HISTORY_MODE='%s';", conf.Server.WebHistoryMode)
	}

	body += "window.WEB_ROOT = document.getElementsByTagName('base')[0].getAttribute('href').replace(/^https?:\\/\\/[^#?\\/]+/g, '').replace(/\\/+$/g, '')"

	w.Header().Set("content-type", "text/javascript")
	_, err := io.WriteString(w, body)
	if err != nil {
		log.Errorf("HTTP I/O error [%v]", err.Error())
	}
}

// serveIndexFile takes UI's index.html as a template to generate a modified index file that takes
// into account the web_root path configured in the Kiali CR. The result is sent to the HTTP response.
func serveIndexFile(w http.ResponseWriter) {
	webRootPath := config.Get().Server.WebRoot
	webRootPath = strings.TrimSuffix(webRootPath, "/")

	path, _ := filepath.Abs("./console/index.html")
	b, err := os.ReadFile(path)
	if err != nil {
		log.Errorf("File I/O error [%v]", err.Error())
		handlers.RespondWithDetailedError(w, http.StatusInternalServerError, "Unable to read index.html template file", err.Error())
		return
	}

	html := string(b)
	newHTML := html

	if len(webRootPath) != 0 {
		searchStr := `<base href="/"`
		newStr := `<base href="` + webRootPath + `/"`
		newHTML = strings.Replace(html, searchStr, newStr, -1)
	}

	w.Header().Set("content-type", "text/html")
	_, err = io.WriteString(w, newHTML)
	if err != nil {
		log.Errorf("HTTP I/O error [%v]", err.Error())
	}
}
