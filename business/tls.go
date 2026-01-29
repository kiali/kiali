package business

import (
	"context"
	"fmt"
	"slices"

	istiov1alpha1 "istio.io/api/mesh/v1alpha1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/util/mtls"
	"github.com/kiali/kiali/util/sliceutil"
)

type TLSService struct {
	businessLayer *Layer
	conf          *config.Config
	discovery     istio.MeshDiscovery
	kialiCache    cache.KialiCache
	userClients   map[string]kubernetes.UserClientInterface
}

const (
	MTLSDisabled               = "MTLS_DISABLED"
	MTLSEnabled                = "MTLS_ENABLED"
	MTLSEnabledExtended        = "MTLS_ENABLED_EXTENDED"
	MTLSNotEnabled             = "MTLS_NOT_ENABLED"
	MTLSPartiallyEnabled       = "MTLS_PARTIALLY_ENABLED"
	MTLSUnset                  = "UNSET"
	MTLSUnsetInheritedDisabled = "UNSET_INHERITED_DISABLED"
	MTLSUnsetInheritedStrict   = "UNSET_INHERITED_STRICT"
	MTLSValidationError        = "MTLS_VALIDATION_ERROR"
)

func (in *TLSService) MeshWidemTLSStatus(ctx context.Context, cluster string, revision string) (models.MTLSStatus, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "MeshWidemTLSStatus",
		observability.Attribute("package", "business"),
		observability.Attribute(observability.TracingClusterTag, cluster),
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
		return ns.Labels[config.IstioRevisionLabel] == revision || ns.Labels[models.IstioInjectionLabel] == "enabled"
	})
	namespaceNames := sliceutil.Map(namespacesForRevision, func(ns models.Namespace) string {
		return ns.Name
	})

	pas := kubernetes.FilterByNamespace(istioConfigList.PeerAuthentications, controlPlane.IstiodNamespace)
	drs := kubernetes.FilterByNamespaceNames(istioConfigList.DestinationRules, namespaceNames)

	mtlsStatus := mtls.MtlsStatus{
		PeerAuthentications: pas,
		DestinationRules:    drs,
		AutoMtlsEnabled:     controlPlane.MeshConfig.EnableAutoMtls.Value,
		AllowPermissive:     false,
	}

	// The default is TLSV1_2 unless it's explicitly set to TLSV1_3 so we can ignore AUTO.
	minTLS := istiov1alpha1.MeshConfig_TLSConfig_TLSV1_2
	if controlPlane.MeshConfig != nil && controlPlane.MeshConfig.MeshMTLS != nil &&
		controlPlane.MeshConfig.MeshMTLS.MinProtocolVersion == istiov1alpha1.MeshConfig_TLSConfig_TLSV1_3 {
		minTLS = istiov1alpha1.MeshConfig_TLSConfig_TLSV1_3
	}

	return models.MTLSStatus{
		Status:          mtlsStatus.MeshMtlsStatus().OverallStatus,
		AutoMTLSEnabled: mtlsStatus.AutoMtlsEnabled,
		MinTLS:          minTLS.String(),
	}, nil
}

func (in *TLSService) NamespaceWidemTLSStatus(ctx context.Context, namespace, cluster string) (models.MTLSStatus, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "NamespaceWidemTLSStatus",
		observability.Attribute("package", "business"),
		observability.Attribute(observability.TracingClusterTag, cluster),
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

	pasAll := kubernetes.FilterByNamespace(istioConfigList.PeerAuthentications, namespace)
	rootNamespace := in.discovery.GetRootNamespace(ctx, cluster, namespace)
	if rootNamespace == namespace {
		pasAll = []*security_v1.PeerAuthentication{}
	}
	pas := in.filterNamespaceWidePeerAuthentications(pasAll)
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

	status := in.namespaceMTLSOverallStatus(cluster, namespace, pas, mtlsStatus)
	if status == MTLSUnset {
		status = in.resolveUnsetNamespaceStatus(ctx, cluster, namespace, rootNamespace, ns)
	}

	return models.MTLSStatus{
		Status:          status,
		AutoMTLSEnabled: mtlsStatus.AutoMtlsEnabled,
		Cluster:         cluster,
		Namespace:       namespace,
	}, nil
}

func (in *TLSService) ClusterWideNSmTLSStatus(ctx context.Context, namespaces []models.Namespace, cluster string) ([]models.MTLSStatus, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "ClusterWideNSmTLSStatus",
		observability.Attribute("package", "business"),
		observability.Attribute(observability.TracingClusterTag, cluster),
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

	meshStatusByRevision := in.meshStatusByRevisionForNamespaces(ctx, cluster, namespaces)

	for _, namespace := range namespaces {
		pasAll := kubernetes.FilterByNamespace(istioConfigList.PeerAuthentications, namespace.Name)
		rootNamespace := in.discovery.GetRootNamespace(ctx, namespace.Cluster, namespace.Name)
		if rootNamespace == namespace.Name {
			pasAll = []*security_v1.PeerAuthentication{}
		}
		pas := in.filterNamespaceWidePeerAuthentications(pasAll)

		mtlsStatus := mtls.MtlsStatus{
			PeerAuthentications: pas,
			DestinationRules:    istioConfigList.DestinationRules,
			AutoMtlsEnabled:     in.hasAutoMTLSEnabled(cluster, &namespace),
			AllowPermissive:     false,
		}

		status := in.namespaceMTLSOverallStatus(cluster, namespace.Name, pas, mtlsStatus)
		if status == MTLSUnset {
			revision := namespace.Revision
			if revision == "" && namespace.Labels != nil {
				revision = namespace.Labels[config.IstioRevisionLabel]
			}
			if revision == "" {
				revision = models.DefaultRevisionLabel
			}
			status = in.resolveUnsetStatusWithMeshStatus(meshStatusByRevision[revision], cluster, namespace.Name, rootNamespace)
		}

		result = append(result, models.MTLSStatus{
			Status:          status,
			AutoMTLSEnabled: mtlsStatus.AutoMtlsEnabled,
			Cluster:         cluster,
			Namespace:       namespace.Name,
		})
	}

	return result, nil
}

// resolveUnsetNamespaceStatus returns the effective mTLS status when namespace status is UNSET:
// - Control plane (root) namespace: mesh-wide status for its revision.
// - Data plane namespace with mesh in STRICT: MTLS_ENABLED_EXTENDED so the UI shows a closed lock.
func (in *TLSService) resolveUnsetNamespaceStatus(ctx context.Context, cluster, namespace, rootNamespace string, ns *models.Namespace) string {
	revision := models.DefaultRevisionLabel
	if ns != nil {
		revision = ns.Revision
		if revision == "" && ns.Labels != nil {
			revision = ns.Labels[config.IstioRevisionLabel]
		}
		if revision == "" {
			revision = models.DefaultRevisionLabel
		}
	}
	meshStatus, err := in.MeshWidemTLSStatus(ctx, cluster, revision)
	if err != nil {
		return MTLSUnset
	}
	return in.resolveUnsetStatusWithMeshStatus(meshStatus.Status, cluster, namespace, rootNamespace)
}

// meshStatusByRevisionForNamespaces returns mesh-wide mTLS status per revision for the given namespaces.
func (in *TLSService) meshStatusByRevisionForNamespaces(ctx context.Context, cluster string, namespaces []models.Namespace) map[string]string {
	revisions := make(map[string]struct{})
	for _, ns := range namespaces {
		rev := ns.Revision
		if rev == "" && ns.Labels != nil {
			rev = ns.Labels[config.IstioRevisionLabel]
		}
		if rev == "" {
			rev = models.DefaultRevisionLabel
		}
		revisions[rev] = struct{}{}
	}
	out := make(map[string]string, len(revisions))
	for rev := range revisions {
		meshStatus, err := in.MeshWidemTLSStatus(ctx, cluster, rev)
		if err != nil {
			continue
		}
		out[rev] = meshStatus.Status
	}
	return out
}

// resolveUnsetStatusWithMeshStatus returns the effective status when namespace is UNSET given mesh status.
func (in *TLSService) resolveUnsetStatusWithMeshStatus(meshStatus, cluster, namespaceName, rootNamespace string) string {
	if rootNamespace == namespaceName {
		if meshStatus != "" {
			return meshStatus
		}
		return MTLSUnset
	}
	// Namespace has no policy (UNSET) but mesh is STRICT: show "Unset" label with closed lock icon only.
	if meshStatus == MTLSEnabled {
		return MTLSUnsetInheritedStrict
	}
	// Namespace has no policy (UNSET) but mesh is DISABLED: show "Unset" label with disabled-style icon/tooltip.
	if meshStatus == MTLSDisabled {
		return MTLSUnsetInheritedDisabled
	}
	return MTLSUnset
}

func (in *TLSService) namespaceMTLSOverallStatus(cluster, namespace string, peerAuthentications []*security_v1.PeerAuthentication, mtlsStatus mtls.MtlsStatus) string {
	// If there are validation errors on any PeerAuthentication in the namespace, surface that as a distinct status.
	// This has priority over UNSET.
	if in.peerAuthenticationHasValidationErrors(cluster, peerAuthentications) {
		return MTLSValidationError
	}

	// Treat the namespace as UNSET when there is no namespace-wide PeerAuthentication that actually defines mTLS.
	// This covers both cases:
	// - no PeerAuthentications at all
	// - PeerAuthentications present but with mtls unset / not specified
	if !in.hasNamespaceWideMTLSPolicy(peerAuthentications) {
		return MTLSUnset
	}

	return mtlsStatus.NamespaceMtlsStatus(namespace, in.conf).OverallStatus
}

func (in *TLSService) hasNamespaceWideMTLSPolicy(peerAuthentications []*security_v1.PeerAuthentication) bool {
	for _, pa := range peerAuthentications {
		if pa == nil || pa.Spec.Mtls == nil {
			continue
		}

		// If mtls is specified but mode is UNSET, it doesn't actually modify mTLS behavior.
		if pa.Spec.Mtls.Mode.String() != "UNSET" {
			return true
		}
	}
	return false
}

// filterNamespaceWidePeerAuthentications returns only those PeerAuthentications that apply namespace-wide.
// Selector-less PeerAuthentications apply to the entire namespace. Some users/tools may send an explicit
// selector with an empty MatchLabels (which also applies to the whole namespace); treat that as namespace-wide too.
func (in *TLSService) filterNamespaceWidePeerAuthentications(peerAuthentications []*security_v1.PeerAuthentication) []*security_v1.PeerAuthentication {
	filtered := make([]*security_v1.PeerAuthentication, 0, len(peerAuthentications))
	for _, pa := range peerAuthentications {
		if pa == nil {
			continue
		}
		if pa.Spec.Selector == nil {
			filtered = append(filtered, pa)
			continue
		}
		if len(pa.Spec.Selector.MatchLabels) == 0 {
			filtered = append(filtered, pa)
		}
	}
	return filtered
}

func (in *TLSService) peerAuthenticationHasValidationErrors(cluster string, peerAuthentications []*security_v1.PeerAuthentication) bool {
	validations := in.kialiCache.Validations().Items()

	for _, pa := range peerAuthentications {
		if pa == nil {
			continue
		}

		key := models.IstioValidationKey{
			ObjectGVK: kubernetes.PeerAuthentications,
			Name:      pa.Name,
			Namespace: pa.Namespace,
			Cluster:   cluster,
		}

		validation, found := validations[key]
		if !found || validation == nil {
			continue
		}

		if !validation.Valid {
			return true
		}

		for _, check := range validation.Checks {
			if check != nil && check.Severity == models.ErrorSeverity {
				return true
			}
		}
	}

	return false
}

func (in *TLSService) hasAutoMTLSEnabled(cluster string, namespace *models.Namespace) bool {
	mesh, err := in.discovery.Mesh(context.TODO())
	if err != nil {
		return true
	}

	// Find the controlplane that is controlling that namespace.
	rev := namespace.Labels[config.IstioRevisionLabel]
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

	return mesh.ControlPlanes[idx].MeshConfig.EnableAutoMtls.Value
}
