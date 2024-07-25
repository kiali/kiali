package handlers

import (
	"context"
	"net/http"
	"slices"

	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/mesh"
	"github.com/kiali/kiali/mesh/api"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/tracing"
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
func MeshGraph(
	conf *config.Config,
	clientFactory kubernetes.ClientFactory,
	cache cache.KialiCache,
	grafana *grafana.Service,
	prom prometheus.ClientInterface,
	traceClientLoader func() tracing.ClientInterface,
	discovery *istio.Discovery,
	cpm business.ControlPlaneMonitor,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		defer handlePanic(w)

		business, err := getLayer(r, conf, cache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		mesh.CheckError(err)

		o := mesh.NewOptions(r, &business.Namespace)

		meshInfo, err := discovery.Mesh(r.Context())
		filterAccessibleControlPlanes(r.Context(), business.Namespace, meshInfo)
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

func filterAccessibleControlPlanes(ctx context.Context, namespaceService business.NamespaceService, mesh *models.Mesh) {

	for i, cp := range mesh.ControlPlanes {
		// Check if the user is able to access to the control plane
		_, err := namespaceService.GetClusterNamespace(ctx, cp.IstiodNamespace, cp.Cluster.Name)
		if err != nil && errors.IsForbidden(err) {
			mesh.ControlPlanes = slices.Delete(mesh.ControlPlanes, i, i+1)
		}
	}
}
