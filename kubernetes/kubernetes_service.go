package kubernetes

import (
	"github.com/kiali/swscore/config"

	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/core/v1"
)

const (
	DeploymentFilterLabelName = "app"
)

type serviceResponse struct {
	service *v1.Service
	err     error
}

type endpointsResponse struct {
	endpoints *v1.Endpoints
	err       error
}

type deploymentsResponse struct {
	deployments *v1beta1.DeploymentList
	err         error
}

type podResponse struct {
	pod *v1.Pod
	err error
}

// GetNamespaces returns a list of all namespaces of the cluster.
// It returns a list of all namespaces of the cluster.
// It returns an error on any problem.
func (in *IstioClient) GetNamespaces() (*v1.NamespaceList, error) {
	namespaces, err := in.k8s.CoreV1().Namespaces().List(emptyListOptions)
	if err != nil {
		return nil, err
	}

	return namespaces, nil
}

// GetServices returns a list of services for a given namespace.
// It returns an error on any problem.
func (in *IstioClient) GetServices(namespaceName string) (*v1.ServiceList, error) {
	services, err := in.k8s.CoreV1().Services(namespaceName).List(emptyListOptions)
	if err != nil {
		return nil, err
	}

	return services, nil
}

// GetServiceDetails returns full details for a given service, consisting on service description, endpoints and pods.
// A service is defined by the namespace and the service name.
// It returns an error on any problem.
func (in *IstioClient) GetServiceDetails(namespace string, serviceName string) (*ServiceDetails, error) {
	serviceChan := make(chan serviceResponse)
	endpointsChan := make(chan endpointsResponse)
	deploymentsChan := make(chan deploymentsResponse)

	go func() {
		service, err := in.k8s.CoreV1().Services(namespace).Get(serviceName, emptyGetOptions)
		serviceChan <- serviceResponse{service: service, err: err}
	}()

	go func() {
		endpoints, err := in.k8s.CoreV1().Endpoints(namespace).Get(serviceName, emptyGetOptions)
		endpointsChan <- endpointsResponse{endpoints: endpoints, err: err}
	}()

	go func() {
		deployments, err := in.k8s.AppsV1beta1().Deployments(namespace).List(emptyListOptions)
		deploymentsChan <- deploymentsResponse{deployments: filterByService(serviceName, deployments), err: err}
	}()

	serviceDetails := ServiceDetails{}

	serviceResponse := <-serviceChan
	if serviceResponse.err != nil {
		return nil, serviceResponse.err
	}
	serviceDetails.Service = serviceResponse.service

	endpointsResponse := <-endpointsChan
	if endpointsResponse.err != nil {
		return nil, endpointsResponse.err
	}
	serviceDetails.Endpoints = endpointsResponse.endpoints

	deploymentsResponse := <-deploymentsChan
	if deploymentsResponse.err != nil {
		return nil, deploymentsResponse.err
	}
	serviceDetails.Deployments = deploymentsResponse.deployments

	return &serviceDetails, nil
}

func filterByService(serviceName string, dl *v1beta1.DeploymentList) *v1beta1.DeploymentList {
	var deployments []v1beta1.Deployment

	for _, deployment := range dl.Items {
		if deployment.ObjectMeta.Labels != nil && deployment.ObjectMeta.Labels[config.Get().ServiceFilterLabelName] == serviceName {
			deployments = append(deployments, deployment)
		}
	}

	dl.Items = deployments
	return dl
}
