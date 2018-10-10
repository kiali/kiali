package kubernetes

import (
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/apps/v1beta2"
	batch_v1 "k8s.io/api/batch/v1"
	batch_v1beta1 "k8s.io/api/batch/v1beta1"
	"k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"

	osappsv1 "github.com/openshift/api/apps/v1"
	osv1 "github.com/openshift/api/project/v1"
)

// GetNamespaces returns a list of all namespaces of the cluster.
// It returns a list of all namespaces of the cluster.
// It returns an error on any problem.
func (in *IstioClient) GetNamespaces() ([]v1.Namespace, error) {
	namespaces, err := in.k8s.CoreV1().Namespaces().List(emptyListOptions)
	if err != nil {
		return nil, err
	}

	return namespaces.Items, nil
}

func (in *IstioClient) GetProjects() ([]osv1.Project, error) {
	result := &osv1.ProjectList{}

	err := in.k8s.RESTClient().Get().Prefix("apis", "project.openshift.io", "v1", "projects").Do().Into(result)

	if err != nil {
		return nil, err
	}

	return result.Items, nil
}

func (in *IstioClient) IsOpenShift() bool {
	_, err := in.k8s.RESTClient().Get().AbsPath("/version/openshift").Do().Raw()
	if err != nil {
		return false
	}
	return true
}

// GetServices returns a list of services for a given namespace.
// If selectorLabels is defined the list of services is filtered for those that matches Services selector labels.
// It returns an error on any problem.
func (in *IstioClient) GetServices(namespace string, selectorLabels map[string]string) ([]v1.Service, error) {
	allServices, err := in.k8s.CoreV1().Services(namespace).List(emptyListOptions)
	if err != nil {
		return nil, err
	}
	if selectorLabels == nil {
		return allServices.Items, nil
	}
	var services []v1.Service
	for _, svc := range allServices.Items {
		svcSelector := labels.Set(svc.Spec.Selector).AsSelector()
		if svcSelector.Matches(labels.Set(selectorLabels)) {
			services = append(services, svc)
		}
	}
	return services, nil
}

// GetDeployment returns the definition of a specific deployment.
// It returns an error on any problem.
func (in *IstioClient) GetDeployment(namespace, deploymentName string) (*v1beta1.Deployment, error) {
	return in.k8s.AppsV1beta1().Deployments(namespace).Get(deploymentName, emptyGetOptions)
}

// GetDeployments returns an array of deployments for a given namespace and a set of labels.
// An empty labelSelector will fetch all Deployments for a namespace.
// It returns an error on any problem.
func (in *IstioClient) GetDeployments(namespace string) ([]v1beta1.Deployment, error) {
	dl, err := in.k8s.AppsV1beta1().Deployments(namespace).List(emptyListOptions)
	if err != nil {
		return nil, err
	}
	return dl.Items, nil
}

// GetDeployment returns the definition of a specific deployment.
// It returns an error on any problem.
func (in *IstioClient) GetDeploymentConfig(namespace, deploymentconfigName string) (*osappsv1.DeploymentConfig, error) {
	result := &osappsv1.DeploymentConfig{}
	err := in.k8s.RESTClient().Get().Prefix("apis", "apps.openshift.io", "v1").Namespace(namespace).Resource("deploymentconfigs").SubResource(deploymentconfigName).Do().Into(result)
	if err != nil {
		return nil, err
	}
	return result, nil
}

// GetDeployments returns an array of deployments for a given namespace and a set of labels.
// An empty labelSelector will fetch all Deployments for a namespace.
// It returns an error on any problem.
func (in *IstioClient) GetDeploymentConfigs(namespace string) ([]osappsv1.DeploymentConfig, error) {
	result := &osappsv1.DeploymentConfigList{}
	err := in.k8s.RESTClient().Get().Prefix("apis", "apps.openshift.io", "v1").Namespace(namespace).Resource("deploymentconfigs").Do().Into(result)
	if err != nil {
		return nil, err
	}
	return result.Items, nil
}

func (in *IstioClient) GetReplicaSet(namespace string, replicasetName string) (*v1beta2.ReplicaSet, error) {
	return in.k8s.AppsV1beta2().ReplicaSets(namespace).Get(replicasetName, emptyGetOptions)
}

func (in *IstioClient) GetReplicaSets(namespace string) ([]v1beta2.ReplicaSet, error) {
	rs, err := in.k8s.AppsV1beta2().ReplicaSets(namespace).List(emptyListOptions)
	if err != nil {
		return nil, err
	}
	return rs.Items, nil
}

func (in *IstioClient) GetStatefulSet(namespace string, statefulsetName string) (*v1beta2.StatefulSet, error) {
	return in.k8s.AppsV1beta2().StatefulSets(namespace).Get(statefulsetName, emptyGetOptions)
}

func (in *IstioClient) GetStatefulSets(namespace string) ([]v1beta2.StatefulSet, error) {
	sf, err := in.k8s.AppsV1beta2().StatefulSets(namespace).List(emptyListOptions)
	if err != nil {
		return nil, err
	}
	return sf.Items, nil
}

func (in *IstioClient) GetReplicationController(namespace string, replicasetName string) (*v1.ReplicationController, error) {
	return in.k8s.CoreV1().ReplicationControllers(namespace).Get(replicasetName, emptyGetOptions)
}

func (in *IstioClient) GetReplicationControllers(namespace string) ([]v1.ReplicationController, error) {
	rc, err := in.k8s.CoreV1().ReplicationControllers(namespace).List(emptyListOptions)
	if err != nil {
		return nil, err
	}
	return rc.Items, nil
}

// GetService returns the definition of a specific service.
// It returns an error on any problem.
func (in *IstioClient) GetService(namespace, serviceName string) (*v1.Service, error) {
	return in.k8s.CoreV1().Services(namespace).Get(serviceName, emptyGetOptions)
}

// GetEndpoints return the list of endpoint of a specific service.
// It returns an error on any problem.
func (in *IstioClient) GetEndpoints(namespace, serviceName string) (*v1.Endpoints, error) {
	return in.k8s.CoreV1().Endpoints(namespace).Get(serviceName, emptyGetOptions)
}

// GetPods returns the pods definitions for a given set of labels.
// An empty labelSelector will fetch all pods found per a namespace.
// It returns an error on any problem.
func (in *IstioClient) GetPods(namespace, labelSelector string) ([]v1.Pod, error) {
	// An empty selector is ambiguous in the go client, could mean either "select all" or "select none"
	// Here we assume empty == select all
	// (see also https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#label-selectors)
	pods, err := in.k8s.CoreV1().Pods(namespace).List(meta_v1.ListOptions{LabelSelector: labelSelector})
	if err != nil {
		return nil, err
	}
	return pods.Items, nil
}

// GetCronJob returns the definition of a specific CronJob.
// It returns an error on any problem.
func (in *IstioClient) GetCronJob(namespace, cronjobName string) (*batch_v1beta1.CronJob, error) {
	return in.k8s.BatchV1beta1().CronJobs(namespace).Get(cronjobName, emptyGetOptions)
}

func (in *IstioClient) GetCronJobs(namespace string) ([]batch_v1beta1.CronJob, error) {
	cj, err := in.k8s.BatchV1beta1().CronJobs(namespace).List(emptyListOptions)
	if err != nil {
		return nil, err
	}
	return cj.Items, nil
}

// GetJob returns the definition of a specific Job.
// It returns an error on any problem.
func (in *IstioClient) GetJob(namespace, jobName string) (*batch_v1.Job, error) {
	return in.k8s.BatchV1().Jobs(namespace).Get(jobName, emptyGetOptions)
}

func (in *IstioClient) GetJobs(namespace string) ([]batch_v1.Job, error) {
	js, err := in.k8s.BatchV1().Jobs(namespace).List(emptyListOptions)
	if err != nil {
		return nil, err
	}
	return js.Items, nil
}

// NewNotFound is a helper method to create a NotFound error similar as used by the kubernetes client.
// This method helps upper layers to send a explicit NotFound error without querying the backend.
func NewNotFound(name, group, resource string) error {
	return errors.NewNotFound(schema.GroupResource{Group: group, Resource: resource}, name)
}
