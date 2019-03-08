package server

import (
	"fmt"
	"net/http"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/routing"
)

type Server struct {
	httpServer *http.Server
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

	// The Kiali server has only a single http server ever during its lifetime. But to support
	// testing that wants to start multiple servers over the lifetime of the process,
	// we need to override the default server mux with a new one everytime.
	mux := http.NewServeMux()
	http.DefaultServeMux = mux
	http.Handle("/", router)

	// create the server definition that will handle both console and api server traffic
	httpServer := &http.Server{
		Addr: fmt.Sprintf("%v:%v", conf.Server.Address, conf.Server.Port),
	}

	// return our new Server
	return &Server{
		httpServer: httpServer,
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
			err = s.httpServer.ListenAndServeTLS(conf.Identity.CertFile, conf.Identity.PrivateKeyFile)
		} else {
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
