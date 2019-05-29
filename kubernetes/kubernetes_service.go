package kubernetes

import (
	"bytes"

	osapps_v1 "github.com/openshift/api/apps/v1"
	osproject_v1 "github.com/openshift/api/project/v1"
	osroutes_v1 "github.com/openshift/api/route/v1"
	apps_v1 "k8s.io/api/apps/v1"
	auth_v1 "k8s.io/api/authorization/v1"
	batch_v1 "k8s.io/api/batch/v1"
	batch_v1beta1 "k8s.io/api/batch/v1beta1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/version"
	"k8s.io/client-go/kubernetes/scheme"
)

// GetNamespace fetches and returns the specified namespace definition
// from the cluster
func (in *IstioClient) GetNamespace(namespace string) (*core_v1.Namespace, error) {
	ns, err := in.k8s.CoreV1().Namespaces().Get(namespace, emptyGetOptions)
	if err != nil {
		return &core_v1.Namespace{}, err
	}

	return ns, nil
}

// GetServerVersion fetches and returns information about the version Kubernetes that is running
func (in *IstioClient) GetServerVersion() (*version.Info, error) {
	return in.k8s.Discovery().ServerVersion()
}

// GetNamespaces returns a list of all namespaces of the cluster.
// It returns a list of all namespaces of the cluster.
// It returns an error on any problem.
func (in *IstioClient) GetNamespaces(labelSelector string) ([]core_v1.Namespace, error) {
	var listOptions meta_v1.ListOptions

	// Apply labelSelector filtering if specified
	if labelSelector != "" {
		listOptions = meta_v1.ListOptions{LabelSelector: labelSelector}
	} else {
		listOptions = emptyListOptions
	}

	namespaces, err := in.k8s.CoreV1().Namespaces().List(listOptions)
	if err != nil {
		return nil, err
	}

	return namespaces.Items, nil
}

// GetProject fetches and returns the definition of the project with
// the specified name by querying the cluster API. GetProject will fail
// if the underlying cluster is not Openshift.
func (in *IstioClient) GetProject(name string) (*osproject_v1.Project, error) {
	result := &osproject_v1.Project{}

	err := in.k8s.RESTClient().Get().Prefix("apis", "project.openshift.io", "v1", "projects", name).Do().Into(result)

	if err != nil {
		return nil, err
	}

	return result, nil
}

func (in *IstioClient) GetProjects(labelSelector string) ([]osproject_v1.Project, error) {
	result := &osproject_v1.ProjectList{}

	request := in.k8s.RESTClient().Get().Prefix("apis", "project.openshift.io", "v1", "projects")

	// Apply label selector filtering if specified
	if labelSelector != "" {
		request.Param("labelSelector", labelSelector)
	}

	err := request.Do().Into(result)

	if err != nil {
		return nil, err
	}

	return result.Items, nil
}

func (in *IstioClient) IsOpenShift() bool {
	if in.isOpenShift == nil {
		isOpenShift := false
		_, err := in.k8s.RESTClient().Get().AbsPath("/apis/project.openshift.io").Do().Raw()
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
func (in *IstioClient) GetServices(namespace string, selectorLabels map[string]string) ([]core_v1.Service, error) {
	var allServices []core_v1.Service
	var err error
	if in.k8sCache != nil {
		allServices, err = in.k8sCache.GetServices(namespace)
	} else {
		if allServicesList, err := in.k8s.CoreV1().Services(namespace).List(emptyListOptions); err == nil {
			allServices = allServicesList.Items
		}
	}
	if err != nil {
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

// GetDeployment returns the definition of a specific deployment.
// It returns an error on any problem.
func (in *IstioClient) GetDeployment(namespace, deploymentName string) (*apps_v1.Deployment, error) {
	if in.k8sCache != nil {
		return in.k8sCache.GetDeployment(namespace, deploymentName)
	}
	return in.k8s.AppsV1().Deployments(namespace).Get(deploymentName, emptyGetOptions)
}

// GetRoute returns the external URL endpoint of a specific route name.
// It returns an error on any problem.
func (in *IstioClient) GetRoute(namespace, name string) (*osroutes_v1.Route, error) {
	result := &osroutes_v1.Route{}
	err := in.k8s.RESTClient().Get().Prefix("apis", "route.openshift.io", "v1").Namespace(namespace).Resource("routes").SubResource(name).Do().Into(result)
	if err != nil {
		return nil, err
	}
	return result, nil
}

// GetDeployments returns an array of deployments for a given namespace.
// It returns an error on any problem.
func (in *IstioClient) GetDeployments(namespace string) ([]apps_v1.Deployment, error) {
	if in.k8sCache != nil {
		return in.k8sCache.GetDeployments(namespace)
	}
	if depList, err := in.k8s.AppsV1().Deployments(namespace).List(emptyListOptions); err == nil {
		return depList.Items, nil
	} else {
		return []apps_v1.Deployment{}, err
	}
}

// GetDeployments returns an array of deployments for a given namespace and a set of labels.
// An empty labelSelector will fetch all Deployments for a namespace.
// It returns an error on any problem.
func (in *IstioClient) GetDeploymentsByLabel(namespace string, labelSelector string) ([]apps_v1.Deployment, error) {
	if in.k8sCache != nil {
		return in.k8sCache.GetDeployments(namespace)
	}
	listOptions := meta_v1.ListOptions{LabelSelector: labelSelector}
	if depList, err := in.k8s.AppsV1().Deployments(namespace).List(listOptions); err == nil {
		return depList.Items, nil
	} else {
		return []apps_v1.Deployment{}, err
	}
}

// GetDeployment returns the definition of a specific deployment.
// It returns an error on any problem.
func (in *IstioClient) GetDeploymentConfig(namespace, deploymentconfigName string) (*osapps_v1.DeploymentConfig, error) {
	result := &osapps_v1.DeploymentConfig{}
	err := in.k8s.RESTClient().Get().Prefix("apis", "apps.openshift.io", "v1").Namespace(namespace).Resource("deploymentconfigs").SubResource(deploymentconfigName).Do().Into(result)
	if err != nil {
		return nil, err
	}
	return result, nil
}

// GetDeployments returns an array of deployments for a given namespace.
// An empty labelSelector will fetch all Deployments for a namespace.
// It returns an error on any problem.
func (in *IstioClient) GetDeploymentConfigs(namespace string) ([]osapps_v1.DeploymentConfig, error) {
	result := &osapps_v1.DeploymentConfigList{}
	err := in.k8s.RESTClient().Get().Prefix("apis", "apps.openshift.io", "v1").Namespace(namespace).Resource("deploymentconfigs").Do().Into(result)
	if err != nil {
		return nil, err
	}
	return result.Items, nil
}

func (in *IstioClient) GetReplicaSets(namespace string) ([]apps_v1.ReplicaSet, error) {
	if in.k8sCache != nil {
		return in.k8sCache.GetReplicaSets(namespace)
	}
	if rsList, err := in.k8s.AppsV1().ReplicaSets(namespace).List(emptyListOptions); err == nil {
		return rsList.Items, nil
	} else {
		return []apps_v1.ReplicaSet{}, err
	}
}

func (in *IstioClient) GetStatefulSet(namespace string, statefulsetName string) (*apps_v1.StatefulSet, error) {
	if in.k8sCache != nil {
		return in.k8sCache.GetStatefulSet(namespace, statefulsetName)
	}
	return in.k8s.AppsV1().StatefulSets(namespace).Get(statefulsetName, emptyGetOptions)
}

func (in *IstioClient) GetStatefulSets(namespace string) ([]apps_v1.StatefulSet, error) {
	if in.k8sCache != nil {
		return in.k8sCache.GetStatefulSets(namespace)
	}
	if ssList, err := in.k8s.AppsV1().StatefulSets(namespace).List(emptyListOptions); err == nil {
		return ssList.Items, nil
	} else {
		return []apps_v1.StatefulSet{}, err
	}
}

func (in *IstioClient) GetReplicationControllers(namespace string) ([]core_v1.ReplicationController, error) {
	if in.k8sCache != nil {
		return in.k8sCache.GetReplicationControllers(namespace)
	}
	if rcList, err := in.k8s.CoreV1().ReplicationControllers(namespace).List(emptyListOptions); err == nil {
		return rcList.Items, nil
	} else {
		return []core_v1.ReplicationController{}, err
	}
}

// GetService returns the definition of a specific service.
// It returns an error on any problem.
func (in *IstioClient) GetService(namespace, serviceName string) (*core_v1.Service, error) {
	if in.k8sCache != nil {
		return in.k8sCache.GetService(namespace, serviceName)
	}
	return in.k8s.CoreV1().Services(namespace).Get(serviceName, emptyGetOptions)
}

// GetEndpoints return the list of endpoint of a specific service.
// It returns an error on any problem.
func (in *IstioClient) GetEndpoints(namespace, serviceName string) (*core_v1.Endpoints, error) {
	if in.k8sCache != nil {
		return in.k8sCache.GetEndpoints(namespace, serviceName)
	}
	return in.k8s.CoreV1().Endpoints(namespace).Get(serviceName, emptyGetOptions)
}

// GetPods returns the pods definitions for a given set of labels.
// An empty labelSelector will fetch all pods found per a namespace.
// It returns an error on any problem.
func (in *IstioClient) GetPods(namespace, labelSelector string) ([]core_v1.Pod, error) {
	if in.k8sCache != nil {
		pods, err := in.k8sCache.GetPods(namespace)
		if err != nil {
			return []core_v1.Pod{}, err
		}
		if labelSelector != "" {
			selector, err := labels.Parse(labelSelector)
			if err != nil {
				return []core_v1.Pod{}, err
			}
			pods = FilterPodsForSelector(selector, pods)
		}
		return pods, nil
	}
	// An empty selector is ambiguous in the go client, could mean either "select all" or "select none"
	// Here we assume empty == select all
	// (see also https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#label-selectors)
	if pods, err := in.k8s.CoreV1().Pods(namespace).List(meta_v1.ListOptions{LabelSelector: labelSelector}); err == nil {
		return pods.Items, nil
	} else {
		return []core_v1.Pod{}, err
	}
}

// GetPod returns the pod definitions for a given pod name.
// It returns an error on any problem.
func (in *IstioClient) GetPod(namespace, name string) (*core_v1.Pod, error) {
	if in.k8sCache != nil {
		if pods, err := in.k8sCache.GetPods(namespace); err != nil {
			return nil, err
		} else {
			for _, pod := range pods {
				if name == pod.Name {
					return &pod, nil
				}
			}
			return nil, NewNotFound(name, "core/v1", "Pod")
		}
	}

	if pod, err := in.k8s.CoreV1().Pods(namespace).Get(name, emptyGetOptions); err != nil {
		return nil, err
	} else {
		return pod, nil
	}
}

// GetPod returns the pod definitions for a given pod name.
// It returns an error on any problem.
func (in *IstioClient) GetPodLogs(namespace, name string, opts *core_v1.PodLogOptions) (*PodLogs, error) {
	req := in.k8s.CoreV1().RESTClient().Get().Namespace(namespace).Name(name).Resource("pods").SubResource("log").VersionedParams(opts, scheme.ParameterCodec)

	readCloser, err := req.Stream()
	if err != nil {
		return nil, err
	}

	defer readCloser.Close()
	buf := new(bytes.Buffer)
	buf.ReadFrom(readCloser)
	return &PodLogs{Logs: buf.String()}, nil
}

func (in *IstioClient) GetCronJobs(namespace string) ([]batch_v1beta1.CronJob, error) {
	if in.k8sCache != nil {
		return in.k8sCache.GetCronJobs(namespace)
	}
	if cjList, err := in.k8s.BatchV1beta1().CronJobs(namespace).List(emptyListOptions); err == nil {
		return cjList.Items, nil
	} else {
		return []batch_v1beta1.CronJob{}, err
	}
}

func (in *IstioClient) GetJobs(namespace string) ([]batch_v1.Job, error) {
	if in.k8sCache != nil {
		return in.k8sCache.GetJobs(namespace)
	}
	if jList, err := in.k8s.BatchV1().Jobs(namespace).List(emptyListOptions); err == nil {
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
func (in *IstioClient) GetSelfSubjectAccessReview(namespace, api, resourceType string, verbs []string) ([]*auth_v1.SelfSubjectAccessReview, error) {
	calls := len(verbs)
	ch := make(chan *auth_v1.SelfSubjectAccessReview, calls)
	errChan := make(chan error)
	for _, v := range verbs {
		go func(verb string) {
			res, err := in.k8s.AuthorizationV1().SelfSubjectAccessReviews().Create(&auth_v1.SelfSubjectAccessReview{
				Spec: auth_v1.SelfSubjectAccessReviewSpec{
					ResourceAttributes: &auth_v1.ResourceAttributes{
						Namespace: namespace,
						Verb:      verb,
						Group:     api,
						Resource:  resourceType,
					},
				},
			})
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
