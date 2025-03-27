package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
)

func LoggingUpdate(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	if config.Get().Deployment.ViewOnlyMode {
		RespondWithError(w, http.StatusForbidden, "Log level cannot be changed in view-only mode")
		return
	}

	// Get business layer
	businessLayer, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	namespace := params["namespace"]
	pod := params["pod"]
	query := r.URL.Query()
	level := query.Get("level")
	switch {
	case level == "":
		RespondWithError(w, 400, "level query param is not set")
		return
	case !business.IsValidProxyLogLevel(level):
		msg := fmt.Sprintf("%s is an invalid log level. Valid log levels are: %s", level, strings.Join(business.ValidProxyLogLevels, ", "))
		RespondWithError(w, 400, msg)
		return
	}

	cluster := clusterNameFromQuery(config.Get(), query)

	if err := businessLayer.ProxyLogging.SetLogLevel(cluster, namespace, pod, level); err != nil {
		handleErrorResponse(w, err)
		return
	}
	audit(r, "UPDATE Envoy log. Cluster: "+cluster+" Namespace: "+namespace+" Pod: "+pod+" Log level:"+level)
	RespondWithCode(w, 200)
}
