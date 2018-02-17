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
	response, err := models.ServiceDetailsGet(params["namespace_id"], params["id"])
	if err != nil {
		RespondWithJSON(w, 500, nil)
	}

	RespondWithJSON(w, 200, response)
}
