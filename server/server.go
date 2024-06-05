package server

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"time"

	"github.com/NYTimes/gziphandler"
	"github.com/gorilla/mux"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gorilla/mux/otelmux"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/routing"
	"github.com/kiali/kiali/tracing"
)

type Server struct {
	conf                *config.Config
	controlPlaneMonitor business.ControlPlaneMonitor
	clientFactory       kubernetes.ClientFactory
	httpServer          *http.Server
	kialiCache          cache.KialiCache
	prom                prometheus.ClientInterface
	router              *mux.Router
	tracer              *sdktrace.TracerProvider
	traceClientLoader   func() tracing.ClientInterface
}

// NewServer creates a new server configured with the given settings.
// Start and Stop it with the corresponding functions.
func NewServer(controlPlaneMonitor business.ControlPlaneMonitor,
	clientFactory kubernetes.ClientFactory,
	cache cache.KialiCache,
	conf *config.Config,
	prom prometheus.ClientInterface,
	traceClientLoader func() tracing.ClientInterface,
) (*Server, error) {
	// create a router that will route all incoming API server requests to different handlers
	router, err := routing.NewRouter(conf, cache, clientFactory, prom, traceClientLoader, controlPlaneMonitor)
	if err != nil {
		return nil, err
	}

	var tracingProvider *sdktrace.TracerProvider
	if conf.Server.Observability.Tracing.Enabled {
		log.Infof("Tracing Enabled. Initializing tracer with collector url: %s", conf.Server.Observability.Tracing.CollectorURL)
		tracingProvider = observability.InitTracer(conf.Server.Observability.Tracing.CollectorURL)
	}

	middlewares := []mux.MiddlewareFunc{}
	if conf.Server.CORSAllowAll {
		middlewares = append(middlewares, corsAllowed)
	}
	if conf.Server.Observability.Tracing.Enabled {
		middlewares = append(middlewares, otelmux.Middleware(observability.TracingService))
	}

	router.Use(middlewares...)

	handler := http.Handler(router)
	if conf.Server.GzipEnabled {
		handler = configureGzipHandler(router)
	}

	// The Kiali server has only a single http server ever during its lifetime. But to support
	// testing that wants to start multiple servers over the lifetime of the process,
	// we need to override the default server mux with a new one everytime.
	mux := http.NewServeMux()
	http.DefaultServeMux = mux
	http.Handle("/", handler)

	// Clients must use TLS 1.2 or higher
	tlsConfig := &tls.Config{
		MinVersion: tls.VersionTLS12,
		NextProtos: []string{"h2", "http/1.1"},
	}

	// The /debug/pprof/profiler by default needs a write timeout larger than 30s. But also, you can pass in &seconds=XY on the pprof URL
	// and ask for any profile to extend to those number of seconds you specify, which could be larger than 30s.
	// To limit the damage this may cause with large write timeouts, we only increase the timeout to 1 minute.
	// TODO: We could make this configurable in the future. See: https://github.com/kiali/kiali/pull/7108#issuecomment-1932982697
	writeTimeout := conf.Server.Timeout * time.Second
	if conf.Server.Profiler.Enabled && writeTimeout < 60 {
		writeTimeout = 1 * time.Minute
	}

	// create the server definition that will handle both console and api server traffic
	httpServer := &http.Server{
		Addr:         fmt.Sprintf("%v:%v", conf.Server.Address, conf.Server.Port),
		TLSConfig:    tlsConfig,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: writeTimeout,
	}

	// return our new Server
	s := &Server{
		conf:                conf,
		clientFactory:       clientFactory,
		controlPlaneMonitor: controlPlaneMonitor,
		httpServer:          httpServer,
		kialiCache:          cache,
		prom:                prom,
		router:              router,
		traceClientLoader:   traceClientLoader,
	}
	if conf.Server.Observability.Tracing.Enabled && tracingProvider != nil {
		s.tracer = tracingProvider
	}
	return s, nil
}

// Start HTTP server asynchronously. TLS may be active depending on the global configuration.
func (s *Server) Start() {
	business.Start(s.clientFactory, s.controlPlaneMonitor, s.kialiCache, s.prom, s.traceClientLoader)

	log.Infof("Server endpoint will start at [%v%v]", s.httpServer.Addr, s.conf.Server.WebRoot)
	log.Infof("Server endpoint will serve static content from [%v]", s.conf.Server.StaticContentRootDirectory)

	go func() {
		var err error
		if s.conf.IsServerHTTPS() {
			log.Infof("Server endpoint will require https")
			log.Infof("Server will support protocols: %v", s.httpServer.TLSConfig.NextProtos)
			s.router.Use(secureHttpsMiddleware)
			err = s.httpServer.ListenAndServeTLS(s.conf.Identity.CertFile, s.conf.Identity.PrivateKeyFile)
		} else {
			s.router.Use(plainHttpMiddleware)
			err = s.httpServer.ListenAndServe()
		}
		log.Warning(err)
	}()

	// Start the Metrics Server
	if s.conf.Server.Observability.Metrics.Enabled {
		StartMetricsServer()
	}
}

// Stop the HTTP server
func (s *Server) Stop() {
	StopMetricsServer()
	log.Infof("Server endpoint will stop at [%v]", s.httpServer.Addr)
	s.httpServer.Close()
	observability.StopTracer(s.tracer)
}

func corsAllowed(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
		next.ServeHTTP(w, r)
	})
}

func configureGzipHandler(handler http.Handler) http.Handler {
	contentTypeOption := gziphandler.ContentTypes([]string{
		"application/javascript",
		"application/json",
		"image/svg+xml",
		"text/css",
		"text/html",
	})
	if handlerFunc, err := gziphandler.GzipHandlerWithOpts(contentTypeOption); err == nil {
		return handlerFunc(handler)
	} else {
		// This could happen by a wrong configuration being sent to GzipHandlerWithOpts
		panic(err)
	}
}

func plainHttpMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.URL.Scheme = "http"
		next.ServeHTTP(w, r)
	})
}

func secureHttpsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.URL.Scheme = "https"
		next.ServeHTTP(w, r)
	})
}
