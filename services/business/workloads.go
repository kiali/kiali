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

	models := &models.WorkloadList{}
	models.Parse(namespace, deployments)
	return *models, nil
}
