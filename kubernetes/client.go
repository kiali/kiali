package kubernetes

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"os"
	"strings"

	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/version"
	kube "k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd/api"

	kialiConfig "github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

const RemoteSecretData = "/kiali-remote-secret/kiali"

var (
	emptyListOptions = meta_v1.ListOptions{}
	emptyGetOptions  = meta_v1.GetOptions{}
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
	K8SClientInterface
	IstioClientInterface
	Iter8ClientInterface
	OSClientInterface
}

// K8SClient is the client struct for Kubernetes and Istio APIs
// It hides the way it queries each API
type K8SClient struct {
	ClientInterface
	token              string
	k8s                *kube.Clientset
	istioNetworkingApi *rest.RESTClient
	istioSecurityApi   *rest.RESTClient
	iter8Api           *rest.RESTClient
	// Used in REST queries after bump to client-go v0.20.x
	ctx context.Context
	// isOpenShift private variable will check if kiali is deployed under an OpenShift cluster or not
	// It is represented as a pointer to include the initialization phase.
	// See kubernetes_service.go#IsOpenShift() for more details.
	isOpenShift *bool

	// isIter8Api private variable will check if extension Iter8 API is present.
	// It is represented as a pointer to include the initialization phase.
	// See iter8.go#IsIter8Api() for more details
	isIter8Api *bool

	// networkingResources private variable will check which resources kiali has access to from networking.istio.io group
	// It is represented as a pointer to include the initialization phase.
	// See istio_details_service.go#hasNetworkingResource() for more details.
	networkingResources *map[string]bool

	// securityResources private variable will check which resources kiali has access to from security.istio.io group
	// It is represented as a pointer to include the initialization phase.
	// See istio_details_service.go#hasSecurityResource() for more details.
	securityResources *map[string]bool
}

// GetK8sApi returns the clientset referencing all K8s rest clients
func (client *K8SClient) GetK8sApi() *kube.Clientset {
	return client.k8s
}

// GetIstioNetworkingApi returns the istio config rest client
func (client *K8SClient) GetIstioNetworkingApi() *rest.RESTClient {
	return client.istioNetworkingApi
}

// GetIstioSecurityApi returns the istio security rest client
func (client *K8SClient) GetIstioSecurityApi() *rest.RESTClient {
	return client.istioSecurityApi
}

// GetToken returns the BearerToken used from the config
func (client *K8SClient) GetToken() string {
	return client.token
}

// Point the k8s client to a remote cluster's API server
func UseRemoteCreds(remoteSecret *RemoteSecret) (*rest.Config, error) {
	caData := remoteSecret.Clusters[0].Cluster.CertificateAuthorityData
	rootCaDecoded, err := base64.StdEncoding.DecodeString(caData)
	if err != nil {
		return nil, err
	}
	// Basically implement rest.InClusterConfig() with the remote creds
	tlsClientConfig := rest.TLSClientConfig{
		CAData: []byte(rootCaDecoded),
	}

	serverParse := strings.Split(remoteSecret.Clusters[0].Cluster.Server, ":")
	if len(serverParse) != 3 && len(serverParse) != 2 {
		return nil, errors.New("Invalid remote API server URL")
	}
	host := strings.TrimPrefix(serverParse[1], "//")

	port := "443"
	if len(serverParse) == 3 {
		port = serverParse[2]
	}

	if !strings.EqualFold(serverParse[0], "https") {
		return nil, errors.New("Only HTTPS protocol is allowed in remote API server URL")
	}

	// There's no need to add the BearerToken because it's ignored later on
	return &rest.Config{
		Host:            "https://" + net.JoinHostPort(host, port),
		TLSClientConfig: tlsClientConfig,
	}, nil
}

// ConfigClient return a client with the correct configuration
// Returns configuration if Kiali is in Cluster when InCluster is true
// Returns configuration if Kiali is not int Cluster when InCluster is false
// It returns an error on any problem
func ConfigClient() (*rest.Config, error) {
	if kialiConfig.Get().InCluster {
		var incluster *rest.Config
		var err error
		if remoteSecret, readErr := GetRemoteSecret(RemoteSecretData); readErr == nil {
			incluster, err = UseRemoteCreds(remoteSecret)
		} else {
			incluster, err = rest.InClusterConfig()
		}
		if err != nil {
			return nil, err
		}
		incluster.QPS = kialiConfig.Get().KubernetesConfig.QPS
		incluster.Burst = kialiConfig.Get().KubernetesConfig.Burst
		return incluster, nil
	}
	host, port := os.Getenv("KUBERNETES_SERVICE_HOST"), os.Getenv("KUBERNETES_SERVICE_PORT")
	if len(host) == 0 || len(port) == 0 {
		return nil, fmt.Errorf("unable to load in-cluster configuration, KUBERNETES_SERVICE_HOST and KUBERNETES_SERVICE_PORT must be defined")
	}

	return &rest.Config{
		// TODO: switch to using cluster DNS.
		Host:  "http://" + net.JoinHostPort(host, port),
		QPS:   kialiConfig.Get().KubernetesConfig.QPS,
		Burst: kialiConfig.Get().KubernetesConfig.Burst,
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

	// Istio is a CRD extension of Kubernetes API, so any custom type should be registered here.
	// KnownTypes registers the Istio objects we use, as soon as we get more info we will increase the number of types.
	types := runtime.NewScheme()
	schemeBuilder := runtime.NewSchemeBuilder(
		func(scheme *runtime.Scheme) error {
			// Register networking types
			for _, nt := range networkingTypes {
				scheme.AddKnownTypeWithName(NetworkingGroupVersion.WithKind(nt.objectKind), &GenericIstioObject{})
				scheme.AddKnownTypeWithName(NetworkingGroupVersion.WithKind(nt.collectionKind), &GenericIstioObjectList{})
			}
			for _, rt := range securityTypes {
				scheme.AddKnownTypeWithName(SecurityGroupVersion.WithKind(rt.objectKind), &GenericIstioObject{})
				scheme.AddKnownTypeWithName(SecurityGroupVersion.WithKind(rt.collectionKind), &GenericIstioObjectList{})
			}
			// Register Extension (iter8) types
			for _, rt := range iter8Types {
				// We will use a Iter8ExperimentObject which only contains metadata and spec with interfaces
				// model objects will be responsible to parse it
				scheme.AddKnownTypeWithName(Iter8GroupVersion.WithKind(rt.objectKind), &Iter8ExperimentObject{})
				scheme.AddKnownTypeWithName(Iter8GroupVersion.WithKind(rt.collectionKind), &Iter8ExperimentObjectList{})
			}

			meta_v1.AddToGroupVersion(scheme, NetworkingGroupVersion)
			meta_v1.AddToGroupVersion(scheme, SecurityGroupVersion)
			meta_v1.AddToGroupVersion(scheme, Iter8GroupVersion)
			return nil
		})

	err = schemeBuilder.AddToScheme(types)
	if err != nil {
		return nil, err
	}

	istioNetworkingAPI, err := newClientForAPI(config, NetworkingGroupVersion, types)
	if err != nil {
		return nil, err
	}

	istioSecurityApi, err := newClientForAPI(config, SecurityGroupVersion, types)
	if err != nil {
		return nil, err
	}

	iter8Api, err := newClientForAPI(config, Iter8GroupVersion, types)
	if err != nil {
		return nil, err
	}

	client.istioNetworkingApi = istioNetworkingAPI
	client.istioSecurityApi = istioSecurityApi
	client.iter8Api = iter8Api
	client.ctx = context.Background()
	return &client, nil
}

func newClientForAPI(fromCfg *rest.Config, groupVersion schema.GroupVersion, scheme *runtime.Scheme) (*rest.RESTClient, error) {
	cfg := rest.Config{
		Host:    fromCfg.Host,
		APIPath: "/apis",
		ContentConfig: rest.ContentConfig{
			GroupVersion:         &groupVersion,
			NegotiatedSerializer: serializer.WithoutConversionCodecFactory{CodecFactory: serializer.NewCodecFactory(scheme)},
			ContentType:          runtime.ContentTypeJSON,
		},
		BearerToken:     fromCfg.BearerToken,
		TLSClientConfig: fromCfg.TLSClientConfig,
		QPS:             fromCfg.QPS,
		Burst:           fromCfg.Burst,
	}

	if fromCfg.Impersonate.UserName != "" {
		cfg.Impersonate.UserName = fromCfg.Impersonate.UserName
		cfg.Impersonate.Groups = fromCfg.Impersonate.Groups
		cfg.Impersonate.Extra = fromCfg.Impersonate.Extra
	}

	return rest.RESTClientFor(&cfg)
}
