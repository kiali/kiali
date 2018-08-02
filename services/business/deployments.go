package business

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

// DeploymentService deals with fetching istio/kubernetes deployments related content and convert to kiali model
type DeploymentService struct {
	k8s kubernetes.IstioClientInterface
}

// ServiceList is the API handler to fetch the list of deployments in a given namespace
func (in *DeploymentService) GetDeploymentList(namespace string) (models.DeploymentList, error) {
	deployments, err := in.k8s.GetDeployments(namespace)
	if err != nil {
		return models.DeploymentList{}, err
	}

	models := &models.DeploymentList{}
	models.Parse(namespace, deployments)
	return *models, nil
}
