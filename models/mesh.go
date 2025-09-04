package models

import (
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"time"

	"google.golang.org/protobuf/types/known/wrapperspb"
	istiov1alpha1 "istio.io/api/mesh/v1alpha1"
	corev1 "k8s.io/api/core/v1"
)

const (
	// IstioTagLabel is the standard label key used on webhooks to identify the tag.
	IstioTagLabel = "istio.io/tag"
	// DefaultRevisionLabel is the value for the default revision.
	DefaultRevisionLabel = "default"
	// IstioInjectionLabel is the key for the istio injection label on a namespace.
	IstioInjectionLabel = "istio-injection"
	// IstioInjectionDisabledLabelValue is the value for the istio injection label when it is disabled.
	IstioInjectionDisabledLabelValue = "disabled"
	// IstioInjectionEnabledLabelValue is the value for the istio injection label when it is enabled.
	IstioInjectionEnabledLabelValue = "enabled"
)

const (
	maistraOwnerLabel     = "maistra.io/owner"
	maistraOwnerNameLabel = "maistra.io/owner-name"
	maistraVersionLabel   = "maistra-version"
)

var maistraLabels = []string{maistraOwnerLabel, maistraOwnerNameLabel, maistraVersionLabel}

type ExternalKialiInstance struct {
	Cluster *KubeCluster
	Kiali   *KialiInstance
}

// Mesh is one or more controlplanes (primaries) managing a dataPlane across one or more clusters.
// There can be multiple primaries on a single cluster when istio revisions are used. A single
// primary can also manage multiple clusters (primary-remote deployment).
type Mesh struct {
	// ControlPlanes that share the same mesh ID.
	ControlPlanes []ControlPlane
	// External Kiali mesh management cluster
	ExternalKiali *ExternalKialiInstance
	// NamespaceMap provides quick lookup from Namespace to ControlPlane key="cluster:namespace"
	NamespaceMap map[string]*ControlPlane
}

// Tag maps a controlplane revision to a namespace label.
// It allows you to keep your dataplane revision labels stable
// while changing the controlplane revision so that you don't
// need to update all your namespace labels each time you upgrade
// your controlplane.
type Tag struct {
	// Cluster is the cluster that the tag is associated with.
	Cluster string `json:"cluster"`
	// Name is the name of the tag.
	Name string `json:"name"`
	// Revision is the revision of the controlplane associated with this tag.
	Revision string `json:"revision"`
}

// ControlPlane manages the dataPlane for one or more kube clusters.
// It's expected to manage the cluster that it is deployed in.
// It has configuration for all the clusters/namespaces associated with it.
// TODO: Should maybe consolidate the pilot discovery env vars under its
// own section/struct: https://istio.io/latest/docs/reference/commands/pilot-discovery/#envvars.
type ControlPlane struct {
	// Cluster the kube cluster that the controlplane is running on.
	Cluster *KubeCluster `json:"cluster"`

	// Config
	Config ControlPlaneConfiguration `json:"config"`

	// ExternalControlPlane indicates if the controlplane is managing an external cluster.
	ExternalControlPlane bool `json:"externalControlPlane"`

	// ID is the control plane ID as known by istiod.
	ID string `json:"id"`

	// IsGatewayToNamespace specifies the PILOT_SCOPE_GATEWAY_TO_NAMESPACE environment variable in Control Plane
	// This is not currently used by the frontend so excluding it from the API response.
	IsGatewayToNamespace bool `json:"-"`

	// IstiodName is the control plane name
	IstiodName string `json:"istiodName"`

	// IstiodNamespace is the namespace name of the deployed control plane
	IstiodNamespace string `json:"istiodNamespace"`

	// Labels are the labels on the istiod deployment.
	// omitted from the json serialization because they aren't used on the frontend.
	Labels map[string]string `json:"-"`

	// ManagedClusters are the clusters that this controlplane manages.
	// This could include the cluster that the controlplane is running on.
	ManagedClusters []*KubeCluster `json:"managedClusters"`

	// ManagesExternal indicates if the controlplane manages an external cluster.
	// It could also manage the cluster that it is running on.
	ManagesExternal bool `json:"managesExternal"`

	// ManagedNamespaces are the namespaces that the controlplane is managing.
	// More specifically, it is a namespace with either injection enabled
	// or ambient enabled and it matches this controlplane's revision either
	// directly or through a tag.
	ManagedNamespaces []Namespace `json:"managedNamespaces"`

	// MeshConfig is the mesh configuration for this controlplane. This value is the "final" mesh
	// config that is the result of merging the various config sources together, e.g. standard configmap
	// and user configmap. This field is just for the backend to use. The frontend should use the Config field.
	MeshConfig *MeshConfig `json:"-"`

	// MonitoringPort is the port used for monitoring metrics, parsed from the --monitoringAddr argument.
	// Defaults to 15014 if not specified or in invalid format.
	MonitoringPort int `json:"monitoringPort"`

	// Resources are the resources that the controlplane is using.
	Resources corev1.ResourceRequirements `json:"resources"`

	// Revision is the revision of the controlplane.
	// Can be empty when it's the default revision.
	Revision string `json:"revision"`

	// RootNamespace is the root namespace name of the deployed control plane, if not set in MeshConfig then it
	// defaults to IstiodNamespace. See https://istio.io/latest/docs/reference/config/istio.mesh.v1alpha1/#MeshConfig-root_namespace
	RootNamespace string `json:"rootNamespace"`

	// SharedMeshConfig is the name of a second configmap that will be merged
	// with the standard mesh config if it's present.
	SharedMeshConfig string `json:"-"`

	// Status is the status of the controlplane as reported by kiali.
	// It includes the deployment status and whether kiali can connect
	// to the controlplane or not.
	Status string `json:"status"`

	// Tags are the tags associated with the controlplane.
	Tag *Tag `json:"tag,omitempty"`

	// Thresholds is the thresholds for the controlplane.
	Thresholds *IstiodThresholds `json:"thresholds,omitempty"`

	// Version is the version of the controlplane.
	Version *ExternalServiceInfo `json:"version,omitempty"`
}

// IsMaistra determines if the controlplane is Maistra or not.
// TODO: Remove this when maistra 2.6 goes out of support.
func (c ControlPlane) IsMaistra() bool {
	for _, maistraLabel := range maistraLabels {
		if _, hasLabel := c.Labels[maistraLabel]; hasLabel {
			return true
		}
	}
	return false
}

// NewMeshConfig applies some defaults that Kiali cares about that are hard coded in istio/istio.
// We don't want to import istio/istio just for that but if the defaults change they
// will need to be updated here as well.
func NewMeshConfig() *MeshConfig {
	return &MeshConfig{
		MeshConfig: &istiov1alpha1.MeshConfig{
			DefaultConfig:  &istiov1alpha1.ProxyConfig{},
			EnableAutoMtls: &wrapperspb.BoolValue{Value: true},
			MeshMTLS:       &istiov1alpha1.MeshConfig_TLSConfig{},
			OutboundTrafficPolicy: &istiov1alpha1.MeshConfig_OutboundTrafficPolicy{
				Mode: istiov1alpha1.MeshConfig_OutboundTrafficPolicy_ALLOW_ANY,
			},
		},
	}
}

// MeshConfig wraps the istio.MeshConfig solely to override json Marshaling
// for some fields. See MarshalJSON for more details.
type MeshConfig struct {
	*istiov1alpha1.MeshConfig
}

// MarshalJSON we're overriding the default Marshaling because of this issue:
// https://github.com/istio/istio/issues/43657.
func (m MeshConfig) MarshalJSON() ([]byte, error) {
	// Don't do custom unmarhsaling if OutboundTrafficPolicy is not set.
	// There are probably other fields like this but only handling this one for now.
	if m.OutboundTrafficPolicy == nil {
		return m.MeshConfig.MarshalJSON()
	}

	// This is convoluted but we:
	// 1. Marshal with the proto definitions (missing outboundPolicyMode).
	// 2. Unmarshal into an unstructured object that we can then edit and add the policy.
	// 3. Marshal that unstructured object with the outboundPolicyMode.
	// Probably not efficient but it gets the job done.
	originalJSON, err := m.MeshConfig.MarshalJSON()
	if err != nil {
		return nil, err
	}

	var meshUnstructured map[string]any
	if err := json.Unmarshal(originalJSON, &meshUnstructured); err != nil {
		return nil, err
	}

	if _, ok := meshUnstructured["outboundTrafficPolicy"]; ok {
		meshUnstructured["outboundTrafficPolicy"] = struct {
			Mode string `json:"mode"`
		}{
			Mode: istiov1alpha1.MeshConfig_OutboundTrafficPolicy_Mode_name[int32(m.OutboundTrafficPolicy.Mode)],
		}
	}

	return json.Marshal(meshUnstructured)
}

// MeshConfigMap is all the data you'll find in the mesh configmap.
type MeshConfigMap struct {
	Mesh         *MeshConfig                 `json:"mesh,omitempty"`
	MeshNetworks *istiov1alpha1.MeshNetworks `json:"meshNetworks,omitempty"`
}

// MeshConfigSource includes some information about the configuration source.
type MeshConfigSource struct {
	// Cluster of the configmap.
	Cluster   string         `json:"cluster,omitempty"`
	ConfigMap *MeshConfigMap `json:"configMap,omitempty"`
	// Name of the configmap.
	Name string `json:"name,omitempty"`
	// Namespace of the configmap.
	Namespace string `json:"namespace,omitempty"`
}

// ControlPlaneConfiguration is the configuration for the controlPlane and any associated dataPlane.
// This is used primarly consumed by the frontend. If you just want the mesh config for the controlplane
// then use controlPlane.MeshConfig.
type ControlPlaneConfiguration struct {
	// Certificates are the certificates in use by the controlplane.
	Certificates []Certificate `json:"certificates,omitempty"`

	// EffectiveConfig is the effective configuration from combining the various configmaps.
	// TODO: Support config file.
	EffectiveConfig *MeshConfigSource `json:"effectiveConfig,omitempty"`

	// Network is the name of the network that the controlplane is using.
	Network string `json:"network,omitempty"`

	// StandardConfigMap raw data from the standard configmap
	StandardConfig *MeshConfigSource `json:"standardConfig,omitempty"`

	// SharedConfig raw data from the shared configmap.
	SharedConfig *MeshConfigSource `json:"sharedConfig,omitempty"`
}

type Certificate struct {
	DNSNames      []string  `json:"dnsNames"`
	ConfigMapName string    `json:"configMapName"`
	Issuer        string    `json:"issuer"`
	NotBefore     time.Time `json:"notBefore"`
	NotAfter      time.Time `json:"notAfter"`
	Error         string    `json:"error"`
	Accessible    bool      `json:"accessible"`
	ClusterName   string    `json:"cluster"`
}

func (ci *Certificate) Parse(certificate []byte) {
	block, _ := pem.Decode(certificate)

	if block == nil {
		ci.Error = "unable to decode certificate"
		return
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		ci.Error = "unable to parse certificate"
		return
	}

	ci.Issuer = cert.Issuer.String()
	ci.NotBefore = cert.NotBefore
	ci.NotAfter = cert.NotAfter
	ci.Accessible = true
}

// Cluster holds some metadata about a Kubernetes cluster that is
// part of the mesh.
type KubeCluster struct {
	// Accessible specifies if the cluster is accessible or not. Clusters that are manually specified in the Kiali config
	// but do not have an associated remote cluster secret are considered not accessible. This is helpful when you have
	// two disconnected Kialis and want to link them without giving them access to each other.
	Accessible bool `json:"accessible"`

	// ApiEndpoint is the URL where the Kubernetes/Cluster API Server can be contacted
	ApiEndpoint string `json:"apiEndpoint"`

	// IsKialiHome specifies if this cluster is hosting this Kiali instance (and the observed Mesh Control Plane)
	IsKialiHome bool `json:"isKialiHome"`

	// KialiInstances is the list of Kialis discovered in the cluster.
	KialiInstances []KialiInstance `json:"kialiInstances"`

	// Name specifies the CLUSTER_ID as known by the Control Plane
	Name string `json:"name"`

	// SecretName is the name of the kubernetes "remote cluster secret" that was mounted to the file system and where data of this cluster was resolved
	SecretName string `json:"secretName"`
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
