package models

import (
	"github.com/kiali/kiali/kubernetes"
)

// Mesh is one or more controlplanes (primaries) managing a dataPlane across one or more clusters.
// There can be multiple primaries on a single cluster when istio revisions are used. A single
// primary can also manage multiple clusters (primary-remote deployment).
type Mesh struct {
	// ControlPlanes that share the same mesh ID.
	ControlPlanes []ControlPlane
}

// ControlPlane manages the dataPlane for one or more kube clusters.
// It's expected to manage the cluster that it is deployed in.
// It has configuration for all the clusters/namespaces associated with it.
type ControlPlane struct {
	// Cluster the kube cluster that the controlplane is running on.
	Cluster *kubernetes.Cluster

	// Config
	Config ControlPlaneConfiguration

	// ExternalControlPlane indicates if the controlplane is managing an external cluster.
	ExternalControlPlane bool

	// ID is the control plane ID as known by istiod.
	ID string

	// IstiodName is the control plane name
	IstiodName string

	// IstiodNamespace is the namespace name of the deployed control plane
	IstiodNamespace string

	// ManagedClusters are the clusters that this controlplane manages.
	// This could include the cluster that the controlplane is running on.
	ManagedClusters []*kubernetes.Cluster

	// ManagesExternal indicates if the controlplane manages an external cluster.
	// It could also manage the cluster that it is running on.
	ManagesExternal bool

	// Revision is the revision of the controlplane.
	// Can be empty when it's the default revision.
	Revision string

	// Version is the version of the controlplane.
	Version *ExternalServiceInfo
}

// ControlPlaneConfiguration is the configuration for the controlPlane and any associated dataPlane.
type ControlPlaneConfiguration struct {
	// IsGatewayToNamespace specifies the PILOT_SCOPE_GATEWAY_TO_NAMESPACE environment variable in Control Plane
	// This is not currently used by the frontend so excluding it from the API response.
	IsGatewayToNamespace bool `json:"-"`

	// OutboundTrafficPolicy is the outbound traffic policy for the controlplane.
	OutboundTrafficPolicy OutboundPolicy

	// Network is the name of the network that the controlplane is using.
	Network string

	// IstioMeshConfig comes from the istio configmap.
	kubernetes.IstioMeshConfig
}
