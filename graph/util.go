package graph

import "net/http"

type Response struct {
	Message string
	Code    int
}

// Error panics with InternalServerError and the provided message
func Error(message string) {
	Panic(message, http.StatusInternalServerError)
}

// Forbidden panics with Forbidden and the provided message
func Forbidden(message string) {
	Panic(message, http.StatusForbidden)
}

// Panic panics with the provided HTTP response code and message
func Panic(message string, code int) Response {
	panic(Response{
		Message: message,
		Code:    code,
	})
}

func CheckError(err error) {
	if err != nil {
		panic(err.Error)
	}
}
