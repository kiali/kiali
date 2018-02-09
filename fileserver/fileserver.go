package fileserver

import (
	"fmt"
	"net/http"

	"github.com/swift-sunshine/swscore/config"
	"github.com/swift-sunshine/swscore/config/security"
	"github.com/swift-sunshine/swscore/log"
	"github.com/swift-sunshine/swscore/routing"
)

func StartFileServer(conf *config.Config) {
	consolePrefix := "/console/"

	router := routing.NewRouter()
	router.PathPrefix(consolePrefix).
		Handler(http.StripPrefix(consolePrefix, http.FileServer(http.Dir(conf.FileServer.Root_Directory))))

	server := &http.Server{
		Handler: router,
		Addr:    fmt.Sprintf("%v:%v", conf.FileServer.Address, conf.FileServer.Port),
	}

	log.Infof("File Server endpoint will start at [%v]", server.Addr)
	log.Infof("File Server endpoint will serve static content from [%v]", conf.FileServer.Root_Directory)
	go func() {
		var err error
		secure := conf.Identity.Cert_File != "" && conf.Identity.Private_Key_File != ""
		if secure {
			log.Infof("File Server endpoint will require https")
			err = server.ListenAndServeTLS(conf.Identity.Cert_File, conf.Identity.Private_Key_File)
		} else {
			err = server.ListenAndServe()
		}
		log.Warning(err)
	}()
}

type fileServerAuthProxyHandler struct {
	credentials security.Credentials
	trueHandler http.Handler
}

func (h *fileServerAuthProxyHandler) handler(w http.ResponseWriter, r *http.Request) {
	statusCode := http.StatusOK

	if h.credentials.Username != "" || h.credentials.Password != "" {
		u, p, ok := r.BasicAuth()
		if !ok {
			statusCode = http.StatusUnauthorized
		} else if h.credentials.Username != u || h.credentials.Password != p {
			statusCode = http.StatusForbidden
		}
	} else {
		log.Trace("Access to the file server endpoint is not secured with credentials")
	}

	switch statusCode {
	case http.StatusOK:
		{
			h.trueHandler.ServeHTTP(w, r)
		}
	case http.StatusUnauthorized:
		{
			w.Header().Set("WWW-Authenticate", "Basic realm=\"Swift-Sunshine\"")
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
		}
	default:
		{
			http.Error(w, http.StatusText(statusCode), statusCode)
			log.Errorf("Cannot send response to unauthorized user: %v", statusCode)
		}
	}
}
