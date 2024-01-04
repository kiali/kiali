package handlers

import (
	"fmt"
	"net/http"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/tracing"
)

// GetClusters writes to the HTTP response a JSON document with the
// list of clusters that are part of the mesh when multi-cluster is enabled. If
// multi-cluster is not enabled in the control plane, this handler may provide
// erroneous data.
func GetClusters(conf *config.Config, kialiCache cache.KialiCache, clientFactory kubernetes.ClientFactory, prom prometheus.ClientInterface, traceClientLoader func() tracing.ClientInterface, cpm business.ControlPlaneMonitor) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authInfo, err := getAuthInfo(r)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}

		layer, err := business.NewLayer(conf, kialiCache, clientFactory, prom, traceClientLoader(), cpm, authInfo)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}

		meshClusters, err := layer.Mesh.GetClusters()
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, "Cannot fetch mesh clusters: "+err.Error())
			return
		}

		RespondWithJSON(w, http.StatusOK, meshClusters)
	}
}

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
