package handlers

import (
	"encoding/json"
	"io"
	"net/http"
)

const maxRequestBodyBytes int64 = 10 * 1024 * 1024 // 10 MB

// boundedReadAll reads the full request body up to maxRequestBodyBytes.
// Returns an error if the body exceeds the limit.
func boundedReadAll(r *http.Request) ([]byte, error) {
	r.Body = http.MaxBytesReader(nil, r.Body, maxRequestBodyBytes)
	return io.ReadAll(r.Body)
}

type responseError struct {
	Error  string `json:"error,omitempty"`
	Detail string `json:"detail,omitempty"`
}

// ResponseConverter can do some last minute changes to itself before being marshaled to JSON.
// This is useful for things like converting nil slices to empty slices because the frontend
// expects an empty array instead of null in the response.
type ResponseConverter interface {
	ConvertToResponse()
}

func RespondWithAPIResponse(w http.ResponseWriter, code int, payload ResponseConverter) {
	payload.ConvertToResponse()
	RespondWithJSON(w, code, payload)
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
