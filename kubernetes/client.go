package kubernetes

import (
	"context"
	"path/filepath"
	"sync"

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
	GetServerVersion() (*version.Info, error)
	GetToken() string
	IsOpenShift() bool
	IsExpGatewayAPI() bool
	IsGatewayAPI() bool
	IsInferenceAPI() bool
	IsIstioAPI() bool
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
	// isExpGatewayAPI will be merged with isGatewayAPI when experimental features get released
	isExpGatewayAPI *bool
	// isGatewayAPI private variable will check if K8s Gateway API CRD exists on cluster or not
	isGatewayAPI *bool
	// isInferenceAPI private variable will check if K8s Gateway API Inference Extension CRD exists on cluster or not
	isInferenceAPI *bool
	gatewayapi     gatewayapiclient.Interface
	inferenceapi   inferenceapiclient.Interface
	isIstioAPI     *bool
	clusterInfo    ClusterInfo

	// mutex to acquire if you want to access or modify any field in K8SClient concurrently
	rwMutex sync.RWMutex

	// Separated out for testing purposes
	getPodPortForwarderFunc func(namespace, name, portMap string) (httputil.PortForwarder, error)

	conf *kialiconfig.Config
}

// Ensure the K8SClient implements the full read-write UserClientInterface
var _ UserClientInterface = &K8SClient{}

// GetToken returns the BearerToken used from the config
func (client *K8SClient) GetToken() string {
	return client.token
}

func (client *K8SClient) ClusterInfo() ClusterInfo {
	return client.clusterInfo
}

func NewClientWithRemoteClusterInfo(config *rest.Config, remoteClusterInfo *RemoteClusterInfo) (*K8SClient, error) {
	client, err := newClientFromConfig(config)
	if err != nil {
		return nil, err
	}

	if remoteClusterInfo != nil {
		// the secret file name is the cluster name, the kube context may differ
		client.clusterInfo = ClusterInfo{
			Name:       filepath.Base(remoteClusterInfo.SecretFile),
			SecretName: remoteClusterInfo.SecretName,
		}
	} else {
		client.clusterInfo = ClusterInfo{
			Name: kialiconfig.Get().KubernetesConfig.ClusterName,
		}
	}
	// Copy config
	clientConfig := *config
	client.clusterInfo.ClientConfig = &clientConfig

	return client, nil
}

// getConfigForLocalCluster returns the config for the cluster on which Kiali is running.
// It returns an error on any problem
func getConfigForLocalCluster() (*rest.Config, error) {
	incluster, err := rest.InClusterConfig()
	if err != nil {
		log.Errorf("Error '%v' getting config for local cluster", err.Error())
		return nil, err
	}
	return incluster, nil
}

// newClientFromConfig creates a new client to the Kubernetes and Istio APIs.
// It takes the assumption that Istio is deployed into the cluster.
// It hides the access to Kubernetes/Openshift credentials.
// It hides the low level use of the API of Kubernetes and Istio, it should be considered as an implementation detail.
// It returns an error on any problem.
func newClientFromConfig(config *rest.Config) (*K8SClient, error) {
	client := K8SClient{
		token: config.BearerToken,
		conf:  kialiconfig.Get(),
	}

	log.Debugf("Rest perf config QPS: %f Burst: %d", config.QPS, config.Burst)

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

// NewClient is just used for testing purposes.
func NewClient(
	kubeClient kube.Interface,
	istioClient istio.Interface,
	gatewayapiClient gatewayapiclient.Interface,
	inferenceapiClient inferenceapiclient.Interface,
	osAppsClient osappsclient.Interface,
	projectClient projectclient.Interface,
	routeClient routeclient.Interface,
	userClient userclient.Interface,
	oAuthClient oauthclient.Interface,
	reader ctrlclient.Reader,
) *K8SClient {
	return &K8SClient{
		istioClientset: istioClient,
		k8s:            kubeClient,
		gatewayapi:     gatewayapiClient,
		inferenceapi:   inferenceapiClient,
		osAppsClient:   osAppsClient,
		projectClient:  projectClient,
		routeClient:    routeClient,
		userClient:     userClient,
		oAuthClient:    oAuthClient,
		Reader:         reader,
	}
}
