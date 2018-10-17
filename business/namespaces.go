package business

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

// Namespace deals with fetching k8s namespaces / OpenShift projects and convert to kiali model
type NamespaceService struct {
	hasProjects bool
	userClient  kubernetes.UserClientInterface
}

func NewNamespaceService(userClient kubernetes.UserClientInterface) NamespaceService {
	var hasProjects bool

	// TODO: figure out a better way to handle endpoints that don't need authentication
	client, _ := userClient.NewClient("")
	if client != nil && client.IsOpenShift() {
		hasProjects = true
	} else {
		hasProjects = false
	}

	return NamespaceService{
		hasProjects: hasProjects,
		userClient:  userClient,
	}
}

// Returns a list of the given namespaces / projects
func (in *NamespaceService) GetNamespaces(userToken string) ([]models.Namespace, error) {

	client, err := in.userClient.NewClient(userToken)
	if err != nil {
		return nil, err
	}

	// If we are running in OpenShift, we will use the project names since these are the list of accessible namespaces
	if in.hasProjects {
		projects, err := client.GetProjects()
		if err == nil {
			// Everything is good, return the projects we got from OpenShift / kube-project
			return models.CastProjectCollection(projects), nil
		}
	}

	namespaces, err := client.GetNamespaces()
	if err != nil {
		return nil, err
	}

	return models.CastNamespaceCollection(namespaces), nil
}
