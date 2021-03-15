package kubernetes

import (
	"bytes"
	"context"
	goerrors "errors"
	"fmt"

	"github.com/kiali/kiali/log"
	osapps_v1 "github.com/openshift/api/apps/v1"
	osproject_v1 "github.com/openshift/api/project/v1"
	osroutes_v1 "github.com/openshift/api/route/v1"
	apps_v1 "k8s.io/api/apps/v1"
	v1 "k8s.io/api/authentication/v1"
	auth_v1 "k8s.io/api/authorization/v1"
	batch_v1 "k8s.io/api/batch/v1"
	batch_v1beta1 "k8s.io/api/batch/v1beta1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/version"
	kube "k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd/api"
)

// K8SClient is the client struct for Kubernetes and Istio APIs
// It hides the way it queries each API
type KubeK8SClient struct {
	KubeClientInterface
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
func (client *KubeK8SClient) GetK8sApi() *kube.Clientset {
	return client.k8s
}

// GetToken returns the BearerToken used from the config
func (client *KubeK8SClient) GetToken() string {
	return client.token
}

// NewClientFromConfig creates a new client to the Kubernetes and Istio APIs.
// It takes the assumption that Istio is deployed into the cluster.
// It hides the access to Kubernetes/Openshift credentials.
// It hides the low level use of the API of Kubernetes and Istio, it should be considered as an implementation detail.
// It returns an error on any problem.
func NewKubeClientFromConfig(config *rest.Config) (*KubeK8SClient, error) {
	client := KubeK8SClient{
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

// GetConfigMap fetches and returns the specified ConfigMap definition
// from the cluster
func (in *KubeK8SClient) GetConfigMap(namespace, configName string) (*core_v1.ConfigMap, error) {
	configMap, err := in.k8s.CoreV1().ConfigMaps(namespace).Get(in.ctx, configName, emptyGetOptions)
	if err != nil {
		return &core_v1.ConfigMap{}, err
	}

	return configMap, nil
}

// GetNamespace fetches and returns the specified namespace definition
// from the cluster
func (in *KubeK8SClient) GetNamespace(namespace string) (*core_v1.Namespace, error) {
	ns, err := in.k8s.CoreV1().Namespaces().Get(in.ctx, namespace, emptyGetOptions)
	if err != nil {
		return &core_v1.Namespace{}, err
	}

	return ns, nil
}

// GetServerVersion fetches and returns information about the version Kubernetes that is running
func (in *KubeK8SClient) GetServerVersion() (*version.Info, error) {
	return in.k8s.Discovery().ServerVersion()
}

// GetNamespaces returns a list of all namespaces of the cluster.
// It returns a list of all namespaces of the cluster.
// It returns an error on any problem.
func (in *KubeK8SClient) GetNamespaces(labelSelector string) ([]core_v1.Namespace, error) {
	var listOptions meta_v1.ListOptions

	// Apply labelSelector filtering if specified
	if labelSelector != "" {
		listOptions = meta_v1.ListOptions{LabelSelector: labelSelector}
	} else {
		listOptions = emptyListOptions
	}

	namespaces, err := in.k8s.CoreV1().Namespaces().List(in.ctx, listOptions)
	if err != nil {
		return nil, err
	}

	return namespaces.Items, nil
}

// GetProject fetches and returns the definition of the project with
// the specified name by querying the cluster API. GetProject will fail
// if the underlying cluster is not Openshift.
func (in *KubeK8SClient) GetProject(name string) (*osproject_v1.Project, error) {
	result := &osproject_v1.Project{}

	err := in.k8s.RESTClient().Get().Prefix("apis", "project.openshift.io", "v1", "projects", name).Do(in.ctx).Into(result)

	if err != nil {
		return nil, err
	}

	return result, nil
}

func (in *KubeK8SClient) GetProjects(labelSelector string) ([]osproject_v1.Project, error) {
	result := &osproject_v1.ProjectList{}

	request := in.k8s.RESTClient().Get().Prefix("apis", "project.openshift.io", "v1", "projects")

	// Apply label selector filtering if specified
	if labelSelector != "" {
		request.Param("labelSelector", labelSelector)
	}

	err := request.Do(in.ctx).Into(result)

	if err != nil {
		return nil, err
	}

	return result.Items, nil
}

func (in *KubeK8SClient) IsOpenShift() bool {
	if in.isOpenShift == nil {
		isOpenShift := false
		_, err := in.k8s.RESTClient().Get().AbsPath("/apis/project.openshift.io").Do(in.ctx).Raw()
		if err == nil {
			isOpenShift = true
		}
		in.isOpenShift = &isOpenShift
	}
	return *in.isOpenShift
}

// GetServices returns a list of services for a given namespace.
// If selectorLabels is defined the list of services is filtered for those that matches Services selector labels.
// It returns an error on any problem.
// NOTE: The selectorLabels argument is NOT to find services matching the given labels. Assume selectorLabels are
// the labels of a Deployment. If this imaginary Deployment is selected by the Service (because of its Selector), then
// that service is returned; else it's omitted.
func (in *KubeK8SClient) GetServices(namespace string, selectorLabels map[string]string) ([]core_v1.Service, error) {
	var allServices []core_v1.Service

	if allServicesList, err := in.k8s.CoreV1().Services(namespace).List(in.ctx, emptyListOptions); err == nil {
		allServices = allServicesList.Items
	} else {
		return []core_v1.Service{}, err
	}

	if selectorLabels == nil {
		return allServices, nil
	}
	var services []core_v1.Service
	for _, svc := range allServices {
		svcSelector := labels.Set(svc.Spec.Selector).AsSelector()
		if !svcSelector.Empty() && svcSelector.Matches(labels.Set(selectorLabels)) {
			services = append(services, svc)
		}
	}
	return services, nil
}

func (in *KubeK8SClient) GetServicesByLabels(namespace string, labelsSelector string) ([]core_v1.Service, error) {
	selector := meta_v1.ListOptions{LabelSelector: labelsSelector}
	if allServicesList, err := in.k8s.CoreV1().Services(namespace).List(in.ctx, selector); err == nil {
		return allServicesList.Items, nil
	} else {
		return []core_v1.Service{}, err
	}
}

// GetDeployment returns the definition of a specific deployment.
// It returns an error on any problem.
func (in *KubeK8SClient) GetDeployment(namespace, deploymentName string) (*apps_v1.Deployment, error) {
	return in.k8s.AppsV1().Deployments(namespace).Get(in.ctx, deploymentName, emptyGetOptions)
}

// GetRoute returns the external URL endpoint of a specific route name.
// It returns an error on any problem.
func (in *KubeK8SClient) GetRoute(namespace, name string) (*osroutes_v1.Route, error) {
	result := &osroutes_v1.Route{}
	err := in.k8s.RESTClient().Get().Prefix("apis", "route.openshift.io", "v1").Namespace(namespace).Resource("routes").SubResource(name).Do(in.ctx).Into(result)
	if err != nil {
		return nil, err
	}
	return result, nil
}

// GetDeployments returns an array of deployments for a given namespace.
// It returns an error on any problem.
func (in *KubeK8SClient) GetDeployments(namespace string) ([]apps_v1.Deployment, error) {
	if depList, err := in.k8s.AppsV1().Deployments(namespace).List(in.ctx, emptyListOptions); err == nil {
		return depList.Items, nil
	} else {
		return []apps_v1.Deployment{}, err
	}
}

// GetDeployments returns an array of deployments for a given namespace and a set of labels.
// An empty labelSelector will fetch all Deployments for a namespace.
// It returns an error on any problem.
func (in *KubeK8SClient) GetDeploymentsByLabel(namespace string, labelSelector string) ([]apps_v1.Deployment, error) {
	listOptions := meta_v1.ListOptions{LabelSelector: labelSelector}
	if depList, err := in.k8s.AppsV1().Deployments(namespace).List(in.ctx, listOptions); err == nil {
		return depList.Items, nil
	} else {
		return []apps_v1.Deployment{}, err
	}
}

// GetDeployment returns the definition of a specific deployment.
// It returns an error on any problem.
func (in *KubeK8SClient) GetDeploymentConfig(namespace, deploymentconfigName string) (*osapps_v1.DeploymentConfig, error) {
	result := &osapps_v1.DeploymentConfig{}
	err := in.k8s.RESTClient().Get().Prefix("apis", "apps.openshift.io", "v1").Namespace(namespace).Resource("deploymentconfigs").SubResource(deploymentconfigName).Do(in.ctx).Into(result)
	if err != nil {
		return nil, err
	}
	return result, nil
}

// GetDeployments returns an array of deployments for a given namespace.
// An empty labelSelector will fetch all Deployments for a namespace.
// It returns an error on any problem.
func (in *KubeK8SClient) GetDeploymentConfigs(namespace string) ([]osapps_v1.DeploymentConfig, error) {
	result := &osapps_v1.DeploymentConfigList{}
	err := in.k8s.RESTClient().Get().Prefix("apis", "apps.openshift.io", "v1").Namespace(namespace).Resource("deploymentconfigs").Do(in.ctx).Into(result)
	if err != nil {
		return nil, err
	}
	return result.Items, nil
}

func (in *KubeK8SClient) GetReplicaSets(namespace string) ([]apps_v1.ReplicaSet, error) {
	if rsList, err := in.k8s.AppsV1().ReplicaSets(namespace).List(in.ctx, emptyListOptions); err == nil {
		return rsList.Items, nil
	} else {
		return []apps_v1.ReplicaSet{}, err
	}
}

func (in *KubeK8SClient) GetStatefulSet(namespace string, statefulsetName string) (*apps_v1.StatefulSet, error) {
	return in.k8s.AppsV1().StatefulSets(namespace).Get(in.ctx, statefulsetName, emptyGetOptions)
}

func (in *KubeK8SClient) GetStatefulSets(namespace string) ([]apps_v1.StatefulSet, error) {
	if ssList, err := in.k8s.AppsV1().StatefulSets(namespace).List(in.ctx, emptyListOptions); err == nil {
		return ssList.Items, nil
	} else {
		return []apps_v1.StatefulSet{}, err
	}
}

func (in *KubeK8SClient) GetReplicationControllers(namespace string) ([]core_v1.ReplicationController, error) {
	if rcList, err := in.k8s.CoreV1().ReplicationControllers(namespace).List(in.ctx, emptyListOptions); err == nil {
		return rcList.Items, nil
	} else {
		return []core_v1.ReplicationController{}, err
	}
}

// GetService returns the definition of a specific service.
// It returns an error on any problem.
func (in *KubeK8SClient) GetService(namespace, serviceName string) (*core_v1.Service, error) {
	return in.k8s.CoreV1().Services(namespace).Get(in.ctx, serviceName, emptyGetOptions)
}

// GetEndpoints return the list of endpoint of a specific service.
// It returns an error on any problem.
func (in *KubeK8SClient) GetEndpoints(namespace, serviceName string) (*core_v1.Endpoints, error) {
	return in.k8s.CoreV1().Endpoints(namespace).Get(in.ctx, serviceName, emptyGetOptions)
}

// GetPods returns the pods definitions for a given set of labels.
// An empty labelSelector will fetch all pods found per a namespace.
// It returns an error on any problem.
func (in *KubeK8SClient) GetPods(namespace, labelSelector string) ([]core_v1.Pod, error) {
	// An empty selector is ambiguous in the go client, could mean either "select all" or "select none"
	// Here we assume empty == select all
	// (see also https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#label-selectors)
	if pods, err := in.k8s.CoreV1().Pods(namespace).List(in.ctx, meta_v1.ListOptions{LabelSelector: labelSelector}); err == nil {
		return pods.Items, nil
	} else {
		return []core_v1.Pod{}, err
	}
}

// GetPod returns the pod definitions for a given pod name.
// It returns an error on any problem.
func (in *KubeK8SClient) GetPod(namespace, name string) (*core_v1.Pod, error) {
	if pod, err := in.k8s.CoreV1().Pods(namespace).Get(in.ctx, name, emptyGetOptions); err != nil {
		return nil, err
	} else {
		return pod, nil
	}
}

// GetPod returns the pod definitions for a given pod name.
// It returns an error on any problem.
func (in *KubeK8SClient) GetPodLogs(namespace, name string, opts *core_v1.PodLogOptions) (*PodLogs, error) {
	req := in.k8s.CoreV1().RESTClient().Get().Namespace(namespace).Name(name).Resource("pods").SubResource("log").VersionedParams(opts, scheme.ParameterCodec)

	readCloser, err := req.Stream(in.ctx)
	if err != nil {
		return nil, err
	}

	defer readCloser.Close()
	buf := new(bytes.Buffer)
	_, err = buf.ReadFrom(readCloser)
	if err != nil {
		return nil, err
	}

	return &PodLogs{Logs: buf.String()}, nil
}

func (in *KubeK8SClient) GetPodProxy(namespace, name, path string) ([]byte, error) {
	return in.k8s.CoreV1().RESTClient().Get().
		Timeout(GetTimeout()).
		Namespace(namespace).
		Resource("pods").
		SubResource("proxy").
		Name(name).
		Suffix(path).
		DoRaw(in.ctx)
}

func (in *KubeK8SClient) GetCronJobs(namespace string) ([]batch_v1beta1.CronJob, error) {
	if cjList, err := in.k8s.BatchV1beta1().CronJobs(namespace).List(in.ctx, emptyListOptions); err == nil {
		return cjList.Items, nil
	} else {
		return []batch_v1beta1.CronJob{}, err
	}
}

func (in *KubeK8SClient) GetJobs(namespace string) ([]batch_v1.Job, error) {
	if jList, err := in.k8s.BatchV1().Jobs(namespace).List(in.ctx, emptyListOptions); err == nil {
		return jList.Items, nil
	} else {
		return []batch_v1.Job{}, err
	}
}

// NewNotFound is a helper method to create a NotFound error similar as used by the kubernetes client.
// This method helps upper layers to send a explicit NotFound error without querying the backend.
func NewNotFound(name, group, resource string) error {
	return errors.NewNotFound(schema.GroupResource{Group: group, Resource: resource}, name)
}

// GetSelfSubjectAccessReview provides information on Kiali permissions
func (in *KubeK8SClient) GetSelfSubjectAccessReview(namespace, api, resourceType string, verbs []string) ([]*auth_v1.SelfSubjectAccessReview, error) {
	calls := len(verbs)
	ch := make(chan *auth_v1.SelfSubjectAccessReview, calls)
	errChan := make(chan error)
	for _, v := range verbs {
		go func(verb string) {
			res, err := in.k8s.AuthorizationV1().SelfSubjectAccessReviews().Create(in.ctx, &auth_v1.SelfSubjectAccessReview{
				Spec: auth_v1.SelfSubjectAccessReviewSpec{
					ResourceAttributes: &auth_v1.ResourceAttributes{
						Namespace: namespace,
						Verb:      verb,
						Group:     api,
						Resource:  resourceType,
					},
				},
			}, meta_v1.CreateOptions{})
			if err != nil {
				errChan <- err
			} else {
				ch <- res
			}
		}(v)
	}

	var err error
	result := []*auth_v1.SelfSubjectAccessReview{}
	for count := 0; count < calls; count++ {
		select {
		case res := <-ch:
			result = append(result, res)
		case err = <-errChan:
			// No op
		}
	}
	return result, err
}

func (in *KubeK8SClient) UpdateWorkload(namespace string, workloadName string, workloadType string, jsonPatch string) error {
	emptyPatchOptions := meta_v1.PatchOptions{}
	bytePatch := []byte(jsonPatch)
	var err error
	switch workloadType {
	case DeploymentType:
		_, err = in.k8s.AppsV1().Deployments(namespace).Patch(in.ctx, workloadName, types.MergePatchType, bytePatch, emptyPatchOptions)
	case ReplicaSetType:
		_, err = in.k8s.AppsV1().ReplicaSets(namespace).Patch(in.ctx, workloadName, types.MergePatchType, bytePatch, emptyPatchOptions)
	case ReplicationControllerType:
		_, err = in.k8s.CoreV1().ReplicationControllers(namespace).Patch(in.ctx, workloadName, types.MergePatchType, bytePatch, emptyPatchOptions)
	case DeploymentConfigType:
		if in.IsOpenShift() {
			result := &osapps_v1.DeploymentConfigList{}
			err = in.k8s.RESTClient().Patch(types.MergePatchType).Prefix("apis", "apps.openshift.io", "v1").Namespace(namespace).Resource("deploymentconfigs").SubResource(workloadName).Body(bytePatch).Do(in.ctx).Into(result)
		}
	case StatefulSetType:
		_, err = in.k8s.AppsV1().StatefulSets(namespace).Patch(in.ctx, workloadName, types.MergePatchType, bytePatch, emptyPatchOptions)
	case JobType:
		_, err = in.k8s.BatchV1().Jobs(namespace).Patch(in.ctx, workloadName, types.MergePatchType, bytePatch, emptyPatchOptions)
	case CronJobType:
		_, err = in.k8s.BatchV1beta1().CronJobs(namespace).Patch(in.ctx, workloadName, types.MergePatchType, bytePatch, emptyPatchOptions)
	case PodType:
		_, err = in.k8s.CoreV1().Pods(namespace).Patch(in.ctx, workloadName, types.MergePatchType, bytePatch, emptyPatchOptions)
	default:
		err = fmt.Errorf("Workload type %s not found", workloadType)
	}
	return err
}

func (in *KubeK8SClient) UpdateService(namespace string, serviceName string, jsonPatch string) error {
	emptyPatchOptions := meta_v1.PatchOptions{}
	bytePatch := []byte(jsonPatch)
	var err error
	_, err = in.k8s.CoreV1().Services(namespace).Patch(in.ctx, serviceName, types.MergePatchType, bytePatch, emptyPatchOptions)
	return err
}

func (in *KubeK8SClient) UpdateNamespace(namespace string, jsonPatch string) (*core_v1.Namespace, error) {
	emptyPatchOptions := meta_v1.PatchOptions{}
	bytePatch := []byte(jsonPatch)
	ns, err := in.k8s.CoreV1().Namespaces().Patch(in.ctx, namespace, types.MergePatchType, bytePatch, emptyPatchOptions)
	if err != nil {
		return &core_v1.Namespace{}, err
	}

	return ns, nil
}

func (in *KubeK8SClient) UpdateProject(name string, jsonPatch string) (*osproject_v1.Project, error) {
	result := &osproject_v1.Project{}
	bytePatch := []byte(jsonPatch)
	err := in.k8s.RESTClient().Patch(types.MergePatchType).Prefix("apis", "project.openshift.io", "v1", "projects", name).Body(bytePatch).Do(in.ctx).Into(result)
	if err != nil {
		return nil, err
	}

	return result, nil
}

// GetTokenSubject returns the subject of the authInfo using
// the TokenReview api
func (in *KubeK8SClient) GetTokenSubject(authInfo *api.AuthInfo) (string, error) {
	tokenReview := &v1.TokenReview{}
	tokenReview.Spec.Token = authInfo.Token

	result, err := in.k8s.AuthenticationV1().TokenReviews().Create(in.ctx, tokenReview, meta_v1.CreateOptions{})

	if err != nil {
		return "", err
	} else if result.Status.Error != "" {
		return "", goerrors.New(result.Status.Error)
	} else {
		return result.Status.User.Username, nil
	}

}
