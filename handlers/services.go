package handlers

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/swift-sunshine/swscore/log"
	"github.com/swift-sunshine/swscore/models"
)

func ServiceList(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := models.Namespace{params["namespace"]}

	services, err := models.GetServicesByNamespace(namespace.Name)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, models.ServiceList{namespace, services})
}
