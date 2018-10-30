package business

import (
	"regexp"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/internalmetrics"
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
	promtimer := internalmetrics.GetGoFunctionProcessingTimePrometheusTimer("business", "NamespaceService", "GetNamespaces")
	defer promtimer.ObserveDuration()

	namespaces := []models.Namespace{}
	// If we are running in OpenShift, we will use the project names since these are the list of accessible namespaces
	if in.hasProjects {
		projects, err := in.k8s.GetProjects()
		if err == nil {
			// Everything is good, return the projects we got from OpenShift / kube-project
			namespaces = models.CastProjectCollection(projects)
		}
	} else {
		services, err := in.k8s.GetNamespaces()
		if err != nil {
			return nil, err
		}

		namespaces = models.CastNamespaceCollection(services)
	}

	result := namespaces
	excludes := config.Get().Api.Namespaces.Exclude
	if len(excludes) > 0 {
		result = []models.Namespace{}
	NAMESPACES:
		for _, namespace := range namespaces {
			for _, excludePattern := range excludes {
				if match, _ := regexp.MatchString(excludePattern, namespace.Name); match {
					continue NAMESPACES
				}
			}
			result = append(result, namespace)
		}
	}

	return result, nil
}

// GetNamespace returns the definition of the specified namespace.
func (in *NamespaceService) GetNamespace(namespace string) (*models.Namespace, error) {
	if in.hasProjects {
		if project, err := in.k8s.GetProject(namespace); err == nil {
			result := models.CastProject(*project)
			return &result, nil
		}
	}

	ns, err := in.k8s.GetNamespace(namespace)
	if err != nil {
		return &models.Namespace{}, err
	}

	result := models.CastNamespace(*ns)
	return &result, nil
}
