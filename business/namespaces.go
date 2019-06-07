package business

import (
	"regexp"

	osproject_v1 "github.com/openshift/api/project/v1"
	core_v1 "k8s.io/api/core/v1"

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
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "NamespaceService", "GetNamespaces")
	defer promtimer.ObserveNow(&err)

	labelSelector := config.Get().API.Namespaces.LabelSelector

	namespaces := []models.Namespace{}
	// If we are running in OpenShift, we will use the project names since these are the list of accessible namespaces
	if in.hasProjects {
		projects, err2 := in.k8s.GetProjects(labelSelector)
		if err2 == nil {
			// Everything is good, return the projects we got from OpenShift / kube-project
			namespaces = models.CastProjectCollection(projects)
		}
	} else {
		// if the accessible namespaces define a distinct list of namespaces, use only those.
		// If accessible namespaces include the special "**" (meaning all namespaces) ask k8s for them.
		// Note that "**" requires cluster role permission to list all namespaces.
		accessibleNamespaces := config.Get().Deployment.AccessibleNamespaces
		queryAllNamespaces := false
		for _, ans := range accessibleNamespaces {
			if ans == "**" {
				queryAllNamespaces = true
				break
			}
		}
		if queryAllNamespaces {
			nss, err := in.k8s.GetNamespaces(labelSelector)
			if err != nil {
				return nil, err
			}
			namespaces = models.CastNamespaceCollection(nss)
		} else {
			k8sNamespaces := make([]core_v1.Namespace, len(accessibleNamespaces))
			for i, ans := range accessibleNamespaces {
				k8sNs, err := in.k8s.GetNamespace(ans)
				if err != nil {
					return nil, err
				}
				k8sNamespaces[i] = *k8sNs
			}
			namespaces = models.CastNamespaceCollection(k8sNamespaces)
		}
	}

	result := namespaces
	excludes := config.Get().API.Namespaces.Exclude
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
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "NamespaceService", "GetNamespace")
	defer promtimer.ObserveNow(&err)

	if in.hasProjects {
		var project *osproject_v1.Project
		project, err = in.k8s.GetProject(namespace)
		if err != nil {
			return nil, err
		}
		result := models.CastProject(*project)
		return &result, nil
	} else {
		var ns *core_v1.Namespace
		ns, err = in.k8s.GetNamespace(namespace)
		if err != nil {
			return nil, err
		}
		result := models.CastNamespace(*ns)
		return &result, nil
	}
}
