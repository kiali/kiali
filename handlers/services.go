package handlers

import (
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/swift-sunshine/swscore/log"
	"github.com/swift-sunshine/swscore/models"
)

func ServiceList(w http.ResponseWriter, r *http.Request) {
	var services [5]models.Service

	for i := 0; i < len(services); i++ {
		services[i] = models.Service{i, fmt.Sprintf("Name #%d", i), fmt.Sprintf("Namespace #'%d'", i)}
	}

	RespondWithJSON(w, 200, services)
	log.Info("ROOT HANDLER CALLED!")
}

func ServiceShow(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	var service = models.ServiceNew(params["id"], params["namespace_id"])

	RespondWithJSON(w, 200, service)
	log.Info("ROOT HANDLER CALLED!")
}
