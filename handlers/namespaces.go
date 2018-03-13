package handlers

import (
	"net/http"

	"github.com/kiali/swscore/log"
	"github.com/kiali/swscore/models"
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
