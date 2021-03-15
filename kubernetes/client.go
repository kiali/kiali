package kubernetes

import (
	"encoding/base64"
	"errors"
	"net"
	"strings"

	osapps_v1 "github.com/openshift/api/apps/v1"
	osproject_v1 "github.com/openshift/api/project/v1"
	osroutes_v1 "github.com/openshift/api/route/v1"
	apps_v1 "k8s.io/api/apps/v1"
	auth_v1 "k8s.io/api/authorization/v1"
	batch_v1 "k8s.io/api/batch/v1"
	batch_v1beta1 "k8s.io/api/batch/v1beta1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/version"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd/api"
)

const RemoteSecretData = "/kiali-remote-secret/kiali"

var (
	emptyListOptions = meta_v1.ListOptions{}
	emptyGetOptions  = meta_v1.GetOptions{}
)

type PodLogs struct {
	Logs string `json:"logs,omitempty"`
}

type IstioClientInterface interface {
	CreateIstioObject(api, namespace, resourceType, json string) (IstioObject, error)
	DeleteIstioObject(api, namespace, resourceType, name string) error
	GetIstioObject(namespace, resourceType, name string) (IstioObject, error)
	GetIstioObjects(namespace, resourceType, labelSelector string) ([]IstioObject, error)
	UpdateIstioObject(api, namespace, resourceType, name, jsonPatch string) (IstioObject, error)
}

type K8SClientInterface interface {
	GetConfigMap(namespace, configName string) (*core_v1.ConfigMap, error)
	GetCronJobs(namespace string) ([]batch_v1beta1.CronJob, error)
	GetDeployment(namespace string, deploymentName string) (*apps_v1.Deployment, error)
	GetDeployments(namespace string) ([]apps_v1.Deployment, error)
	GetDeploymentsByLabel(namespace string, labelSelector string) ([]apps_v1.Deployment, error)
	GetDeploymentConfig(namespace string, deploymentconfigName string) (*osapps_v1.DeploymentConfig, error)
	GetDeploymentConfigs(namespace string) ([]osapps_v1.DeploymentConfig, error)
	GetEndpoints(namespace string, serviceName string) (*core_v1.Endpoints, error)
	GetJobs(namespace string) ([]batch_v1.Job, error)
	GetNamespace(namespace string) (*core_v1.Namespace, error)
	GetNamespaces(labelSelector string) ([]core_v1.Namespace, error)
	GetPod(namespace, name string) (*core_v1.Pod, error)
	GetPodLogs(namespace, name string, opts *core_v1.PodLogOptions) (*PodLogs, error)
	GetPodProxy(namespace, name, path string) ([]byte, error)
	GetPods(namespace, labelSelector string) ([]core_v1.Pod, error)
	GetReplicationControllers(namespace string) ([]core_v1.ReplicationController, error)
	GetReplicaSets(namespace string) ([]apps_v1.ReplicaSet, error)
	GetSecrets(namespace string, labelSelector string) ([]core_v1.Secret, error)
	GetSelfSubjectAccessReview(namespace, api, resourceType string, verbs []string) ([]*auth_v1.SelfSubjectAccessReview, error)
	GetService(namespace string, serviceName string) (*core_v1.Service, error)
	GetServices(namespace string, selectorLabels map[string]string) ([]core_v1.Service, error)
	GetServicesByLabels(namespace string, labelsSelector string) ([]core_v1.Service, error)
	GetStatefulSet(namespace string, statefulsetName string) (*apps_v1.StatefulSet, error)
	GetStatefulSets(namespace string) ([]apps_v1.StatefulSet, error)
	GetTokenSubject(authInfo *api.AuthInfo) (string, error)
	UpdateNamespace(namespace string, jsonPatch string) (*core_v1.Namespace, error)
	UpdateService(namespace string, serviceName string, jsonPatch string) error
	UpdateWorkload(namespace string, workloadName string, workloadType string, jsonPatch string) error
	GetProxyStatus() ([]*ProxyStatus, error)
	GetConfigDump(namespace, podName string) (*ConfigDump, error)
}

type OSClientInterface interface {
	GetProject(project string) (*osproject_v1.Project, error)
	GetProjects(labelSelector string) ([]osproject_v1.Project, error)
	GetRoute(namespace string, name string) (*osroutes_v1.Route, error)
	UpdateProject(project string, jsonPatch string) (*osproject_v1.Project, error)
}

// ClientInterface for mocks (only mocked function are necessary here)
type KubeClientInterface interface {
	GetServerVersion() (*version.Info, error)
	GetToken() string
	GetAuthInfo() *api.AuthInfo
	IsOpenShift() bool
	K8SClientInterface
	Iter8ClientInterface
	OSClientInterface
}

type MeshClientInterface interface {
	GetServerVersion() (*version.Info, error)
	GetToken() string
	GetAuthInfo() *api.AuthInfo
	IsOpenShift() bool
	IstioClientInterface
	Iter8ClientInterface
	OSClientInterface
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
