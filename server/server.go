package server

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"time"

	"github.com/NYTimes/gziphandler"
	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/routing"
)

type Server struct {
	httpServer *http.Server
	router     *mux.Router
}

// NewServer creates a new server configured with the given settings.
// Start and Stop it with the corresponding functions.
func NewServer() *Server {
	conf := config.Get()
	// create a router that will route all incoming API server requests to different handlers

	router := routing.NewRouter()

	if conf.Server.CORSAllowAll {
		router.Use(corsAllowed)
	}

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
	}

	// create the server definition that will handle both console and api server traffic
	httpServer := &http.Server{
		Addr:         fmt.Sprintf("%v:%v", conf.Server.Address, conf.Server.Port),
		TLSConfig:    tlsConfig,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	// return our new Server
	return &Server{
		httpServer: httpServer,
		router:     router,
	}
}

// Start HTTP server asynchronously. TLS may be active depending on the global configuration.
func (s *Server) Start() {
	conf := config.Get()
	log.Infof("Server endpoint will start at [%v%v]", s.httpServer.Addr, conf.Server.WebRoot)
	log.Infof("Server endpoint will serve static content from [%v]", conf.Server.StaticContentRootDirectory)
	secure := conf.Identity.CertFile != "" && conf.Identity.PrivateKeyFile != ""
	go func() {
		var err error
		if secure {
			log.Infof("Server endpoint will require https")
			s.router.Use(secureHttpsMiddleware)
			err = s.httpServer.ListenAndServeTLS(conf.Identity.CertFile, conf.Identity.PrivateKeyFile)
		} else {
			s.router.Use(plainHttpMiddleware)
			err = s.httpServer.ListenAndServe()
		}
		log.Warning(err)
	}()

	// Start the Metrics Server
	if conf.Server.MetricsEnabled {
		StartMetricsServer()
	}
}

// Stop the HTTP server
func (s *Server) Stop() {
	StopMetricsServer()
	business.Stop()
	log.Infof("Server endpoint will stop at [%v]", s.httpServer.Addr)
	s.httpServer.Close()
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
