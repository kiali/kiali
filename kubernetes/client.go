package kubernetes

import (
	"context"
	"encoding/base64"
	"fmt"
	"net"
	"os"
	"strings"

	istio "istio.io/client-go/pkg/clientset/versioned"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/version"
	kube "k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd/api"
	gatewayapiclient "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned"

	kialiConfig "github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

// RemoteSecretData is used to identify the remote cluster Kiali will connect to as its "local cluster".
// This is to support installing Kiali in the control plane, but observing only the data plane in the remote cluster.
// Experimental feature. See: https://github.com/kiali/kiali/issues/3002
const RemoteSecretData = "/kiali-remote-secret/kiali"

var (
	emptyGetOptions  = meta_v1.GetOptions{}
	emptyListOptions = meta_v1.ListOptions{}
)

type PodLogs struct {
	Logs string `json:"logs,omitempty"`
}

// ClientInterface for mocks (only mocked function are necessary here)
type ClientInterface interface {
	GetServerVersion() (*version.Info, error)
	GetToken() string
	GetAuthInfo() *api.AuthInfo
	IsOpenShift() bool
	IsGatewayAPI() bool
	IsIstioAPI() bool
	K8SClientInterface
	IstioClientInterface
	OSClientInterface
}

// K8SClient is the client struct for Kubernetes and Istio APIs
// It hides the way it queries each API
type K8SClient struct {
	ClientInterface
	token          string
	k8s            kube.Interface
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
	gatewayapi   gatewayapiclient.Interface
	isIstioAPI   *bool

	// Separated out for testing purposes
	getPodPortForwarderFunc func(namespace, name, portMap string) (httputil.PortForwarder, error)
}

// GetToken returns the BearerToken used from the config
func (client *K8SClient) GetToken() string {
	return client.token
}

// GetConfigForRemoteClusterInfo points the returned k8s client config to a remote cluster's API server.
// The returned config will have the user's token associated with it.
func GetConfigForRemoteClusterInfo(cluster RemoteClusterInfo) (*rest.Config, error) {
	return GetConfigWithTokenForRemoteCluster(cluster.Cluster, cluster.User)
}

// GetConfigWithTokenForRemoteCluster points the returned k8s client config to a remote cluster's API server.
// The returned config will have the given user's token associated with it.
func GetConfigWithTokenForRemoteCluster(cluster RemoteSecretClusterListItem, user RemoteSecretUser) (*rest.Config, error) {
	config, err := GetConfigForRemoteCluster(cluster)
	if err != nil {
		return nil, err
	}
	config.BearerToken = user.User.Token
	return config, nil
}

// GetConfigForRemoteCluster points the returned k8s client config to a remote cluster's API server.
// The returned config will not have any user token associated with it.
func GetConfigForRemoteCluster(cluster RemoteSecretClusterListItem) (*rest.Config, error) {
	caData := cluster.Cluster.CertificateAuthorityData
	rootCaDecoded, err := base64.StdEncoding.DecodeString(caData)
	if err != nil {
		return nil, err
	}
	// Basically implement rest.InClusterConfig() with the remote creds
	tlsClientConfig := rest.TLSClientConfig{
		CAData: []byte(rootCaDecoded),
	}

	serverParse := strings.Split(cluster.Cluster.Server, ":")
	if len(serverParse) != 3 && len(serverParse) != 2 {
		return nil, fmt.Errorf("invalid remote API server URL [%s]" + cluster.Cluster.Server)
	}
	host := strings.TrimPrefix(serverParse[1], "//")

	port := "443"
	if len(serverParse) == 3 {
		port = serverParse[2]
	}

	if !strings.EqualFold(serverParse[0], "https") {
		return nil, fmt.Errorf("only HTTPS protocol is allowed in remote API server URL [%s]", cluster.Cluster.Server)
	}

	// Leave the bearer token unset - the caller will be responsible to set that later, if it is needed.
	c := kialiConfig.Get()
	return &rest.Config{
		Host:            "https://" + net.JoinHostPort(host, port),
		TLSClientConfig: tlsClientConfig,
		QPS:             c.KubernetesConfig.QPS,
		Burst:           c.KubernetesConfig.Burst,
	}, nil
}

// GetConfigForLocalCluster return a client with the correct configuration
// Returns configuration if Kiali is in Cluster when InCluster is true
// Returns configuration if Kiali is not in Cluster when InCluster is false
// It returns an error on any problem
func GetConfigForLocalCluster() (*rest.Config, error) {
	c := kialiConfig.Get()

	if c.InCluster {
		var incluster *rest.Config
		var err error
		if remoteSecret, readErr := GetRemoteSecret(RemoteSecretData); readErr == nil {
			incluster, err = GetConfigForRemoteCluster(remoteSecret.Clusters[0])
		} else {
			incluster, err = rest.InClusterConfig()
			if err != nil {
				log.Errorf("Error '%v' getting config for local cluster", err.Error())
				return nil, err
			}
			incluster.QPS = c.KubernetesConfig.QPS
			incluster.Burst = c.KubernetesConfig.Burst
		}
		if err != nil {
			return nil, err
		}
		return incluster, nil
	}

	// this is mainly for testing/running Kiali outside of the cluster
	host, port := os.Getenv("KUBERNETES_SERVICE_HOST"), os.Getenv("KUBERNETES_SERVICE_PORT")
	if len(host) == 0 || len(port) == 0 {
		return nil, fmt.Errorf("unable to load in-cluster configuration, KUBERNETES_SERVICE_HOST and KUBERNETES_SERVICE_PORT must be defined")
	}

	return &rest.Config{
		// TODO: switch to using cluster DNS.
		Host:  "http://" + net.JoinHostPort(host, port),
		QPS:   c.KubernetesConfig.QPS,
		Burst: c.KubernetesConfig.Burst,
	}, nil
}

// NewClientFromConfig creates a new client to the Kubernetes and Istio APIs.
// It takes the assumption that Istio is deployed into the cluster.
// It hides the access to Kubernetes/Openshift credentials.
// It hides the low level use of the API of Kubernetes and Istio, it should be considered as an implementation detail.
// It returns an error on any problem.
func NewClientFromConfig(config *rest.Config) (*K8SClient, error) {
	client := K8SClient{
		token: config.BearerToken,
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

	client.ctx = context.Background()

	return &client, nil
}

// NewClient is just used for testing purposes.
func NewClient(kubeClient kube.Interface, istioClient istio.Interface, gatewayapiClient gatewayapiclient.Interface) *K8SClient {
	return &K8SClient{
		istioClientset: istioClient,
		k8s:            kubeClient,
		gatewayapi:     gatewayapiClient,
	}
}
