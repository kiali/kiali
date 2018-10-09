package handlers

import (
	"net/http"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

// CheckAuthorization checks Kiali authorization against the Kubernetes API (SelfSubjectAccessReview) for a given resource
func CheckAuthorization(w http.ResponseWriter, r *http.Request) {
	params := r.URL.Query()
	namespace := params.Get("namespace")
	verb := params.Get("verb")
	group := params.Get("group")
	resource := params.Get("resource")

	if config.Get().ReadOnly && verb != "get" && verb != "list" {
		RespondWithError(w, http.StatusUnauthorized, "Kiali configured in read-only mode")
		return
	}

	client, err := kubernetes.NewClient()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Kubernetes client initialization error: "+err.Error())
		return
	}
	res, err := client.GetSelfSubjectAccessReview(namespace, verb, group, resource)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if !res.Status.Allowed {
		RespondWithError(w, http.StatusUnauthorized, res.Status.Reason)
		return
	}
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}
