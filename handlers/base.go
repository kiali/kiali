package handlers

import (
	"encoding/json"
	"net/http"
)

type responseError struct {
	Error  string `json:"error,omitempty"`
	Detail string `json:"detail,omitempty"`
}

func RespondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	response, err := json.Marshal(payload)
	if err != nil {
		response, _ = json.Marshal(responseError{Error: err.Error()})
		code = http.StatusInternalServerError
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, _ = w.Write(response)
}

func RespondWithJSONIndent(w http.ResponseWriter, code int, payload interface{}) {
	response, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		response, _ = json.Marshal(responseError{Error: err.Error()})
		code = http.StatusInternalServerError
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, _ = w.Write(response)
}

func RespondWithError(w http.ResponseWriter, code int, message string) {
	RespondWithJSON(w, code, responseError{Error: message})
}

func RespondWithDetailedError(w http.ResponseWriter, code int, message, detail string) {
	RespondWithJSON(w, code, responseError{Error: message, Detail: detail})
}

func RespondWithCode(w http.ResponseWriter, code int) {
	w.WriteHeader(code)
}
