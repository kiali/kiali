package business

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

// Namespace deals with fetching k8s namespaces / OpenShift projects and convert to kiali model
type NamespaceService struct {
	k8s         kubernetes.IstioClientInterface
	hasProjects bool
}

func NewNamespaceService(k8s kubernetes.IstioClientInterface) NamespaceService {

	var hasProjects bool

	if k8s != nil && k8s.IsOpenShift() {
		hasProjects = true
	} else {
		hasProjects = false
	}

	return NamespaceService{
		k8s:         k8s,
		hasProjects: hasProjects,
	}
}

// Returns a list of the given namespaces / projects
func (in *NamespaceService) GetNamespaces() ([]models.Namespace, error) {

	// If we are running in OpenShift, we will use the project names since these are the list of accessible namespaces
	if in.hasProjects {
		projects, err := in.k8s.GetProjects()
		if err == nil {
			// Everything is good, return the projects we got from OpenShift / kube-project
			return models.CastProjectCollection(projects), nil
		}
	}

	services, err := in.k8s.GetNamespaces()
	if err != nil {
		return nil, err
	}

	return models.CastNamespaceCollection(services), nil
}
