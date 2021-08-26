package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
)

var (
	validLogLevels = []string{"off", "trace", "debug", "info", "warning", "error", "critical"}
)

func isValidLogLevel(level string) bool {
	for _, l := range validLogLevels {
		if level == l {
			return true
		}
	}
	return false
}

func LoggingUpdate(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	// Get business layer
	business, err := getBusiness(r)
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
	case !isValidLogLevel(level):
		msg := fmt.Sprintf("%s is an invalid log level. Valid log levels are: %s", level, strings.Join(validLogLevels, ", "))
		RespondWithError(w, 400, msg)
		return
	}

	if err := business.ProxyLogging.SetLogLevel(r.Context(), namespace, pod, level); err != nil {
		handleErrorResponse(w, err)
		return
	}

	RespondWithCode(w, 200)
}
