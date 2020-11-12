package handlers

import (
	"net/http"

	"github.com/gorilla/mux"
)

// AppList is the API handler to fetch all the apps to be displayed, related to a single namespace
func AppList(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Apps initialization error: "+err.Error())
		return
	}
	namespace := params["namespace"]

	// Fetch and build apps
	appList, err := business.App.GetAppList(namespace)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	RespondWithJSON(w, http.StatusOK, appList)
}

// AppDetails is the API handler to fetch all details to be displayed, related to a single app
func AppDetails(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}
	namespace := params["namespace"]
	app := params["app"]

	// Fetch and build app
	appDetails, err := business.App.GetApp(namespace, app)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	RespondWithJSON(w, http.StatusOK, appDetails)
}
