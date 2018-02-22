package server

import (
	"fmt"
	"net/http"

	"github.com/swift-sunshine/swscore/config"
	"github.com/swift-sunshine/swscore/config/security"
	"github.com/swift-sunshine/swscore/log"
	"github.com/swift-sunshine/swscore/routing"
)

type Server struct {
	httpServer *http.Server
}

// NewServer creates a new server configured with the given settings.
// Start and Stop it with the corresponding functions.
func NewServer() *Server {
	conf := config.Get()
	// create a router that will route all incoming API server requests to different handlers
	router := routing.NewRouter(conf)

	if conf.Server.CORSAllowAll {
		router.Use(corsAllowed)
	}

	// put our proxy handler in front to handle auth
	proxyHandler := serverAuthProxyHandler{
		credentials: security.Credentials{
			Username: conf.Server.Credentials.Username,
			Password: conf.Server.Credentials.Password,
		},
		trueHandler: router,
	}
	http.HandleFunc("/", proxyHandler.handler)

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
	log.Infof("Server endpoint will start at [%v]", s.httpServer.Addr)
	log.Infof("Server endpoint will serve static content from [%v]", config.Get().Server.StaticContentRootDirectory)
	go func() {
		var err error
		secure := config.Get().Identity.CertFile != "" && config.Get().Identity.PrivateKeyFile != ""
		if secure {
			log.Infof("Server endpoint will require https")
			err = s.httpServer.ListenAndServeTLS(config.Get().Identity.CertFile, config.Get().Identity.PrivateKeyFile)
		} else {
			err = s.httpServer.ListenAndServe()
		}
		log.Warning(err)
	}()
}

// Stop the HTTP server
func (s *Server) Stop() {
	log.Infof("Server endpoint will stop at [%v]", s.httpServer.Addr)
	s.httpServer.Close()
}

type serverAuthProxyHandler struct {
	credentials security.Credentials
	trueHandler http.Handler
}

func (h *serverAuthProxyHandler) handler(w http.ResponseWriter, r *http.Request) {
	statusCode := http.StatusOK

	// before we handle any requests, make sure the user is authenticated
	if h.credentials.Username != "" || h.credentials.Password != "" {
		u, p, ok := r.BasicAuth()
		if !ok || h.credentials.Username != u || h.credentials.Password != p {
			statusCode = http.StatusUnauthorized
		}
	} else {
		log.Trace("Access to the server endpoint is not secured with credentials - letting request come in")
	}

	switch statusCode {
	case http.StatusOK:
		h.trueHandler.ServeHTTP(w, r)
	case http.StatusUnauthorized:
		w.Header().Set("WWW-Authenticate", "Basic realm=\"Swift-Sunshine\"")
		http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
	default:
		http.Error(w, http.StatusText(statusCode), statusCode)
		log.Errorf("Cannot send response to unauthorized user: %v", statusCode)
	}
}

func corsAllowed(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
		next.ServeHTTP(w, r)
	})
}
