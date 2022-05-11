package server

import (
	"fmt"
	"net/http"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

var openshiftPluginServer *http.Server

func StartPluginsServer() {
	conf := config.Get()
	if conf.KialiPlugins.OpenShift.Enabled {
		log.Infof("Starting OpenShift Plugin Server on [%v:%v]", conf.KialiPlugins.OpenShift.Address, conf.KialiPlugins.OpenShift.Port)
		log.Infof("OpenShift Plugin Server will serve static content from [%v]", conf.KialiPlugins.OpenShift.StaticContentRootDirectory)
		fs := http.FileServer(http.Dir(conf.KialiPlugins.OpenShift.StaticContentRootDirectory))
		openshiftPluginServer = &http.Server{
			Addr:         fmt.Sprintf("%s:%d", conf.KialiPlugins.OpenShift.Address, conf.KialiPlugins.OpenShift.Port),
			Handler:      fs,
			ReadTimeout:  30 * time.Second,
			WriteTimeout: 30 * time.Second,
		}
		go func() {
			log.Warning(openshiftPluginServer.ListenAndServe())
		}()
	}
}

func StopPluginsServer() {
	if openshiftPluginServer != nil {
		log.Info("Stopping OpenShift Plugin Server")
		openshiftPluginServer.Close()
		openshiftPluginServer = nil
	}
}
