package business

import (
	"regexp"

	osproject_v1 "github.com/openshift/api/project/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// Namespace deals with fetching k8s namespaces / OpenShift projects and convert to kiali model
type NamespaceService struct {
	k8s                    kubernetes.ClientInterface
	hasProjects            bool
	isAccessibleNamespaces map[string]bool
}

type AccessibleNamespaceError struct {
	msg string
}

func (in *AccessibleNamespaceError) Error() string {
	return in.msg
}

func IsAccessibleError(err error) bool {
	_, isAccessibleError := err.(*AccessibleNamespaceError)
	return isAccessibleError
}

func NewNamespaceService(k8s kubernetes.ClientInterface) NamespaceService {

	var hasProjects bool

	if k8s != nil && k8s.IsOpenShift() {
		hasProjects = true
	} else {
		hasProjects = false
	}

	ans := config.Get().Deployment.AccessibleNamespaces
	isAccessibleNamespaces := make(map[string]bool, len(ans))
	for _, ns := range ans {
		isAccessibleNamespaces[ns] = true
	}

	return NamespaceService{
		k8s:                    k8s,
		hasProjects:            hasProjects,
		isAccessibleNamespaces: isAccessibleNamespaces,
	}
}

// Returns a list of the given namespaces / projects
func (in *NamespaceService) GetNamespaces() ([]models.Namespace, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "NamespaceService", "GetNamespaces")
	defer promtimer.ObserveNow(&err)

	if kialiCache != nil {
		if ns := kialiCache.GetNamespaces(in.k8s.GetToken()); ns != nil {
			return ns, nil
		}
	}

	labelSelector := config.Get().API.Namespaces.LabelSelector

	namespaces := []models.Namespace{}
	_, queryAllNamespaces := in.isAccessibleNamespaces["**"]
	// If we are running in OpenShift, we will use the project names since these are the list of accessible namespaces
	if in.hasProjects {
		projects, err2 := in.k8s.GetProjects(labelSelector)
		if err2 == nil {
			// Everything is good, return the projects we got from OpenShift / kube-project
			if queryAllNamespaces {
				namespaces = models.CastProjectCollection(projects)
			} else {
				filteredProjects := make([]osproject_v1.Project, 0)
				for _, project := range projects {
					if _, isAccessible := in.isAccessibleNamespaces[project.Name]; isAccessible {
						filteredProjects = append(filteredProjects, project)
					}
				}
				namespaces = models.CastProjectCollection(filteredProjects)
			}
		}
	} else {
		// if the accessible namespaces define a distinct list of namespaces, use only those.
		// If accessible namespaces include the special "**" (meaning all namespaces) ask k8s for them.
		// Note that "**" requires cluster role permission to list all namespaces.
		accessibleNamespaces := config.Get().Deployment.AccessibleNamespaces
		if queryAllNamespaces {
			nss, err := in.k8s.GetNamespaces(labelSelector)
			if err != nil {
				// Fallback to using the Kiali service account, if needed
				if errors.IsForbidden(err) {
					if nss, err = in.getNamespacesUsingKialiSA(labelSelector, err); err != nil {
						return nil, err
					}
				} else {
					return nil, err
				}
			}
			namespaces = models.CastNamespaceCollection(nss)
		} else {
			k8sNamespaces := make([]core_v1.Namespace, 0)
			for _, ans := range accessibleNamespaces {
				k8sNs, err := in.k8s.GetNamespace(ans)
				if err != nil {
					if errors.IsNotFound(err) {
						// If a namespace is not found, then we skip it from the list of namespaces
						log.Warningf("Kiali has an accessible namespace [%s] which doesn't exist", ans)
					} else if errors.IsForbidden(err) {
						// Also, if namespace isn't readable, skip it.
						log.Warningf("Kiali has an accessible namespace [%s] which is forbidden", ans)
					} else {
						// On any other error, abort and return the error.
						return nil, err
					}
				} else {
					k8sNamespaces = append(k8sNamespaces, *k8sNs)
				}
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

	if kialiCache != nil {
		kialiCache.SetNamespaces(in.k8s.GetToken(), result)
	}

	return result, nil
}

func (in *NamespaceService) isAccessibleNamespace(namespace string) bool {
	_, queryAllNamespaces := in.isAccessibleNamespaces["**"]
	if queryAllNamespaces {
		return true
	}
	_, isAccessible := in.isAccessibleNamespaces[namespace]
	return isAccessible
}

func (in *NamespaceService) isExcludedNamespace(namespace string) bool {
	excludes := config.Get().API.Namespaces.Exclude
	if len(excludes) == 0 {
		return false
	}
	for _, excludePattern := range excludes {
		if match, _ := regexp.MatchString(excludePattern, namespace); match {
			return true
		}
	}
	return false
}

// GetNamespace returns the definition of the specified namespace.
func (in *NamespaceService) GetNamespace(namespace string) (*models.Namespace, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "NamespaceService", "GetNamespace")
	defer promtimer.ObserveNow(&err)

	// Cache already has included/excluded namespaces applied
	if kialiCache != nil {
		if ns := kialiCache.GetNamespace(in.k8s.GetToken(), namespace); ns != nil {
			return ns, nil
		}
	}

	if !in.isAccessibleNamespace(namespace) {
		return nil, &AccessibleNamespaceError{msg: "Namespace [" + namespace + "] is not accessible for Kiali"}
	}

	if in.isExcludedNamespace(namespace) {
		return nil, &AccessibleNamespaceError{msg: "Namespace [" + namespace + "] is excluded for Kiali"}
	}

	var result models.Namespace
	if in.hasProjects {
		var project *osproject_v1.Project
		project, err = in.k8s.GetProject(namespace)
		if err != nil {
			return nil, err
		}
		result = models.CastProject(*project)
	} else {
		var ns *core_v1.Namespace
		ns, err = in.k8s.GetNamespace(namespace)
		if err != nil {
			return nil, err
		}
		result = models.CastNamespace(*ns)
	}
	// Refresh cache in case of cache expiration
	if kialiCache != nil {
		if _, err = in.GetNamespaces(); err != nil {
			return nil, err
		}
	}
	return &result, nil
}

func (in *NamespaceService) UpdateNamespace(namespace string, jsonPatch string) (*models.Namespace, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "WorkloadService", "UpdateWorkload")
	defer promtimer.ObserveNow(&err)

	// A first check to run the accessible/excluded logic and not run the Update operation on filtered namespaces
	_, err = in.GetNamespace(namespace)
	if err != nil {
		return nil, err
	}

	_, err = in.k8s.UpdateNamespace(namespace, jsonPatch)
	if err != nil {
		return nil, err
	}

	// Cache is stopped after a Create/Update/Delete operation to force a refresh
	if kialiCache != nil && err == nil {
		kialiCache.RefreshNamespace(namespace)
		kialiCache.RefreshTokenNamespaces()
	}
	// Call GetNamespace to update the caching
	return in.GetNamespace(namespace)
}

func (in *NamespaceService) getNamespacesUsingKialiSA(labelSelector string, forwardedError error) ([]core_v1.Namespace, error) {
	// Check if we already are using the Kiali ServiceAccount token. If we are, no need to do further processing, since
	// this would just circle back to the same results.
	if kialiToken, err := kubernetes.GetKialiToken(); err != nil {
		return nil, err
	} else if in.k8s.GetToken() == kialiToken {
		return nil, forwardedError
	}

	// Let's get the namespaces list using the Kiali Service Account
	nss, err := getNamespacesForKialiSA(labelSelector)
	if err != nil {
		return nil, err
	}

	// Only take namespaces where the user has privileges
	var namespaces []core_v1.Namespace
	for _, item := range nss {
		if _, getNsErr := in.k8s.GetNamespace(item.Name); getNsErr == nil {
			// Namespace is accessible
			namespaces = append(namespaces, item)
		} else if !errors.IsForbidden(getNsErr) {
			// Since the returned error is NOT "forbidden", something bad happened
			return nil, getNsErr
		}
	}

	// Return the list of namespaces where the user has the 'get namespace' read privilege.
	return namespaces, nil
}

func getNamespacesForKialiSA(labelSelector string) ([]core_v1.Namespace, error) {
	clientFactory, err := kubernetes.GetClientFactory()
	if err != nil {
		return nil, err
	}

	kialiToken, err := kubernetes.GetKialiToken()
	if err != nil {
		return nil, err
	}

	k8s, err := clientFactory.GetClient(&api.AuthInfo{Token: kialiToken})
	if err != nil {
		return nil, err
	}

	nss, err := k8s.GetNamespaces(labelSelector)
	if err != nil {
		return nil, err
	}

	return nss, nil
}
