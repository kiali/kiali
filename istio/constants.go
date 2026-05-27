package istio

const (
	istioControlPlaneClustersLabel        = "topology.istio.io/controlPlaneClusters"
	istiodAppLabelValue                   = "istiod"
	istiodClusterIDEnvKey                 = "CLUSTER_ID"
	istiodExternalEnvKey                  = "EXTERNAL_ISTIOD"
	istiodScopeGatewayEnvKey              = "PILOT_SCOPE_GATEWAY_TO_NAMESPACE"
	istiodSharedMeshConfigEnvKey          = "SHARED_MESH_CONFIG"
	baseIstioConfigMapName                = "istio"                  // As of 1.19 this is hardcoded in the helm charts.
	baseIstioSidecarInjectorConfigMapName = "istio-sidecar-injector" // As of 1.19 this is hardcoded in the helm charts.
	certificatesConfigMapName             = "istio-ca-root-cert"
	certificateName                       = "root-cert.pem"
	monitoringPortName                    = "http-monitoring"
	defaultMonitoringPort                 = 15014 // Default monitoring port for istiod
)
