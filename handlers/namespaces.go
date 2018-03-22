package handlers

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/kiali/swscore/log"
	"github.com/kiali/swscore/models"
	"github.com/kiali/swscore/prometheus"
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

// NamespaceMetrics is the API handler to fetch metrics to be displayed, related to all
// services in the namespace
func NamespaceMetrics(w http.ResponseWriter, r *http.Request) {
	getNamespaceMetrics(w, r, prometheus.NewClient)
}

// getServiceMetrics (mock-friendly version)
func getNamespaceMetrics(w http.ResponseWriter, r *http.Request, promClientSupplier func() (*prometheus.Client, error)) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	getMetrics(w, r, prometheus.NewClient, namespace, "")
}
