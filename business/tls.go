package business

import (
	"context"
	"fmt"
	"slices"

	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/util/mtls"
	"github.com/kiali/kiali/util/sliceutil"
)

type TLSService struct {
	businessLayer *Layer
	discovery     meshDiscovery
	userClients   map[string]kubernetes.ClientInterface
	kialiCache    cache.KialiCache
}

const (
	MTLSEnabled          = "MTLS_ENABLED"
	MTLSPartiallyEnabled = "MTLS_PARTIALLY_ENABLED"
	MTLSNotEnabled       = "MTLS_NOT_ENABLED"
	MTLSDisabled         = "MTLS_DISABLED"
)

func (in *TLSService) MeshWidemTLSStatus(ctx context.Context, cluster string, revision string) (models.MTLSStatus, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "MeshWidemTLSStatus",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", cluster),
		observability.Attribute("revision", revision),
	)
	defer end()

	criteria := IstioConfigCriteria{
		IncludeDestinationRules:    true,
		IncludePeerAuthentications: true,
	}

	mesh, err := in.discovery.Mesh(ctx)
	if err != nil {
		return models.MTLSStatus{}, err
	}

	if len(mesh.ControlPlanes) == 0 {
		return models.MTLSStatus{}, fmt.Errorf("no controlplanes found on cluster [%s]", cluster)
	}

	idx := slices.IndexFunc(mesh.ControlPlanes, func(controlPlane models.ControlPlane) bool {
		return controlPlane.Revision == revision && controlPlane.Cluster.Name == cluster
	})
	if idx == -1 {
		return models.MTLSStatus{}, fmt.Errorf("revision [%s] not found on cluster [%s]", revision, cluster)
	}
	controlPlane := mesh.ControlPlanes[idx]

	istioConfigList, err := in.businessLayer.IstioConfig.GetIstioConfigList(ctx, cluster, criteria)
	if err != nil {
		return models.MTLSStatus{}, err
	}

	namespaces, err := in.businessLayer.Namespace.GetClusterNamespaces(ctx, cluster)
	if err != nil {
		return models.MTLSStatus{}, err
	}

	// Look for enabled if rev label isn't set: https://istio.io/latest/docs/setup/additional-setup/sidecar-injection/#controlling-the-injection-policy
	namespacesForRevision := sliceutil.Filter(namespaces, func(ns models.Namespace) bool {
		return ns.Labels[models.IstioRevisionLabel] == revision || ns.Labels[models.IstioInjectionLabel] == "enabled"
	})
	namespaceNames := sliceutil.Map(namespacesForRevision, func(ns models.Namespace) string {
		return ns.Name
	})

	pas := kubernetes.FilterByNamespace(istioConfigList.PeerAuthentications, controlPlane.IstiodNamespace)
	drs := kubernetes.FilterByNamespaceNames(istioConfigList.DestinationRules, namespaceNames)

	mtlsStatus := mtls.MtlsStatus{
		PeerAuthentications: pas,
		DestinationRules:    drs,
		AutoMtlsEnabled:     controlPlane.Config.GetEnableAutoMtls(),
		AllowPermissive:     false,
	}

	minTLS := controlPlane.Config.MeshMTLS.MinProtocolVersion
	if minTLS == "" {
		minTLS = "N/A"
	}

	return models.MTLSStatus{
		Status:          mtlsStatus.MeshMtlsStatus().OverallStatus,
		AutoMTLSEnabled: mtlsStatus.AutoMtlsEnabled,
		MinTLS:          minTLS,
	}, nil
}

func (in *TLSService) NamespaceWidemTLSStatus(ctx context.Context, namespace, cluster string) (models.MTLSStatus, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "NamespaceWidemTLSStatus",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", cluster),
		observability.Attribute("namespace", namespace),
	)
	defer end()

	allNamespaces, err := in.businessLayer.Namespace.GetClusterNamespaces(ctx, cluster)
	if err != nil {
		return models.MTLSStatus{}, err
	}

	criteria := IstioConfigCriteria{
		IncludeDestinationRules:    true,
		IncludePeerAuthentications: true,
	}

	istioConfigList, err := in.businessLayer.IstioConfig.GetIstioConfigList(ctx, cluster, criteria)
	if err != nil {
		return models.MTLSStatus{}, err
	}

	pas := kubernetes.FilterByNamespace(istioConfigList.PeerAuthentications, namespace)
	if config.IsRootNamespace(namespace) {
		pas = []*security_v1.PeerAuthentication{}
	}
	drs := models.FilterByNamespaces(istioConfigList.DestinationRules, allNamespaces)

	ns, err := in.businessLayer.Namespace.GetClusterNamespace(ctx, namespace, cluster)
	if err != nil {
		return models.MTLSStatus{}, err
	}

	mtlsStatus := mtls.MtlsStatus{
		PeerAuthentications: pas,
		DestinationRules:    drs,
		AutoMtlsEnabled:     in.hasAutoMTLSEnabled(cluster, ns),
		AllowPermissive:     false,
	}

	return models.MTLSStatus{
		Status:          mtlsStatus.NamespaceMtlsStatus(namespace).OverallStatus,
		AutoMTLSEnabled: mtlsStatus.AutoMtlsEnabled,
		Cluster:         cluster,
		Namespace:       namespace,
	}, nil
}

func (in *TLSService) ClusterWideNSmTLSStatus(ctx context.Context, namespaces []models.Namespace, cluster string) ([]models.MTLSStatus, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "ClusterWideNSmTLSStatus",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", cluster),
	)
	defer end()

	result := []models.MTLSStatus{}

	criteria := IstioConfigCriteria{
		IncludeDestinationRules:    true,
		IncludePeerAuthentications: true,
	}

	istioConfigList, err := in.businessLayer.IstioConfig.GetIstioConfigList(ctx, cluster, criteria)
	if err != nil {
		return result, err
	}

	for _, namespace := range namespaces {
		pas := kubernetes.FilterByNamespace(istioConfigList.PeerAuthentications, namespace.Name)
		if config.IsRootNamespace(namespace.Name) {
			pas = []*security_v1.PeerAuthentication{}
		}

		mtlsStatus := mtls.MtlsStatus{
			PeerAuthentications: pas,
			DestinationRules:    istioConfigList.DestinationRules,
			AutoMtlsEnabled:     in.hasAutoMTLSEnabled(cluster, &namespace),
			AllowPermissive:     false,
		}

		result = append(result, models.MTLSStatus{
			Status:          mtlsStatus.NamespaceMtlsStatus(namespace.Name).OverallStatus,
			AutoMTLSEnabled: mtlsStatus.AutoMtlsEnabled,
			Cluster:         cluster,
			Namespace:       namespace.Name,
		})
	}

	return result, nil
}

func (in *TLSService) hasAutoMTLSEnabled(cluster string, namespace *models.Namespace) bool {
	mesh, err := in.discovery.Mesh(context.TODO())
	if err != nil {
		return true
	}

	// Find the controlplane that is controlling that namespace.
	rev := namespace.Labels[models.IstioRevisionLabel]
	if rev == "" {
		// Assume that if there is no revision label, it is the default revision.
		rev = models.DefaultRevisionLabel
	}

	// Find the controlplane that controls that namespace.
	idx := slices.IndexFunc(mesh.ControlPlanes, func(controlPlane models.ControlPlane) bool {
		return controlPlane.Revision == rev && controlPlane.Cluster.Name == cluster
	})
	if idx == -1 {
		return true
	}

	return mesh.ControlPlanes[idx].Config.GetEnableAutoMtls()
}
