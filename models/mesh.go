package models

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	IstioRevisionLabel = "istio.io/rev"
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
	Cluster *KubeCluster

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
	ManagedClusters []*KubeCluster

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
	IstioMeshConfig
}

type Certificate struct {
	DNSNames   []string `yaml:"dnsNames"`
	SecretName string   `yaml:"secretName"`
}

type IstioMeshConfig struct {
	Certificates            []Certificate           `yaml:"certificates,omitempty" json:"certificates,omitempty"`
	DisableMixerHttpReports bool                    `yaml:"disableMixerHttpReports,omitempty"`
	DiscoverySelectors      []*metav1.LabelSelector `yaml:"discoverySelectors,omitempty"`
	EnableAutoMtls          *bool                   `yaml:"enableAutoMtls,omitempty"`
	MeshMTLS                struct {
		MinProtocolVersion string `yaml:"minProtocolVersion"`
	} `yaml:"meshMtls"`
	DefaultConfig struct {
		MeshId string `yaml:"meshId"`
	} `yaml:"defaultConfig" json:"defaultConfig"`
	TrustDomain string `yaml:"trustDomain,omitempty"`
}

func (imc IstioMeshConfig) GetEnableAutoMtls() bool {
	if imc.EnableAutoMtls == nil {
		return true
	}
	return *imc.EnableAutoMtls
}

// Cluster holds some metadata about a Kubernetes cluster that is
// part of the mesh.
type KubeCluster struct {
	// ApiEndpoint is the URL where the Kubernetes/Cluster API Server can be contacted
	ApiEndpoint string `json:"apiEndpoint"`

	// IsKialiHome specifies if this cluster is hosting this Kiali instance (and the observed Mesh Control Plane)
	IsKialiHome bool `json:"isKialiHome"`

	// KialiInstances is the list of Kialis discovered in the cluster.
	KialiInstances []KialiInstance `json:"kialiInstances"`

	// Name specifies the CLUSTER_ID as known by the Control Plane
	Name string `json:"name"`

	// Network specifies the logical NETWORK_ID as known by the Control Plane
	Network string `json:"network"`

	// SecretName is the name of the kubernetes "remote cluster secret" that was mounted to the file system and where data of this cluster was resolved
	SecretName string `json:"secretName"`

	// Accessible specifies if the cluster is accessible or not. Clusters that are manually specified in the Kiali config
	// but do not have an associated remote cluster secret are considered not accessible. This is helpful when you have
	// two disconnected Kialis and want to link them without giving them access to each other.
	Accessible bool `json:"accessible"`
}

// KialiInstance represents a Kiali installation. It holds some data about
// where and how Kiali was deployed.
type KialiInstance struct {
	// Namespace is the name of the namespace where is Kiali installed on.
	Namespace string `json:"namespace"`

	// OperatorResource contains the namespace and the name of the Kiali CR that the user
	// created to install Kiali via the operator. This can be blank if the operator wasn't used
	// to install Kiali. This resource is populated from annotations in the Service. It has
	// the format "namespace/resource_name".
	OperatorResource string `json:"operatorResource"`

	// ServiceName is the name of the Kubernetes service associated to the Kiali installation. The Kiali Service is the
	// entity that is looked for in order to determine if a Kiali instance is available.
	ServiceName string `json:"serviceName"`

	// Url is the URI that can be used to access Kiali.
	Url string `json:"url"`

	// Version is the Kiali version as reported by annotations in the Service.
	Version string `json:"version"`
}
