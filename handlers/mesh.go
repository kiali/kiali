package handlers

import (
	"net/http"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/mesh"
	"github.com/kiali/kiali/mesh/api"
)

func IstiodCanariesStatus(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	irt, _ := business.Mesh.CanaryUpgradeStatus()
	RespondWithJSON(w, http.StatusOK, irt)
}

// MeshGraph is a REST http.HandlerFunc handling graph generation for the mesh
func MeshGraph(conf *config.Config, clientFactory kubernetes.ClientFactory, cache cache.KialiCache, grafana *grafana.Service, discovery *istio.Discovery) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		defer handlePanic(w)

		o := mesh.NewOptions(r)

		business, err := getBusiness(r)
		mesh.CheckError(err)

		meshInfo, err := discovery.Mesh(r.Context())
		mesh.CheckError(err)

		// Assuming that all controlplanes are part of the same mesh,
		// just use the first one.
		if len(meshInfo.ControlPlanes) > 0 {
			meshId := meshInfo.ControlPlanes[0].Config.DefaultConfig.MeshId
			if meshId == "" {
				// MeshId defaults to trust domain in istio if not set.
				meshId = meshInfo.ControlPlanes[0].Config.TrustDomain
			}
			o.MeshName = meshId
		}

		code, payload := api.GraphMesh(r.Context(), business, o, clientFactory, cache, conf, grafana, discovery)
		respond(w, code, payload)
	}
}
