package business

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

// Workload deals with fetching istio/kubernetes workloads related content and convert to kiali model
type WorkloadService struct {
	k8s kubernetes.IstioClientInterface
}

// ServiceList is the API handler to fetch the list of workloads in a given namespace
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

		cast := &models.WorkloadListItem{}
		cast.Parse(deployment)

		mPods := models.Pods{}
		mPods.Parse(dPods.Items)
		cast.IstioSidecar = mPods.HasIstioSideCar()

		(*workloadList).Workloads = append((*workloadList).Workloads, *cast)
	}
	return *workloadList, nil
}

// GetWorkload is the API handler to fetch details of an specific workload
func (in *WorkloadService) GetWorkload(namespace string, workloadName string) (*models.Workload, error) {
	deployment, err := in.k8s.GetDeploymentDetails(namespace, workloadName)
	if err != nil {
		return &models.Workload{}, err
	}

	model := &models.Workload{}
	model.Parse(deployment.Deployment)
	model.SetDetails(deployment)
	return model, nil
}
