package server

import (
	"fmt"
	"net/http"

	"github.com/swift-sunshine/swscore/config"
	"github.com/swift-sunshine/swscore/config/security"
	"github.com/swift-sunshine/swscore/log"
	"github.com/swift-sunshine/swscore/routing"
)

func StartServer(conf *config.Config) {
	// create a router that will route all incoming API server requests to different handlers
	router := routing.NewRouter(conf)

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
	server := &http.Server{
		Addr: fmt.Sprintf("%v:%v", conf.Server.Address, conf.Server.Port),
	}

	log.Infof("Server endpoint will start at [%v]", server.Addr)
	log.Infof("Server endpoint will serve static content from [%v]", conf.Server.Static_Content_Root_Directory)
	go func() {
		var err error
		secure := conf.Identity.Cert_File != "" && conf.Identity.Private_Key_File != ""
		if secure {
			log.Infof("Server endpoint will require https")
			err = server.ListenAndServeTLS(conf.Identity.Cert_File, conf.Identity.Private_Key_File)
		} else {
			err = server.ListenAndServe()
		}
		log.Warning(err)
	}()
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
		if !ok {
			statusCode = http.StatusUnauthorized
		} else if h.credentials.Username != u || h.credentials.Password != p {
			statusCode = http.StatusForbidden
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
