package kubernetes

import (
	"sync"

	"k8s.io/api/core/v1"

	"github.com/swift-sunshine/swscore/log"
)

type serviceResponse struct {
	service *v1.Service
	err     error
}

type endpointsResponse struct {
	endpoints *v1.Endpoints
	err       error
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
	serviceChan, endpointsChan := make(chan serviceResponse), make(chan endpointsResponse)

	go func() {
		service, err := in.k8s.CoreV1().Services(namespace).Get(serviceName, emptyGetOptions)
		serviceChan <- serviceResponse{service: service, err: err}
	}()

	go func() {
		endpoints, err := in.k8s.CoreV1().Endpoints(namespace).Get(serviceName, emptyGetOptions)
		endpointsChan <- endpointsResponse{endpoints: endpoints, err: err}
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

	podNames := make([]string, 0)
	for _, subset := range serviceDetails.Endpoints.Subsets {
		for _, address := range subset.Addresses {
			targetRef := address.TargetRef
			if targetRef != nil && targetRef.Kind == "Pod" {
				podNames = append(podNames, targetRef.Name)
			}
		}
	}

	podChan := make(chan podResponse, len(podNames))
	var wg sync.WaitGroup

	for _, podName := range podNames {
		wg.Add(1)
		go func(podName string) {
			defer wg.Done()
			log.Infof("podName %v", podName)
			pod, err := in.k8s.CoreV1().Pods(namespace).Get(podName, emptyGetOptions)
			podChan <- podResponse{pod: pod, err: err}
		}(podName)
	}

	go func() {
		wg.Wait()
		close(podChan)
	}()

	serviceDetails.Pods = make([]*v1.Pod, 0)
	for podResponse := range podChan {
		if podResponse.err != nil {
			return nil, podResponse.err
		}
		serviceDetails.Pods = append(serviceDetails.Pods, podResponse.pod)
	}

	return &serviceDetails, nil
}
