package business

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	osproject_v1 "github.com/openshift/api/project/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
)

// NamespaceService deals with fetching k8s namespaces / OpenShift projects and convert to kiali model
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
func (in *NamespaceService) GetNamespaces(ctx context.Context) ([]models.Namespace, error) {
	var end observability.EndFunc
	_, end = observability.StartSpan(ctx, "GetNamespaces",
		observability.Attribute("package", "business"),
	)
	defer end()

	if kialiCache != nil {
		if ns := kialiCache.GetNamespaces(in.k8s.GetToken()); ns != nil {
			return ns, nil
		}
	}

	configObject := config.Get()

	// Let's explain the four different filters along with accessible namespaces (aka AN).
	//
	// First, we look at AN. AN is either ["**"] or it is not.
	//
	// If AN is ["**"], then the entire cluster of namespaces is accessible to Kiali.
	// In this case, the user can further filter what namespaces this function should return using both includes and excludes.
	// 1. LabelSelectorInclude is used to obtain an initial set of namespaces, if specified.
	// 2. Added to that initial list will be the namespaces named in the Include list, if those namespaces actually exist.
	// 3. If no LabelSelectorInclude or Include list is specified, then all namespaces are in the list.
	// 4. Remove from that list those namespaces that match LabelSelectorExclude, as well as those namespaces found in the Exclude list.
	// (Side note: You might ask: Why have an Include list when we already have the AN list?
	// The difference is if you specify AN (not ["**"]), only those namespaces that exist __at install time__ will get a Role
	// and hence are accessible to Kiali. The Include list is evaluated at the time this function is called, thus it
	// allows Kiali to see those namespaces even if they are created after Kiali is installed).
	//
	// If AN is not ["**"], then only a subset of namespaces in the cluster is accessible to Kiali.
	// When installed by the operator, Kiali will be given access to a set of namespaces (as defined in AN) via Roles that
	// are created by the operator. Those namespaces that Kiali has access to (as defined in AN) will be labeled with the label
	// selector defined in LabelSelectorInclude (Kiali CR "spec.api.namespaces.label_selector_include").
	// 1. All of those namespaces are retrieved with the LabelSelectorInclude to obtain a set of namespaces.
	// 2. Remove from that list those namespaces that match LabelSelectorExclude, as well as those namespaces found in the Exclude list.
	// The Include option is ignored in this case - you cannot Include more namespaces over and above what AN specifies.
	// (Side note 1: It probably doesn't make sense to set LabelSelectorExclude and Excludes when AN is not ["**"]. This is because
	// you already have defined what namespaces you want to give Kiali access to (the AN list itself). However, for consistency,
	// this function will still use those additional filters to filter out namespaces. So it is possible this function returns
	// a subset of namespaces that are listed in AN.)
	// (Side note 2: Notice the difference here between when AN is set to ["**"] and when it is not. When AN is not set to ["**"],
	// LabelSelectorInclude does not tell the operator which namespaces are included - AN does that. Instead, the operator will
	// create that label as defined by LabelSelectorInclude on each namespace defined in AN. Thus, after the operator installs
	// Kiali, the Kiali Server can then use LabelSelectorInclude in this function in order to select all namespaces as defined in AN.
	// If installed via the server helm chart, none of that is done, and it is up to the user to ensure
	// LabelSelectorInclude (if defined) selects all namespaces in AN. It is a user-error if they do not configure that correctly.
	// The server helm chart will not assume they did it correctly. The user therefore normally should not set LabelSelectorInclude
	// if they also set AN to something not ["**"]. This is one reason why we recommend using the Kiali operator, and why we say
	// the server helm chart is only provided as a convenience.)
	// (Side note 3: The control plane namespace is always included via api.namespaces.include and
	// never excluded via api.namespaces.exclude or api.namespaces.label_selector_exclude.)

	labelSelectorInclude := configObject.API.Namespaces.LabelSelectorInclude

	// determine if we are to exclude namespaces by label - if so, set the label name and value for use later
	labelSelectorExclude := configObject.API.Namespaces.LabelSelectorExclude
	var labelSelectorExcludeName string
	var labelSelectorExcludeValue string
	if labelSelectorExclude != "" {
		excludeLabelList := strings.Split(labelSelectorExclude, "=")
		if len(excludeLabelList) != 2 {
			return nil, fmt.Errorf("api.namespaces.label_selector_exclude is invalid: %v", labelSelectorExclude)
		}
		labelSelectorExcludeName = excludeLabelList[0]
		labelSelectorExcludeValue = excludeLabelList[1]
	}

	namespaces := []models.Namespace{}
	_, queryAllNamespaces := in.isAccessibleNamespaces["**"]

	// If we are running in OpenShift, we will use the project names since these are the list of accessible namespaces
	if in.hasProjects {
		projects, err2 := in.k8s.GetProjects(labelSelectorInclude)
		if err2 == nil {
			// Everything is good, return the projects we got from OpenShift
			if queryAllNamespaces {
				namespaces = models.CastProjectCollection(projects)

				// add the namespaces explicitly included in the include list.
				includes := configObject.API.Namespaces.Include
				if len(includes) > 0 {
					var allNamespaces []models.Namespace
					var seedNamespaces []models.Namespace

					if labelSelectorInclude == "" {
						// we have already retrieved all the namespaces, but we want only those in the Include list
						allNamespaces = namespaces
						seedNamespaces = make([]models.Namespace, 0)
					} else {
						// we have already got those namespaces that match the LabelSelectorInclude - that is our seed list.
						// but we need ALL namespaces so we can look for more that match the Include list.
						if allProjects, err := in.k8s.GetProjects(""); err != nil {
							return nil, err
						} else {
							allNamespaces = models.CastProjectCollection(allProjects)
							seedNamespaces = namespaces
						}
					}
					namespaces = in.addIncludedNamespaces(allNamespaces, seedNamespaces)
				}
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
		accessibleNamespaces := configObject.Deployment.AccessibleNamespaces

		if queryAllNamespaces {
			nss, err := in.k8s.GetNamespaces(labelSelectorInclude)
			if err != nil {
				// Fallback to using the Kiali service account, if needed
				if errors.IsForbidden(err) {
					if nss, err = in.getNamespacesUsingKialiSA(labelSelectorInclude, err); err != nil {
						return nil, err
					}
				} else {
					return nil, err
				}
			}

			namespaces = models.CastNamespaceCollection(nss)

			// add the namespaces explicitly included in the includes list.
			includes := configObject.API.Namespaces.Include
			if len(includes) > 0 {
				var allNamespaces []models.Namespace
				var seedNamespaces []models.Namespace

				if labelSelectorInclude == "" {
					// we have already retrieved all the namespaces, but we want only those in the Include list
					allNamespaces = namespaces
					seedNamespaces = make([]models.Namespace, 0)
				} else {
					// we have already got those namespaces that match the LabelSelectorInclude - that is our seed list.
					// but we need ALL namespaces so we can look for more that match the Include list.
					allK8sNamespaces, err := in.k8s.GetNamespaces("")
					if err != nil {
						// Fallback to using the Kiali service account, if needed
						if errors.IsForbidden(err) {
							if allK8sNamespaces, err = in.getNamespacesUsingKialiSA("", err); err != nil {
								return nil, err
							}
						} else {
							return nil, err
						}
					}
					allNamespaces = models.CastNamespaceCollection(allK8sNamespaces)
					seedNamespaces = namespaces
				}
				namespaces = in.addIncludedNamespaces(allNamespaces, seedNamespaces)
			}
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

	// exclude namespaces that are:
	// 1. to be filtered out via the exclude list
	// 2. to be filtered out via the label selector
	// Note that the control plane namespace is never excluded
	excludes := configObject.API.Namespaces.Exclude
	if len(excludes) > 0 || labelSelectorExclude != "" {
		result = []models.Namespace{}
	NAMESPACES:
		for _, namespace := range namespaces {
			if namespace.Name != configObject.IstioNamespace {
				if len(excludes) > 0 {
					for _, excludePattern := range excludes {
						if match, _ := regexp.MatchString(excludePattern, namespace.Name); match {
							continue NAMESPACES
						}
					}
				}
				if labelSelectorExclude != "" {
					if namespace.Labels[labelSelectorExcludeName] == labelSelectorExcludeValue {
						continue NAMESPACES
					}
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

// addIncludedNamespaces will look at all the namespaces and return all of them that match the Include list.
// The returned results will be guaranteed to include the namespaces found in the given seed list.
// There will be no duplicate namespaces in the returned list.
func (in *NamespaceService) addIncludedNamespaces(all []models.Namespace, seed []models.Namespace) []models.Namespace {
	var controlPlaneNamespace models.Namespace
	hasNamespace := make(map[string]bool, len(seed))
	results := make([]models.Namespace, 0, len(seed))
	configObject := config.Get()

	// seed with the initial set of namespaces - this ensures there are no duplicates in the seed list
	for _, ns := range seed {
		if _, exists := hasNamespace[ns.Name]; !exists {
			hasNamespace[ns.Name] = true
			results = append(results, ns)
		}
	}

	// go through the list of all namespaces and add to the results list those that match a regex found in the Include list
	includes := configObject.API.Namespaces.Include
NAMESPACES:
	for _, ns := range all {
		if _, exists := hasNamespace[ns.Name]; exists {
			continue
		}
		for _, includePattern := range includes {
			if match, _ := regexp.MatchString(includePattern, ns.Name); match {
				hasNamespace[ns.Name] = true
				results = append(results, ns)
				continue NAMESPACES
			}
		}
		if ns.Name == configObject.IstioNamespace {
			controlPlaneNamespace = ns // squirrel away the control plane namepace in case we need to add it
		}
	}

	// Kiali needs the control plane namespace, so it should always be included.
	// If the user did not configure the include list to explicitly include the control plane namespace, then we need to include it now.
	if _, exists := hasNamespace[configObject.IstioNamespace]; !exists {
		if controlPlaneNamespace.Name != "" {
			results = append(results, controlPlaneNamespace)
		} else {
			log.Errorf("Kiali needs to include the control plane namespace. Make sure you configured Kiali so it can access and include the namespace [%s].", configObject.IstioNamespace)
		}
	}
	return results
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
	configObject := config.Get()
	excludes := configObject.API.Namespaces.Exclude
	if len(excludes) == 0 {
		return false
	}
	if namespace == configObject.IstioNamespace {
		return false // the control plane namespace is never excluded
	}
	for _, excludePattern := range excludes {
		if match, _ := regexp.MatchString(excludePattern, namespace); match {
			return true
		}
	}
	return false
}

func (in *NamespaceService) isIncludedNamespace(namespace string) bool {
	_, queryAllNamespaces := in.isAccessibleNamespaces["**"]
	if !queryAllNamespaces {
		return true // Include list is ignored if accessible namespaces is not **; for our purposes, when ignored we assume the Include list includes all.
	}

	configObject := config.Get()
	if namespace == configObject.IstioNamespace {
		return true // the control plane namespace is always included
	}

	includes := configObject.API.Namespaces.Include
	if len(includes) == 0 {
		return true // if no Include list is specified, all namespaces are included
	}
	for _, includePattern := range includes {
		if match, _ := regexp.MatchString(includePattern, namespace); match {
			return true
		}
	}
	return false
}

// GetNamespace returns the definition of the specified namespace.
func (in *NamespaceService) GetNamespace(ctx context.Context, namespace string) (*models.Namespace, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetNamespace",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", namespace),
	)
	defer end()

	var err error

	// Cache already has included/excluded namespaces applied
	if kialiCache != nil {
		if ns := kialiCache.GetNamespace(in.k8s.GetToken(), namespace); ns != nil {
			return ns, nil
		}
	}

	if !in.isAccessibleNamespace(namespace) {
		return nil, &AccessibleNamespaceError{msg: "Namespace [" + namespace + "] is not accessible for Kiali"}
	}

	if !in.isIncludedNamespace(namespace) {
		return nil, &AccessibleNamespaceError{msg: "Namespace [" + namespace + "] is not included for Kiali"}
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
		if _, err = in.GetNamespaces(ctx); err != nil {
			return nil, err
		}
	}
	return &result, nil
}

func (in *NamespaceService) UpdateNamespace(ctx context.Context, namespace string, jsonPatch string) (*models.Namespace, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "UpdateNamespace",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", namespace),
		observability.Attribute("jsonPatch", jsonPatch),
	)
	defer end()

	// A first check to run the accessible/excluded logic and not run the Update operation on filtered namespaces
	_, err := in.GetNamespace(ctx, namespace)
	if err != nil {
		return nil, err
	}

	_, err = in.k8s.UpdateNamespace(namespace, jsonPatch)
	if err != nil {
		return nil, err
	}

	// Cache is stopped after a Create/Update/Delete operation to force a refresh
	if kialiCache != nil && err == nil {
		kialiCache.Refresh(namespace)
		kialiCache.RefreshTokenNamespaces()
	}
	// Call GetNamespace to update the caching
	return in.GetNamespace(ctx, namespace)
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
