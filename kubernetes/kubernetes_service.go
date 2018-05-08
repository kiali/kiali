package kubernetes

import (
	"fmt"
	"strings"

	"github.com/kiali/kiali/config"
	"k8s.io/api/apps/v1beta1"
	autoscalingV1 "k8s.io/api/autoscaling/v1"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	DeploymentFilterLabelName = "app"
)

type servicesResponse struct {
	services *v1.ServiceList
	err      error
}

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

type autoscalersResponse struct {
	autoscalers *autoscalingV1.HorizontalPodAutoscalerList
	err         error
}

type podsResponse struct {
	pods *v1.PodList
	err  error
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
func (in *IstioClient) GetServices(namespaceName string) (*ServiceList, error) {
	var err error = nil
	servicesChan, deploymentsChan := make(chan servicesResponse), make(chan deploymentsResponse)

	go in.getServiceList(namespaceName, servicesChan)
	go in.getDeployments(namespaceName, deploymentsChan)

	servicesResponse := <-servicesChan
	deploymentsResponse := <-deploymentsChan

	services := &ServiceList{}
	services.Services = servicesResponse.services
	services.Deployments = deploymentsResponse.deployments

	if servicesResponse.err != nil {
		err = servicesResponse.err
	} else {
		err = deploymentsResponse.err
	}

	return services, err
}

// GetDeployments returns a list of deployments for a given namespace.
// It returns an error on any problem.
func (in *IstioClient) GetDeployments(namespaceName string) (*v1beta1.DeploymentList, error) {
	return in.k8s.AppsV1beta1().Deployments(namespaceName).List(emptyListOptions)
}

// GetDeployments returns a list of deployments for a given namespace.
// It returns an error on any problem.
func (in *IstioClient) GetService(namespaceName, serviceName string) (*v1.Service, error) {
	return in.k8s.CoreV1().Services(namespaceName).Get(serviceName, emptyGetOptions)
}

// GetServiceDetails returns full details for a given service, consisting on service description, endpoints and pods.
// A service is defined by the namespace and the service name.
// It returns an error on any problem.
func (in *IstioClient) GetServiceDetails(namespaceName string, serviceName string) (*ServiceDetails, error) {
	deploymentsChan := make(chan deploymentsResponse)
	endpointsChan := make(chan endpointsResponse)
	autoscalersChan := make(chan autoscalersResponse)
	podsChan := make(chan podsResponse)

	// Fetch the service first to ensure it exists, then fetch details in parallel
	service, err := in.GetService(namespaceName, serviceName)
	if err != nil {
		return nil, err
	}

	// selector used to get deployments and pods
	selector := selectorToString(service.Spec.Selector)

	go func() {
		deployments, err := in.k8s.AppsV1beta1().Deployments(namespaceName).List(meta_v1.ListOptions{LabelSelector: selector})
		deploymentsChan <- deploymentsResponse{deployments: deployments, err: err}
	}()

	go func() {
		endpoints, err := in.k8s.CoreV1().Endpoints(namespaceName).Get(serviceName, emptyGetOptions)
		endpointsChan <- endpointsResponse{endpoints: endpoints, err: err}
	}()

	go func() {
		autoscalers, err := in.k8s.AutoscalingV1().HorizontalPodAutoscalers(namespaceName).List(emptyListOptions)
		autoscalersChan <- autoscalersResponse{autoscalers: autoscalers, err: err}
	}()

	go func() {
		pods, err := in.GetServicePods(namespaceName, "", "", selector)
		podsChan <- podsResponse{pods: pods, err: err}
	}()

	serviceDetails := ServiceDetails{}

	serviceDetails.Service = service

	deploymentsResponse := <-deploymentsChan
	if deploymentsResponse.err != nil {
		return nil, deploymentsResponse.err
	}
	serviceDetails.Deployments = deploymentsResponse.deployments

	endpointsResponse := <-endpointsChan
	if endpointsResponse.err != nil {
		return nil, endpointsResponse.err
	}
	serviceDetails.Endpoints = endpointsResponse.endpoints

	autoscalersResponse := <-autoscalersChan
	if autoscalersResponse.err != nil {
		return nil, autoscalersResponse.err
	}
	serviceDetails.Autoscalers = autoscalersResponse.autoscalers

	podsResponse := <-podsChan
	if podsResponse.err != nil {
		return nil, podsResponse.err
	}
	serviceDetails.Pods = podsResponse.pods

	return &serviceDetails, nil
}

// GetServicePods returns the list of pods associated to a given service. namespaceName is required.
// If selector is supplied serviceName and serviceVersion are ignored.  If selector is not supplied
// ("") then a default selector is generated using the canonical labels for serviceName (required)
// and serviceVersion (optional).  An error is returned on any problem.
func (in *IstioClient) GetServicePods(namespaceName, serviceName, serviceVersion, selector string) (*v1.PodList, error) {
	if "" == selector {
		var labelSelectors []string

		cfg := config.Get()
		labelSelectors = append(labelSelectors, fmt.Sprintf("%v=%v", cfg.ServiceFilterLabelName, serviceName))
		if "" != serviceVersion {
			labelSelectors = append(labelSelectors, fmt.Sprintf("%v=%v", cfg.VersionFilterLabelName, serviceVersion))
		}
		selector = strings.Join(labelSelectors, ",")
	}

	podList, err := in.k8s.CoreV1().Pods(namespaceName).List(meta_v1.ListOptions{
		LabelSelector: selector,
	})
	if err != nil {
		return nil, err
	}

	return podList, nil
}

func filterAutoscalersByDeployments(deploymentNames []string, al *autoscalingV1.HorizontalPodAutoscalerList) *autoscalingV1.HorizontalPodAutoscalerList {
	autoscalers := make([]autoscalingV1.HorizontalPodAutoscaler, 0, len(al.Items))

	for _, autoscaler := range al.Items {
		for _, deploymentName := range deploymentNames {
			if deploymentName == autoscaler.Spec.ScaleTargetRef.Name {
				autoscalers = append(autoscalers, autoscaler)
			}
		}
	}

	al.Items = autoscalers
	return al
}

func getDeploymentNames(deployments *v1beta1.DeploymentList) []string {
	deploymentNames := make([]string, len(deployments.Items))
	for _, deployment := range deployments.Items {
		deploymentNames = append(deploymentNames, deployment.Name)
	}

	return deploymentNames
}

func (in *IstioClient) getServiceList(namespaceName string, servicesChan chan servicesResponse) {
	services, err := in.k8s.CoreV1().Services(namespaceName).List(emptyListOptions)
	servicesChan <- servicesResponse{services: services, err: err}
}

func (in *IstioClient) getDeployments(namespaceName string, deploymentsChan chan deploymentsResponse) {
	deployments, err := in.k8s.AppsV1beta1().Deployments(namespaceName).List(emptyListOptions)
	deploymentsChan <- deploymentsResponse{deployments: deployments, err: err}
}
