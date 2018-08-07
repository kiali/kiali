package business

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

// Workload deals with fetching istio/kubernetes deployments related content and convert to kiali model
type WorkloadService struct {
	k8s kubernetes.IstioClientInterface
}

// ServiceList is the API handler to fetch the list of deployments in a given namespace
func (in *WorkloadService) GetWorkloadList(namespace string) (models.WorkloadList, error) {
	deployments, err := in.k8s.GetDeployments(namespace)
	if err != nil {
		return models.WorkloadList{}, err
	}

	workloadList := &models.WorkloadList{}
	workloadList.Namespace.Name = namespace
	for _, deployment := range deployments.Items {
		selector, _ := in.k8s.GetDeploymentSelector(namespace, deployment.Name)
		dPods, _ := in.k8s.GetPods(namespace, selector)
		casted := &models.WorkloadOverview{}
		casted.Parse(deployment)
		mPods := models.Pods{}
		mPods.Parse(dPods.Items)
		casted.IstioSidecar = mPods.HasIstioSideCar()
		(*workloadList).Workloads = append((*workloadList).Workloads, *casted)
	}
	return *workloadList, nil
}
