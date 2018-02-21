package handlers

import (
	"net/http"

	"github.com/swift-sunshine/swscore/log"
	"github.com/swift-sunshine/swscore/models"
)

func NamespaceList(w http.ResponseWriter, r *http.Request) {
	namespaces, err := models.GetNamespaces()
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, namespaces)
}
