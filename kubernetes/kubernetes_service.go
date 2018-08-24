package kubernetes

import (
	"fmt"
	"sync"

	"k8s.io/api/apps/v1beta1"
	autoscalingV1 "k8s.io/api/autoscaling/v1"
	"k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/config"
)

type servicesResponse struct {
	services *v1.ServiceList
	err      error
}

type serviceSliceResponse struct {
	services []v1.Service
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

// GetFullServices returns a list of services for a given namespace, along with its pods and deployments.
// It returns an error on any problem.
func (in *IstioClient) GetFullServices(namespace string) (*ServiceList, error) {
	var err error
	servicesChan, podsChan, deploymentsChan := make(chan servicesResponse), make(chan podsResponse), make(chan deploymentsResponse)

	go in.getServiceList(namespace, servicesChan)
	go in.getPodsList(namespace, podsChan)
	go in.getDeployments(namespace, deploymentsChan)

	servicesResponse := <-servicesChan
	podsResponse := <-podsChan
	deploymentsResponse := <-deploymentsChan

	services := &ServiceList{}
	services.Services = servicesResponse.services
	services.Pods = podsResponse.pods
	services.Deployments = deploymentsResponse.deployments

	if servicesResponse.err != nil {
		err = servicesResponse.err
	} else if podsResponse.err != nil {
		err = podsResponse.err
	} else {
		err = deploymentsResponse.err
	}

	return services, err
}

// GetNamespaceAppsDetails returns a map of apps details (services, deployments and pods) in the given namespace.
// The map key is the app label.
// Entities without app label are gathered under empty-string-key
// It returns an error on any problem.
func (in *IstioClient) GetNamespaceAppsDetails(namespace string) (NamespaceApps, error) {
	allEntities := make(NamespaceApps)
	var err error
	servicesChan, podsChan, deploymentsChan := make(chan servicesResponse), make(chan podsResponse), make(chan deploymentsResponse)
	appLabel := config.Get().IstioLabels.AppLabelName

	go in.getServiceList(namespace, servicesChan)
	go in.getPodsList(namespace, podsChan)
	go in.getDeployments(namespace, deploymentsChan)

	servicesResponse := <-servicesChan
	podsResponse := <-podsChan
	deploymentsResponse := <-deploymentsChan
	for _, service := range servicesResponse.services.Items {
		app := service.Labels[appLabel]
		if appEntities, ok := allEntities[app]; ok {
			appEntities.Services = append(appEntities.Services, service)
		} else {
			allEntities[app] = &AppDetails{
				app:      app,
				Services: []v1.Service{service},
			}
		}
	}
	for _, pod := range podsResponse.pods.Items {
		app := pod.Labels[appLabel]
		if appEntities, ok := allEntities[app]; ok {
			appEntities.Pods = append(appEntities.Pods, pod)
		} else {
			allEntities[app] = &AppDetails{
				app:  app,
				Pods: []v1.Pod{pod},
			}
		}
	}
	for _, depl := range deploymentsResponse.deployments.Items {
		app := depl.Labels[appLabel]
		if appEntities, ok := allEntities[app]; ok {
			appEntities.Deployments = append(appEntities.Deployments, depl)
		} else {
			allEntities[app] = &AppDetails{
				app:         app,
				Deployments: []v1beta1.Deployment{depl},
			}
		}
	}

	if servicesResponse.err != nil {
		err = servicesResponse.err
	} else if podsResponse.err != nil {
		err = podsResponse.err
	} else {
		err = deploymentsResponse.err
	}

	return allEntities, err
}

// TODO I think this method could fail as it is filtering services by app label
// TODO it should use getServicesByDeployment() instead
// GetAppDetails returns the app details (services, deployments and pods) for the input app label.
// It returns an error on any problem.
func (in *IstioClient) GetAppDetails(namespace, app string) (AppDetails, error) {
	var errSvc, errPods, errDepls error
	var wg sync.WaitGroup
	var services *v1.ServiceList
	var pods *v1.PodList
	var depls *v1beta1.DeploymentList
	appLabel := config.Get().IstioLabels.AppLabelName
	opts := meta_v1.ListOptions{LabelSelector: appLabel + "=" + app}
	wg.Add(3)

	go func() {
		defer wg.Done()
		services, errSvc = in.k8s.CoreV1().Services(namespace).List(opts)
	}()
	go func() {
		defer wg.Done()
		pods, errPods = in.k8s.CoreV1().Pods(namespace).List(opts)
	}()
	go func() {
		defer wg.Done()
		depls, errDepls = in.k8s.AppsV1beta1().Deployments(namespace).List(opts)
	}()

	wg.Wait()

	details := AppDetails{
		Services:    []v1.Service{},
		Pods:        []v1.Pod{},
		Deployments: []v1beta1.Deployment{},
	}
	if services != nil {
		details.Services = services.Items
	}
	if pods != nil {
		details.Pods = pods.Items
	}
	if depls != nil {
		details.Deployments = depls.Items
	}
	if errSvc != nil {
		return details, errSvc
	} else if errPods != nil {
		return details, errPods
	}
	return details, errDepls
}

// GetServices returns a list of services for a given namespace.
// It returns an error on any problem.
func (in *IstioClient) GetServices(namespace string) (*v1.ServiceList, error) {
	return in.k8s.CoreV1().Services(namespace).List(emptyListOptions)
}

// GetDeployments returns a list of deployments for a given namespace.
// It returns an error on any problem.
func (in *IstioClient) GetDeployments(namespace string) (*v1beta1.DeploymentList, error) {
	return in.k8s.AppsV1beta1().Deployments(namespace).List(emptyListOptions)
}

// GetDeploymentsBySelector returns a list of deployments for a given namespace and a set of labels.
// It returns an error on any problem.
func (in *IstioClient) GetDeploymentsBySelector(namespace string, labelSelector string) (*v1beta1.DeploymentList, error) {
	return in.k8s.AppsV1beta1().Deployments(namespace).List(meta_v1.ListOptions{LabelSelector: labelSelector})
}

// GetService returns the definition of a specific service.
// It returns an error on any problem.
func (in *IstioClient) GetService(namespace, serviceName string) (*v1.Service, error) {
	return in.k8s.CoreV1().Services(namespace).Get(serviceName, emptyGetOptions)
}

// GetDeployment returns the definition of a specific deployment.
// It returns an error on any problem.
func (in *IstioClient) GetDeployment(namespace, deploymentName string) (*v1beta1.Deployment, error) {
	return in.k8s.AppsV1beta1().Deployments(namespace).Get(deploymentName, emptyGetOptions)
}

// GetDeploymentSelector returns the selector of a deployment given a namespace and a deployment names.
// It returns an error on any problem.
// Return all labels listed as a human readable string separated by ','
func (in *IstioClient) GetDeploymentSelector(namespace, deploymentName string) (string, error) {
	deployment, err := in.GetDeployment(namespace, deploymentName)
	if err != nil {
		return "", err
	}
	selector, err := meta_v1.LabelSelectorAsMap(deployment.Spec.Selector)
	if err != nil {
		return "", err
	}
	return labels.FormatLabels(selector), nil
}

// GetPods returns the pods definitions for a given set of labels.
// It returns an error on any problem.
func (in *IstioClient) GetPods(namespace, labelSelector string) (*v1.PodList, error) {
	// An empty selector is ambiguous in the go client, could mean either "select all" or "select none"
	// Here we assume empty == select all
	// (see also https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#label-selectors)
	return in.k8s.CoreV1().Pods(namespace).List(meta_v1.ListOptions{LabelSelector: labelSelector})
}

// GetNamespacePods returns the pods definitions for a given namespace
// It returns an error on any problem.
func (in *IstioClient) GetNamespacePods(namespace string) (*v1.PodList, error) {
	return in.k8s.CoreV1().Pods(namespace).List(emptyListOptions)
}

// GetServiceDetails returns full details for a given service, consisting on service description, endpoints and pods.
// A service is defined by the namespace and the service name.
// It returns an error on any problem.
func (in *IstioClient) GetServiceDetails(namespace string, serviceName string) (*ServiceDetails, error) {
	endpointsChan := make(chan endpointsResponse)
	autoscalersChan := make(chan autoscalersResponse)
	podsChan := make(chan podsResponse)

	// Fetch the service first to ensure it exists, then fetch details in parallel
	service, err := in.GetService(namespace, serviceName)
	if err != nil {
		return nil, fmt.Errorf("service: %s", err.Error())
	}

	go func() {
		endpoints, err := in.k8s.CoreV1().Endpoints(namespace).Get(serviceName, emptyGetOptions)
		endpointsChan <- endpointsResponse{endpoints: endpoints, err: err}
	}()

	go func() {
		autoscalers, err := in.k8s.AutoscalingV1().HorizontalPodAutoscalers(namespace).List(emptyListOptions)
		autoscalersChan <- autoscalersResponse{autoscalers: autoscalers, err: err}
	}()

	go func() {
		pods, err := in.GetPods(namespace, labels.Set(service.Spec.Selector).String())
		podsChan <- podsResponse{pods: pods, err: err}
	}()

	// Last fetch can be performed in main thread. This list is potentially too large and will be narrowed down below
	deployments, err := in.k8s.AppsV1beta1().Deployments(namespace).List(emptyListOptions)
	if err != nil {
		return nil, fmt.Errorf("deployments: %s", err.Error())
	}

	serviceDetails := ServiceDetails{}

	serviceDetails.Service = service

	endpointsResponse := <-endpointsChan
	if endpointsResponse.err != nil {
		return nil, fmt.Errorf("endpoints: %s", endpointsResponse.err.Error())
	}
	serviceDetails.Endpoints = endpointsResponse.endpoints

	autoscalersResponse := <-autoscalersChan
	if autoscalersResponse.err != nil {
		return nil, fmt.Errorf("autoscalers: %s", autoscalersResponse.err.Error())
	}
	serviceDetails.Autoscalers = autoscalersResponse.autoscalers

	podsResponse := <-podsChan
	if podsResponse.err != nil {
		return nil, fmt.Errorf("pods: %s", podsResponse.err.Error())
	}
	serviceDetails.Pods = filterPodsForEndpoints(serviceDetails.Endpoints, podsResponse.pods)

	// Finally, after we get the pods we can narrow down the deployments list
	servicePods := FilterPodsForService(service, podsResponse.pods)
	serviceDetails.Deployments = &v1beta1.DeploymentList{
		Items: FilterDeploymentsForService(service, servicePods, deployments)}

	return &serviceDetails, nil
}

func (in *IstioClient) GetDeploymentDetails(namespace string, deploymentName string) (*DeploymentDetails, error) {
	podsChan, servicesChan := make(chan podsResponse), make(chan serviceSliceResponse)

	deployment, err := in.GetDeployment(namespace, deploymentName)
	if err != nil {
		return nil, fmt.Errorf("deployment: %s", err.Error())
	}

	deploymentDetails := &DeploymentDetails{}
	deploymentDetails.Deployment = deployment

	deploymentSelector, err := meta_v1.LabelSelectorAsMap(deployment.Spec.Selector)
	if err != nil {
		return deploymentDetails, nil
	}

	go in.getPods(namespace, deploymentSelector, podsChan)
	go in.getServicesByDeployment(namespace, deployment, servicesChan)

	podsResponse := <-podsChan
	if podsResponse.err != nil {
		return nil, fmt.Errorf("pods: %s", podsResponse.err.Error())
	}

	deploymentDetails.Pods = podsResponse.pods

	servicesResponse := <-servicesChan
	if servicesResponse.err != nil {
		return nil, fmt.Errorf("services: %s", servicesResponse.err.Error())
	}

	deploymentDetails.Services = servicesResponse.services

	return deploymentDetails, nil
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

func (in *IstioClient) getServiceList(namespace string, servicesChan chan servicesResponse) {
	services, err := in.k8s.CoreV1().Services(namespace).List(emptyListOptions)
	servicesChan <- servicesResponse{services: services, err: err}
}

func (in *IstioClient) getPodsList(namespace string, podsChan chan podsResponse) {
	pods, err := in.GetNamespacePods(namespace)
	podsChan <- podsResponse{pods: pods, err: err}
}

func (in *IstioClient) getDeployments(namespace string, deploymentsChan chan deploymentsResponse) {
	deployments, err := in.k8s.AppsV1beta1().Deployments(namespace).List(emptyListOptions)
	deploymentsChan <- deploymentsResponse{deployments: deployments, err: err}
}

func (in *IstioClient) getPods(namespace string, selector map[string]string, podsChan chan podsResponse) {
	selectorQuery := labels.Set(selector).String()
	pods, err := in.GetPods(namespace, selectorQuery)
	podsChan <- podsResponse{pods: pods, err: err}
}

func (in *IstioClient) getServicesByDeployment(namespace string, deployment *v1beta1.Deployment,
	serviceChan chan serviceSliceResponse) {

	services, err := in.GetServicesByDeploymentSelector(namespace, deployment)
	serviceChan <- serviceSliceResponse{services: services, err: err}
}

func (in *IstioClient) GetServicesByDeploymentSelector(namespace string, deployment *v1beta1.Deployment) ([]v1.Service, error) {
	var err error
	var allServices *v1.ServiceList
	var services []v1.Service

	allServices, err = in.k8s.CoreV1().Services(namespace).List(emptyListOptions)
	for _, svc := range allServices.Items {
		svcSelector := labels.Set(svc.Spec.Selector).AsSelector()
		if svcSelector.Matches(labels.Set(deployment.Labels)) {
			services = append(services, svc)
		}
	}

	return services, err
}

// GetSelectorAsString extracts the Selector used by a Deployment
// Returns a selector represented as a plain string
func GetSelectorAsString(deployment *v1beta1.Deployment) (string, error) {
	selector, err := meta_v1.LabelSelectorAsMap(deployment.Spec.Selector)
	if err != nil {
		return "", err
	}
	return labels.FormatLabels(selector), nil
}

// NewNotFound is a helper method to create a NotFound error similar as used by the kubernetes client.
// This method helps upper layers to send a explicit NotFound error without querying the backend.
func NewNotFound(name, group, resource string) error {
	return errors.NewNotFound(schema.GroupResource{Group: group, Resource: resource}, name)
}
