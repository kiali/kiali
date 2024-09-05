package business

import (
	"context"
	"fmt"
	"sync"

	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
)

// NamespaceService deals with fetching k8sClients namespaces / OpenShift projects and convert to kiali model
type NamespaceService struct {
	conf                  *config.Config
	discovery             meshDiscovery
	hasProjects           map[string]bool
	homeClusterUserClient kubernetes.ClientInterface
	kialiCache            cache.KialiCache
	kialiSAClients        map[string]kubernetes.ClientInterface
	userClients           map[string]kubernetes.ClientInterface
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

func NewNamespaceService(
	userClients map[string]kubernetes.ClientInterface,
	kialiSAClients map[string]kubernetes.ClientInterface,
	cache cache.KialiCache,
	conf *config.Config,
	discovery meshDiscovery,
) NamespaceService {
	homeClusterName := conf.KubernetesConfig.ClusterName
	hasProjects := make(map[string]bool)
	for cluster, client := range kialiSAClients {
		hasProjects[cluster] = client.IsOpenShift()
	}

	return NamespaceService{
		conf:                  conf,
		discovery:             discovery,
		hasProjects:           hasProjects,
		homeClusterUserClient: userClients[homeClusterName],
		kialiCache:            cache,
		kialiSAClients:        kialiSAClients,
		userClients:           userClients,
	}
}

func (in *NamespaceService) clusterIsOpenshift(cluster string) bool {
	return in.hasProjects[cluster]
}

// GetClusterList Returns a list of cluster names based on the user clients
func (in *NamespaceService) GetClusterList() []string {
	var clusterList []string
	for cluster := range in.userClients {
		clusterList = append(clusterList, cluster)
	}
	return clusterList
}

// Returns a list of the given namespaces / projects
func (in *NamespaceService) GetNamespaces(ctx context.Context) ([]models.Namespace, error) {
	var end observability.EndFunc
	_, end = observability.StartSpan(ctx, "GetNamespaces",
		observability.Attribute("package", "business"),
	)
	defer end()

	// kiali cache saves namespaces per token + cluster. The same token can be
	// used for multiple clusters.
	clustersToCheck := make(map[string]kubernetes.ClientInterface)
	namespaces := []models.Namespace{}
	for cluster, client := range in.userClients {
		cachedNamespaces, found := in.kialiCache.GetNamespaces(cluster, client.GetToken())
		if !found {
			clustersToCheck[cluster] = client
		} else {
			// namespaces should already be filtered by discovery selectors, no need to do it here
			namespaces = append(namespaces, cachedNamespaces...)
		}
	}

	// Cache hit for all namespaces.
	if len(clustersToCheck) == 0 {
		return namespaces, nil
	}

	wg := &sync.WaitGroup{}
	type result struct {
		cluster string
		ns      []models.Namespace
		err     error
	}
	resultsCh := make(chan result)

	// TODO: Use a context to define a timeout. The context should be passed to the k8s client
	go func() {
		for cluster := range clustersToCheck {
			wg.Add(1)
			go func(c string) {
				defer wg.Done()
				list, error := in.getNamespacesByCluster(ctx, c)
				if error != nil {
					resultsCh <- result{cluster: c, ns: nil, err: error}
				} else {
					// getNamespacesByCluster filters namespaces using discovery selectors; we don't have to do it here
					resultsCh <- result{cluster: c, ns: list, err: nil}
				}
			}(cluster)
		}
		wg.Wait()
		close(resultsCh)
	}()

	// Combine namespace data
	for resultCh := range resultsCh {
		if resultCh.err != nil {
			if resultCh.cluster == in.conf.KubernetesConfig.ClusterName {
				log.Errorf("Error fetching Namespaces for local cluster [%s]: %s", resultCh.cluster, resultCh.err)
				return nil, resultCh.err
			} else {
				log.Infof("Error fetching Namespaces for cluster [%s]: %s", resultCh.cluster, resultCh.err)
				continue
			}
		}
		namespaces = append(namespaces, resultCh.ns...)
	}

	// store only the filtered set of namespaces in cache for the token
	namespacesPerCluster := make(map[string][]models.Namespace)
	for _, ns := range namespaces {
		namespacesPerCluster[ns.Cluster] = append(namespacesPerCluster[ns.Cluster], ns)
	}
	for cluster, ns := range namespacesPerCluster {
		in.kialiCache.SetNamespaces(in.userClients[cluster].GetToken(), ns)
	}

	return namespaces, nil
}

// getNamespacesByCluster returns the namespaces for the given cluster. The namespaces are filtered such
// that only those namespaces that match discovery selectors are returned.
func (in *NamespaceService) getNamespacesByCluster(ctx context.Context, cluster string) ([]models.Namespace, error) {
	var namespaces []models.Namespace

	// If we are running in OpenShift, we will use the project names since these are the list of accessible namespaces
	if in.clusterIsOpenshift(cluster) {
		projects, err := in.userClients[cluster].GetProjects(ctx, "")
		if err != nil {
			return nil, err
		}
		namespaces = models.CastProjectCollection(projects, cluster)
	} else {
		// Note that cluster-wide-access mode requires cluster role permission to list all namespaces.
		if in.conf.Deployment.ClusterWideAccess {

			nss, err := in.userClients[cluster].GetNamespaces("")
			if err != nil {
				// Fallback to using the Kiali service account, if needed
				if errors.IsForbidden(err) {
					if nss, err = in.getNamespacesUsingKialiSA(cluster, "", err); err != nil {
						return nil, err
					}
				} else {
					return nil, err
				}
			}

			namespaces = models.CastNamespaceCollection(nss, cluster)
		} else {
			// We do not have cluster wide access, so we do not have permission to list namespaces.
			// Therefore, we assume we can extract the list of accessible namespaces from the discovery selectors configuration.
			// That list of accessible namespaces will be used as our base list which we then filter with discovery selectors down below.
			// Note if this is a remote cluster, that remote cluster must have the same namespaces as those in our own local
			// cluster's accessible namespaces. This is one reason why we suggest enabling CWA for multi-cluster environments.
			accessibleNamespaces := in.conf.Deployment.AccessibleNamespaces
			k8sNamespaces := make([]core_v1.Namespace, 0)
			for _, ans := range accessibleNamespaces {
				k8sNs, err := in.userClients[cluster].GetNamespace(ans)
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
			namespaces = models.CastNamespaceCollection(k8sNamespaces, cluster)
		}
	}

	namespaces = filterNamespacesWithDiscoverySelectors(namespaces, getDiscoverySelectorsForCluster(cluster, in.conf))

	return namespaces, nil
}

// GetClusterNamespaces is just a convenience routine that filters GetNamespaces for a particular cluster
func (in *NamespaceService) GetClusterNamespaces(ctx context.Context, cluster string) ([]models.Namespace, error) {
	tokenNamespaces, err := in.GetNamespaces(ctx)
	if err != nil {
		return nil, err
	}

	clusterNamespaces := []models.Namespace{}
	for _, ns := range tokenNamespaces {
		if ns.Cluster == cluster {
			clusterNamespaces = append(clusterNamespaces, ns)
		}
	}

	return clusterNamespaces, nil
}

// GetNamespaceClusters is a convenience routine that filters GetNamespaces for a particular namespace
func (in *NamespaceService) GetNamespaceClusters(ctx context.Context, namespace string) ([]models.Namespace, error) {
	namespaces, err := in.GetNamespaces(ctx)
	if err != nil {
		return nil, err
	}

	result := []models.Namespace{}
	for _, ns := range namespaces {
		if ns.Name == namespace {
			result = append(result, ns)
		}
	}

	return result, nil
}

// GetClusterNamespace returns the definition of the specified namespace.
func (in *NamespaceService) GetClusterNamespace(ctx context.Context, namespace string, cluster string) (*models.Namespace, error) {
	var end observability.EndFunc
	_, end = observability.StartSpan(ctx, "GetClusterNamespace",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", namespace),
		observability.Attribute("cluster", cluster),
	)
	defer end()

	client, ok := in.userClients[cluster]
	if !ok {
		return nil, fmt.Errorf("cluster [%s] is not found or is not accessible for Kiali", cluster)
	}

	// Cache already has discovery selectors applied
	if ns, found := in.kialiCache.GetNamespace(cluster, client.GetToken(), namespace); found {
		return &ns, nil
	}

	if !in.isAccessibleNamespace(models.Namespace{Name: namespace, Cluster: cluster}) {
		return nil, &AccessibleNamespaceError{msg: "Namespace [" + namespace + "] in cluster [" + cluster + "] is not accessible to Kiali"}
	}

	var result models.Namespace
	if in.clusterIsOpenshift(cluster) {
		project, err := client.GetProject(ctx, namespace)
		if err != nil {
			return nil, err
		}
		result = models.CastProject(*project, cluster)
	} else {
		ns, err := client.GetNamespace(namespace)
		if err != nil {
			return nil, err
		}
		result = models.CastNamespace(*ns, cluster)
	}

	// Refresh namespace in cache since we've just fetched it from the API.
	if _, err := in.GetClusterNamespaces(ctx, cluster); err != nil {
		log.Errorf("Unable to refresh cache for cluster [%s]: %s", cluster, err)
	}

	return &result, nil
}

func (in *NamespaceService) UpdateNamespace(ctx context.Context, namespace string, jsonPatch string, cluster string) (*models.Namespace, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "UpdateNamespace",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", namespace),
		observability.Attribute("jsonPatch", jsonPatch),
	)
	defer end()

	// A first check to run the accessible/excluded logic and not run the Update operation on filtered namespaces
	_, err := in.GetClusterNamespace(ctx, namespace, cluster)
	if err != nil {
		return nil, err
	}

	userClient, found := in.userClients[cluster]
	if !found {
		return nil, fmt.Errorf("cluster [%s] is not found or is not accessible for Kiali", cluster)
	}

	if _, err := userClient.UpdateNamespace(namespace, jsonPatch); err != nil {
		return nil, err
	}

	// Cache is stopped after a Create/Update/Delete operation to force a refresh
	kubeCache, err := in.kialiCache.GetKubeCache(cluster)
	if err != nil {
		return nil, err
	}
	kubeCache.Refresh(namespace)
	in.kialiCache.RefreshTokenNamespaces(cluster)

	// Call GetClusterNamespaces to update the cache for this cluster.
	if _, err := in.GetClusterNamespaces(ctx, cluster); err != nil {
		return nil, err
	}

	return in.GetClusterNamespace(ctx, namespace, cluster)
}

func (in *NamespaceService) getNamespacesUsingKialiSA(cluster string, labelSelector string, forwardedError error) ([]core_v1.Namespace, error) {
	// Check if we already are using the Kiali ServiceAccount token. If we are, no need to do further processing, since
	// this would just circle back to the same results.
	kialiToken := in.kialiSAClients[cluster].GetToken()
	if in.userClients[cluster].GetToken() == kialiToken {
		return nil, forwardedError
	}

	// Let's get the namespaces list using the Kiali Service Account
	nss, err := in.kialiSAClients[cluster].GetNamespaces(labelSelector)
	if err != nil {
		return nil, err
	}

	// Only take namespaces where the user has privileges
	var namespaces []core_v1.Namespace
	for _, item := range nss {
		if _, getNsErr := in.userClients[cluster].GetNamespace(item.Name); getNsErr == nil {
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

// isAccessibleNamespace will look at the discovery selectors and see if the namespace is allowed to be accessed.
// This ignores cluster-wide-access mode since we can have discovery selectors even when given cluster wide access.
// Also, this may be asking for the accessibility of a namespace in a remote cluster, in which case cluster-wide-access is moot.
func (in *NamespaceService) isAccessibleNamespace(namespace models.Namespace) bool {
	selectors := getDiscoverySelectorsForCluster(namespace.Cluster, in.conf)
	// see if the discovery selectors match the one namespace we are checking
	return len(filterNamespacesWithDiscoverySelectors([]models.Namespace{namespace}, selectors)) == 1
}
