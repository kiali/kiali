package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
)

func LoggingUpdate(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	// Get business layer
	businessLayer, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	namespace := params["namespace"]
	pod := params["pod"]
	level := r.URL.Query().Get("level")
	switch {
	case level == "":
		RespondWithError(w, 400, "level query param is not set")
		return
	case !business.IsValidProxyLogLevel(level):
		msg := fmt.Sprintf("%s is an invalid log level. Valid log levels are: %s", level, strings.Join(business.ValidProxyLogLevels, ", "))
		RespondWithError(w, 400, msg)
		return
	}

	if err := businessLayer.ProxyLogging.SetLogLevel(namespace, pod, level); err != nil {
		handleErrorResponse(w, err)
		return
	}

	RespondWithCode(w, 200)
}
