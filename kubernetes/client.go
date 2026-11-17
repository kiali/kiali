package kubernetes

import (
	"context"
	"fmt"
	"slices"
	"sync"
	"time"

	osappsclient "github.com/openshift/client-go/apps/clientset/versioned"
	oauthclient "github.com/openshift/client-go/oauth/clientset/versioned"
	projectclient "github.com/openshift/client-go/project/clientset/versioned"
	routeclient "github.com/openshift/client-go/route/clientset/versioned"
	userclient "github.com/openshift/client-go/user/clientset/versioned"
	istio "istio.io/client-go/pkg/clientset/versioned"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/version"
	kube "k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
	inferenceapiclient "sigs.k8s.io/gateway-api-inference-extension/client-go/clientset/versioned"
	gatewayapiclient "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned"

	kialiconfig "github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

var (
	emptyGetOptions  = meta_v1.GetOptions{}
	emptyListOptions = meta_v1.ListOptions{}
)

type PodLogs struct {
	Logs string `json:"logs,omitempty"`
}

// ClusterInfo is basically a rest.Config with a few extra fields that are useful to Kiali.
type ClusterInfo struct {
	// ClientConfig is the rest.Config is used to create clients for the various APIs.
	ClientConfig *rest.Config

	// Name is the name of the cluster this client is connected to.
	Name string

	// SecretName is the name of the secret that contains the credentials for this cluster.
	SecretName string
}

// ClientInterface defines a read-only client API (mocked functions are necessary here)
type ClientInterface interface {
	GetCacheKey() string
	GetServerVersion() (*version.Info, error)
	GetToken() string
	IsOpenShift() bool
	IsGatewayAPI() bool
	// IsGatewayAPIContext is IsGatewayAPI under a caller-supplied deadline: a probe
	// stalled on an unreachable cluster is abandoned when the context is done. Callers
	// that share one discovery budget across clusters (the config handler) use these so
	// a single stalled remote cannot consume the whole budget.
	IsGatewayAPIContext(ctx context.Context) bool
	HasTCPRouteInV1() bool
	HasTLSRouteInV1() bool
	HasUDPRouteInV1() bool
	IsInferenceAPI() bool
	IsIstioGateway() bool
	// IsIstioGatewayContext is IsIstioGateway under a caller-supplied deadline; see
	// IsGatewayAPIContext.
	IsIstioGatewayContext(ctx context.Context) bool
	IsIstioAPI() bool
	// IsIstioAPIContext is IsIstioAPI under a caller-supplied deadline; see
	// IsGatewayAPIContext.
	IsIstioAPIContext(ctx context.Context) bool
	// ClusterInfo returns some information about the cluster this client is connected to.
	// This gets set when the client is first created.
	ClusterInfo() ClusterInfo
	K8SClientInterface
	IstioClientInterface
	OSClientInterface

	ctrlclient.Reader
}

// UserClientInterface adds to ClientInterface all write APIs (mocked functions are necessary here)
type UserClientInterface interface {
	ClientInterface
	K8SUserClientInterface
	IstioUserClientInterface
	OSUserClientInterface
}

// ConvertFromUserClients is a utility to be used for the rare instances where you
// have a map of user clients but need a map of base client interfaces. This effectively
// cripples the user client by removing the ability to perform write operations.
func ConvertFromUserClients(in map[string]UserClientInterface) map[string]ClientInterface {
	out := make(map[string]ClientInterface, len(in))
	for k, v := range in {
		out[k] = ClientInterface(v)
	}
	return out
}

// K8SClient is the client struct for Kubernetes and Istio APIs
// It hides the way it queries each API
type K8SClient struct {
	token string
	k8s   kube.Interface
	// logsConfig is the pod-log stream config: a plain copy of the client config without
	// the request timeout (a timeout caps the entire body read and would cut logs short).
	// It carries no custom transport: client-go must build the transport itself so that
	// credential plugins (for example an exec provider installing a certificate callback)
	// keep working; the stream's establishment is bounded separately, in StreamPodLogs.
	// The clientset is built lazily on first use so identities that never request logs do
	// not pay for a second Kubernetes client (its own rate limiter included).
	logsConfig *rest.Config
	logsClient kube.Interface

	// controller runtime client. This is only embedded to make the transition to controller-runtime easier.
	ctrlclient.Reader

	projectClient projectclient.Interface
	routeClient   routeclient.Interface
	osAppsClient  osappsclient.Interface
	oAuthClient   oauthclient.Interface
	userClient    userclient.Interface

	istioClientset istio.Interface
	// Used for portforwarding requests.
	restConfig *rest.Config
	// Used in REST queries after bump to client-go v0.20.x
	ctx context.Context
	// isOpenShift private variable will check if kiali is deployed under an OpenShift cluster or not
	// It is represented as a pointer to include the initialization phase.
	// See kubernetes_service.go#IsOpenShift() for more details.
	isOpenShift *bool
	// isGatewayAPI private variable will check if K8s Gateway API CRD exists on cluster or not
	isGatewayAPI *bool
	// hasTCPRouteInV1 private variable will check if TCPRoute exists in v1 (GW API 1.6+)
	hasTCPRouteInV1 *bool
	// hasTLSRouteInV1 private variable will check if TLSRoute exists in v1 (GW API 1.5+)
	hasTLSRouteInV1 *bool
	// hasUDPRouteInV1 private variable will check if UDPRoute exists in v1 (GW API 1.6+)
	hasUDPRouteInV1 *bool
	// isInferenceAPI private variable will check if K8s Gateway API Inference Extension CRD exists on cluster or not
	isInferenceAPI *bool
	gatewayapi     gatewayapiclient.Interface
	inferenceapi   inferenceapiclient.Interface
	// isIstioGateway will check if 'gateways.networking.istio.io' CRD is installed, it can be not installed when K8s Gateway API CRD exists on cluster
	isIstioGateway *bool
	isIstioAPI     *bool
	clusterInfo    ClusterInfo

	// mutex to acquire if you want to access or modify any field in K8SClient concurrently
	rwMutex sync.RWMutex

	// probeFailures records when each capability probe (IsOpenShift, IsGatewayAPI, ...)
	// last failed transiently, for the retry backoff in capabilityProbe. Guarded by rwMutex.
	probeFailures map[string]time.Time

	// Separated out for testing purposes
	getPodPortForwarderFunc func(namespace, name, portMap string) (httputil.PortForwarder, error)

	// TODO: This should really just be the cert pool since that's all that we need.
	// There's probably even a way to set the cert pool on the restConfig.
	conf *kialiconfig.Config
}

// Ensure the K8SClient implements the full read-write UserClientInterface
var _ UserClientInterface = &K8SClient{}

// GetCacheKey returns a string suitable for keying per-user caches. Under impersonation,
// different users share the same bearer token (the SA token); this method returns the
// impersonated username instead, ensuring each user gets a distinct cache entry.
func (client *K8SClient) GetCacheKey() string {
	if client.restConfig != nil && client.restConfig.Impersonate.UserName != "" {
		return client.restConfig.Impersonate.UserName
	}
	return client.token
}

// GetToken returns the BearerToken used from the config
func (client *K8SClient) GetToken() string {
	return client.token
}

func (client *K8SClient) ClusterInfo() ClusterInfo {
	return client.clusterInfo
}

func NewClient(clusterInfo ClusterInfo, conf *kialiconfig.Config) (*K8SClient, error) {
	client, err := newClientFromConfig(clusterInfo.ClientConfig, conf)
	if err != nil {
		return nil, err
	}

	client.clusterInfo = clusterInfo
	client.conf = conf

	return client, nil
}

// newClientFromConfig creates a new client to the Kubernetes and Istio APIs.
// It takes the assumption that Istio is deployed into the cluster.
// It hides the access to Kubernetes/Openshift credentials.
//
// The incoming config is copied before any timeout is applied: it is aliased by
// ClusterInfo().ClientConfig, which also feeds the controller-runtime informer caches, where
// a request timeout would kill long watches. The copy carries the configured live-call
// request timeout; a preconfigured timeout on the incoming config is never loosened.
// ApplyRequestTimeout bounds a live-call rest config with the configured request timeout
// (kiali_internal.kubernetes_client.request_timeout): a longer incoming timeout is clamped
// to the bound, a shorter incoming timeout is preserved, and a zero configured bound
// disables the clamp entirely. Use it on every config used for live (non-informer) round
// trips - the shared informer configs must stay timeout-free.
func ApplyRequestTimeout(restCfg *rest.Config, conf *kialiconfig.Config) {
	if requestTimeout := conf.KialiInternal.KubernetesClient.RequestTimeout; requestTimeout > 0 && (restCfg.Timeout == 0 || restCfg.Timeout > requestTimeout) {
		restCfg.Timeout = requestTimeout
	}
}

func newClientFromConfig(config *rest.Config, conf *kialiconfig.Config) (*K8SClient, error) {
	config = rest.CopyConfig(config)
	ApplyRequestTimeout(config, conf)

	client := K8SClient{
		token: config.BearerToken,
	}

	// Pod log streams must not inherit the request timeout (it caps the entire body read,
	// so logs would stop ~10s in), but their establishment is still bounded. The copy is
	// deliberately plain: client-go builds the log client's transport itself, which keeps
	// credential plugins working (an exec provider refuses to combine its certificate
	// callback with a custom transport). The establishment deadline is applied in
	// StreamPodLogs, around the request, not on the transport.
	logsConfig := rest.CopyConfig(config)
	logsConfig.Timeout = 0
	client.logsConfig = logsConfig

	log.Debugf("Rest perf config QPS: %f Burst: %d Timeout: %s", config.QPS, config.Burst, config.Timeout)

	k8s, err := kube.NewForConfig(config)
	if err != nil {
		return nil, err
	}
	client.k8s = k8s
	client.restConfig = config

	client.istioClientset, err = istio.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	client.gatewayapi, err = gatewayapiclient.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	client.inferenceapi, err = inferenceapiclient.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	client.osAppsClient, err = osappsclient.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	client.projectClient, err = projectclient.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	client.routeClient, err = routeclient.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	client.userClient, err = userclient.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	client.oAuthClient, err = oauthclient.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	client.ctx = context.Background()

	return &client, nil
}

// NewClientsFromKubeConfig creates kubernetes clients by reading the kubeconfig file
// and creating clients for the specified contexts.
func NewClientsFromKubeConfig(conf *kialiconfig.Config, kubeConfigPath string, remoteClusterContexts []string, homeClusterContext string) (map[string]ClientInterface, error) {
	kubeConfig, err := clientcmd.LoadFromFile(kubeConfigPath)
	if err != nil {
		return nil, fmt.Errorf("unable to read kubeconfig from file: %s", kubeConfigPath)
	}

	contextNames := slices.Clone(remoteClusterContexts)
	homeContext := kubeConfig.CurrentContext
	if homeClusterContext != "" {
		homeContext = homeClusterContext
	}
	contextNames = append(contextNames, homeContext)

	contexts := map[string]*api.Context{}
	for _, ctx := range contextNames {
		kubeContext := kubeConfig.Contexts[ctx]
		if kubeContext == nil {
			return nil, fmt.Errorf("context %s not found in kubeconfig file: %s", ctx, kubeConfigPath)
		}
		contexts[ctx] = kubeContext
	}

	clients := map[string]ClientInterface{}
	for context, clusterInfo := range contexts {
		clusterName := clusterInfo.Cluster
		if override := conf.Deployment.ClusterNameOverrides[clusterInfo.Cluster]; override != "" {
			clusterName = override
		}

		restConf, err := clientcmd.NewDefaultClientConfig(*kubeConfig, &clientcmd.ConfigOverrides{CurrentContext: context}).ClientConfig()
		if err != nil {
			return nil, fmt.Errorf("unable to create client config for context %s: %s", context, err)
		}

		client, err := NewClient(ClusterInfo{
			Name:         clusterName,
			ClientConfig: restConf,
		}, conf)
		if err != nil {
			return nil, fmt.Errorf("unable to create remote Kiali Service Account client: %s", err)
		}

		clients[clusterName] = client

		// Need to set the kube cluster name to the current context otherwise cache won't start.
		if context == homeContext {
			conf.KubernetesConfig.ClusterName = clusterName
			kialiconfig.Set(conf)
		}
	}

	return clients, nil
}
