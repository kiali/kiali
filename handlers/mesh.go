package handlers

import (
	"fmt"
	"net/http"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/mesh"
	"github.com/kiali/kiali/mesh/api"
)

func OutboundTrafficPolicyMode(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	otp, _ := business.Mesh.OutboundTrafficPolicy()
	RespondWithJSON(w, http.StatusOK, otp)
}

func IstiodResourceThresholds(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	irt, _ := business.Mesh.IstiodResourceThresholds()
	RespondWithJSON(w, http.StatusOK, irt)
}

func IstiodCanariesStatus(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	irt, _ := business.Mesh.CanaryUpgradeStatus()
	RespondWithJSON(w, http.StatusOK, irt)
}

func GetMesh(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	conf := config.Get()

	// Ensure user has access to the istio system namespace on the home cluster at least.
	// There is no access check in GetMesh.
	if _, err := business.Namespace.GetClusterNamespace(r.Context(), conf.IstioNamespace, conf.KubernetesConfig.ClusterName); err != nil {
		RespondWithError(w, http.StatusForbidden, fmt.Sprintf("Unable to access '%s' namespace. You need access to this to get mesh info. Error: %s ", conf.IstioNamespace, err))
		return
	}

	mesh, err := business.Mesh.GetMesh(r.Context())
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	RespondWithJSON(w, http.StatusOK, mesh)
}

// MeshGraph is a REST http.HandlerFunc handling graph generation for the mesh
func MeshGraph(w http.ResponseWriter, r *http.Request) {
	defer handlePanic(w)

	o := mesh.NewOptions(r)

	business, err := getBusiness(r)
	mesh.CheckError(err)

	code, payload := api.GraphMesh(r.Context(), business, o)
	respond(w, code, payload)
}
