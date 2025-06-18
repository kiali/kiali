package routing

import (
	"context"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	hpprof "net/http/pprof"
	rpprof "runtime/pprof"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/rs/zerolog/hlog"
	zerolog "github.com/rs/zerolog/log"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/handlers"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
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
	staticAssetFS fs.FS,
) (*mux.Router, error) {
	webRoot := conf.Server.WebRoot
	webRootWithSlash := webRoot + "/"

	rootRouter := mux.NewRouter().StrictSlash(false)
	appRouter := rootRouter
	log.Info("Serving from embedded assets content root dir")
	staticFileServer := http.FileServerFS(staticAssetFS)
	log.Infof("Webroot: %s", webRootWithSlash)

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
			serveIndexFile(conf, w, staticAssetFS)
		} else if urlPath == webRootWithSlash+"env.js" {
			serveEnvJsFile(conf, w)
		} else {
			staticFileServer.ServeHTTP(w, r)
		}
	}

	appRouter = appRouter.StrictSlash(true)

	strategy := conf.Auth.Strategy

	zl := log.WithGroup("router")

	// Routes that are specific to different auth stragies like auth callbacks.
	var authRoutes []Route
	var authController authentication.AuthController
	var authRedirectHandler http.Handler
	if strategy == config.AuthStrategyToken {
		tokenAuth, err := authentication.NewTokenAuthController(clientFactory, kialiCache, conf, discovery)
		if err != nil {
			zl.Error().Msgf("Error creating TokenAuthController: %v", err)
			return nil, err
		}
		authController = tokenAuth
	} else if strategy == config.AuthStrategyOpenId {
		openIDAuth, err := authentication.NewOpenIdAuthController(kialiCache, clientFactory, conf, discovery)
		if err != nil {
			zl.Error().Msgf("Error creating OpenIdAuthController: %v", err)
			return nil, err
		}
		authController = openIDAuth
	} else if strategy == config.AuthStrategyOpenshift {
		openshiftAuth, err := authentication.NewOpenshiftAuthController(conf, clientFactory)
		if err != nil {
			zl.Error().Msgf("Error creating OpenshiftAuthController: %v", err)
			return nil, err
		}

		authController = openshiftAuth

		authCallbacks := []Route{
			{
				Name:          "BaseAuthRedirect",
				Method:        "GET",
				Pattern:       "/api/auth/redirect",
				HandlerFunc:   openshiftAuth.OpenshiftAuthRedirect,
				Authenticated: false,
			},
			{
				Name:          "ClusterAuthRedirect",
				Method:        "GET",
				Pattern:       "/api/auth/redirect/{cluster}",
				HandlerFunc:   openshiftAuth.OpenshiftAuthRedirect,
				Authenticated: false,
			},
			{
				Name:          "BaseAuthCallback",
				Method:        "GET",
				Pattern:       "/api/auth/callback",
				HandlerFunc:   openshiftAuth.OpenshiftAuthCallback,
				Authenticated: false,
			},
			{
				Name:          "ClusterAuthCallback",
				Method:        "GET",
				Pattern:       "/api/auth/callback/{cluster}",
				HandlerFunc:   openshiftAuth.OpenshiftAuthCallback,
				Authenticated: false,
			},
		}
		authRoutes = append(authRoutes, authCallbacks...)
		authRedirectHandler = http.HandlerFunc(openshiftAuth.OpenshiftAuthRedirect)
	} else if strategy == config.AuthStrategyHeader {
		// Get local cluster client for authentication
		localClusterClient := clientFactory.GetSAClient(conf.KubernetesConfig.ClusterName)
		headerAuth, err := authentication.NewHeaderAuthController(conf, localClusterClient)
		if err != nil {
			zl.Error().Msgf("Error creating HeaderAuthController: %v", err)
			return nil, err
		}
		authController = headerAuth
	}

	// Build our API server routes and install them.
	apiRoutes := NewRoutes(conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, authController, grafana, discovery)
	// Add any auth routes to the app router.
	apiRoutes.Routes = append(apiRoutes.Routes, authRoutes...)

	// Get local cluster client for authentication handler
	localClusterClient := clientFactory.GetSAClient(conf.KubernetesConfig.ClusterName)
	authenticationHandler := handlers.NewAuthenticationHandler(conf, authController, localClusterClient, authRedirectHandler, clientFactory.GetSAClients())

	allRoutes := apiRoutes.Routes

	// Add the Profiler handlers if enabled
	if conf.Server.Profiler.Enabled {
		zl.Info().Msgf("Profiler is enabled")
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

		// wrap the whole thing in our logger handler so we can get a logger in our http handling chain
		finalHandler := buildHttpHandlerLogger(route, handlerFunction)

		appRouter.
			Methods(route.Method).
			Path(route.Pattern).
			Name(route.Name).
			Handler(finalHandler)
	}

	if authController != nil {
		if ac, ok := authController.(*authentication.OpenIdAuthController); ok {
			ac.PostRoutes(appRouter)
		}
	}

	// All client-side routes are prefixed with /console.
	// They are forwarded to index.html and will be handled by react-router.
	appRouter.PathPrefix("/console").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		serveIndexFile(conf, w, staticAssetFS)
	})

	if authController != nil {
		if ac, ok := authController.(*authentication.OpenIdAuthController); ok {
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
func updateMetric(ctx context.Context, route string, srw *statusResponseWriter, timer *prometheus.Timer) {
	// Always measure the duration even if the API call ended in an error
	internalmetrics.ObserveDurationAndLogResults(
		ctx,
		config.Get(),
		timer,
		"APIProcessingTime",
		map[string]string{
			"status-code": strconv.Itoa(srw.StatusCode),
		},
		"API processing time")

	// Increase the error counter on 500 and 503 errors
	if srw.StatusCode == http.StatusInternalServerError || srw.StatusCode == http.StatusServiceUnavailable {
		internalmetrics.GetAPIFailureMetric(route).Inc()
	}
}

func metricHandler(next http.Handler, route Route) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// By default, if there is no call to WriteHeader, a 200 will be returned
		srw := &statusResponseWriter{
			ResponseWriter: w,
			StatusCode:     http.StatusOK,
		}
		promtimer := internalmetrics.GetAPIProcessingTimePrometheusTimer(route.Name)
		defer updateMetric(r.Context(), route.Name, srw, promtimer)
		next.ServeHTTP(srw, r)
	})
}

// serveEnvJsFile generates the env.js file needed by the UI from Kiali configs. The
// generated file is sent to the HTTP response.
func serveEnvJsFile(conf *config.Config, w http.ResponseWriter) {
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
func serveIndexFile(conf *config.Config, w http.ResponseWriter, staticAssetFS fs.FS) {
	webRootPath := config.Get().Server.WebRoot
	webRootPath = strings.TrimSuffix(webRootPath, "/")

	contents, err := fs.ReadFile(staticAssetFS, "index.html")
	if err != nil {
		log.Errorf("File I/O error: %s", err)
		handlers.RespondWithDetailedError(w, http.StatusInternalServerError, "Unable to read index.html template file", err.Error())
		return
	}

	html := string(contents)
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

// Things to help build the logger handler chain (see https://pkg.go.dev/github.com/rs/zerolog/hlog#example-package-Handler)
// fake alice to avoid dep
type alice struct {
	m []func(http.Handler) http.Handler
}

func (a alice) append(m func(http.Handler) http.Handler) alice {
	a.m = append(a.m, m)
	return a
}

func (a alice) then(h http.Handler) http.Handler {
	for i := range a.m {
		h = a.m[len(a.m)-1-i](h)
	}
	return h
}

func buildHttpHandlerLogger(route Route, handlerFunction http.Handler) http.Handler {

	// prepare the request's logger
	zlc := zerolog.With().Str(log.RouteLogName, route.Name)
	if log.IsTrace() {
		zlc = zlc.Str(log.RoutePatternLogName, route.Pattern)
	}
	if route.LogGroupName != "" {
		zlc = zlc.Str(log.GroupLogName, route.LogGroupName)
	}
	zl := zlc.Logger()

	c := alice{}
	c = c.append(hlog.NewHandler(zl))

	// TODO: commenting out but leaving these here in case we want to look into including them at a future date
	// c = c.append(hlog.HostHandler("host", true))
	// if log.IsTrace() {
	// 	c = c.append(hlog.RemoteAddrHandler("remote-addr"))
	// }

	// extract and log the request ID - if we have a X-Request-Id header we use it; otherwise, we generate our own
	xRequestIdHeader := "X-Request-Id"
	xRequestFieldKey := "request-id"
	c = c.append(func(next http.Handler) http.Handler {
		requestIDGeneratorHandler := hlog.RequestIDHandler(xRequestFieldKey, "")
		customHeaderHandler := hlog.CustomHeaderHandler(xRequestFieldKey, xRequestIdHeader)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get(xRequestIdHeader) == "" {
				requestIDGeneratorHandler(next).ServeHTTP(w, r)
			} else {
				customHeaderHandler(next).ServeHTTP(w, r)
			}
		})
	})

	return c.then(handlerFunction)
}
