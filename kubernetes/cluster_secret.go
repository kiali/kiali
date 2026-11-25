package kubernetes

import (
	"errors"
	"fmt"
	"maps"
	"os"
	"path/filepath"
	"slices"

	"k8s.io/client-go/tools/clientcmd"

	"github.com/kiali/kiali/log"
)

// RemoteClusterInfo is data that identifies a cluster particpating in the mesh. Multi-cluster meshes have multiple RemoteClusterInfos.
// Information obtained for a RemoteClusterInfo comes from remote cluster secrets.
type RemoteClusterInfo struct {
	ClusterInfo
	// SecretFile is the absolute file location of the secret as found on the file system
	SecretFile string
}

// newRemoteClusterInfo returns a new RemoteClusterInfo with Cluster and User data that are extracted from the given kubeconfig data.
// It is assumed there is a single cluster in the given kubeconfig - otherwise, an error is returned.
// If multiple users are defined in the given kubeconfig, the first one in the user list is used.
func newRemoteClusterInfo(secretName string, secretFile string) (RemoteClusterInfo, error) {
	cfg, err := clientcmd.LoadFromFile(secretFile)
	if err != nil {
		return RemoteClusterInfo{}, fmt.Errorf("failed to parse bytes from remote cluster secret [%s](%s): %v", secretName, secretFile, err)
	}

	if len(cfg.Clusters) != 1 {
		return RemoteClusterInfo{}, fmt.Errorf("bytes for remote cluster secret [%s](%s) has [%v] clusters associated with it", secretName, secretFile, len(cfg.Clusters))
	}

	clusterEntryName := slices.Collect(maps.Keys(cfg.Clusters))[0]
	// The kubeconfig's single cluster entry must be named for the file it lives in: the
	// file name is the cluster's identity everywhere else (the client factory's registry,
	// the cache's namespace scoping, the skipped-cluster registry), while
	// ClusterInfo.Name comes from the entry. A divergence would register the cluster
	// under one name and scope its informer cache under another - watching the wrong
	// namespaces, with no retry able to fix it - so fail the registration closed instead.
	if clusterEntryName != filepath.Base(secretFile) {
		return RemoteClusterInfo{}, fmt.Errorf("kubeconfig for remote cluster secret [%s](%s) names its cluster [%s]; the name must match the secret file name [%s], which is the cluster's registered name", secretName, secretFile, clusterEntryName, filepath.Base(secretFile))
	}

	if len(cfg.AuthInfos) == 0 {
		return RemoteClusterInfo{}, fmt.Errorf("bytes for remote cluster secret [%s](%s) has 0 users associated with it", secretName, secretFile)
	}

	if len(cfg.AuthInfos) > 1 {
		log.Warningf("bytes for remote cluster secret [%s](%s) has [%v] users associated with it - will use the first one", secretName, secretFile, len(cfg.AuthInfos))
	}

	restConf, err := clientcmd.NewDefaultClientConfig(*cfg, nil).ClientConfig()
	if err != nil {
		return RemoteClusterInfo{}, fmt.Errorf("failed to get client config for remote cluster secret [%s](%s): %v", secretName, secretFile, err)
	}

	return RemoteClusterInfo{
		ClusterInfo: ClusterInfo{
			Name:         clusterEntryName,
			ClientConfig: restConf,
			SecretName:   secretName,
		},
		SecretFile: secretFile,
	}, nil
}

// Defines where the files are located that contain the remote cluster secrets
var RemoteClusterSecretsDir = "/kiali-remote-cluster-secrets"

// RemoteClusterInventory is the result of loading the remote cluster secrets.
type RemoteClusterInventory struct {
	// Clusters maps cluster name to its registration, for every secret that could be read.
	Clusters map[string]RemoteClusterInfo
	// UnprocessableClusters lists the cluster names whose secret data was found but
	// could not be processed: a malformed kubeconfig is a definitively broken
	// registration, and callers record it in the skipped-cluster registry so
	// authorization surfaces fail closed for it instead of silently forgetting it.
	UnprocessableClusters []string
	// UnreadableSecrets names the secret directories that could not be enumerated.
	// The clusters they define are unknown - a secret name is not a cluster name,
	// and one secret can define several clusters - so the inventory is incomplete
	// rather than wrong. Callers must keep unscoped cross-cluster authorization
	// disabled until Kiali restarts with a readable mount, while still serving
	// the registrations that did read.
	UnreadableSecrets []string
}

// GetRemoteClusterInfos loads remote cluster secrets that contain information about other remote mesh clusters.
func GetRemoteClusterInfos() RemoteClusterInventory {
	return getRemoteClusterInfosFromDir(RemoteClusterSecretsDir)
}

// getRemoteClusterInfosFromDir loads remote cluster secrets mounted to the file system that contain information about other remote mesh clusters.
// The secrets should be mounted on the directory specified.
func getRemoteClusterInfosFromDir(rootSecretsDir string) RemoteClusterInventory {
	// For the ControlPlane to be able to "see" remote clusters, some "remote secrets" need to be in
	// place. These remote secrets contain <kubeconfig files> that the ControlPlane uses to
	// query the remote clusters. Without them, the control plane is not capable of pushing traffic
	// to the other clusters. We can use these same secrets to also connect to the remote clusters.

	// Remote cluster secrets are mounted on the file system by the Kiali installer under
	// the "/kiali-remote-cluster-secrets" directory. Each mounted secret has its own subdirectory,
	// with the directory name that of the secret name; e.g. "/kiali-remote-cluster-secrets/<secret name>".
	// Kubeconfig configs are found in a file whose name is the cluster name in that secret subdirectory;
	// e.g. "/kiali-remote-cluster-secrets/<secret name>/<cluster name>".
	// It is possible one secret can have multiple clusters defined within it, hence why each secret
	// subdirectory might have multiple cluster data files.

	// if there is no secret directory, then there are no remote clusters to worry about, so fail-fast
	secretDirs, err := os.ReadDir(rootSecretsDir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			// An absent root means no remote clusters are configured: optional, not an error.
			return RemoteClusterInventory{Clusters: map[string]RemoteClusterInfo{}}
		}
		// A present-but-unreadable root means no remote registration can be verified, but
		// the home cluster is healthy and must keep serving: record the inventory as
		// incomplete - the same contract as an unreadable secret directory below - rather
		// than abort startup. Unscoped cross-cluster authorization fails closed on the
		// unreadable-secrets registry until a restart with a readable mount.
		log.Errorf("Failed to read the remote cluster secrets directory [%s]: %v. No remote registration can be verified; Kiali serves the home cluster, and cross-cluster queries that cannot enumerate the full inventory are denied until Kiali is restarted with a readable mount.", rootSecretsDir, err)
		return RemoteClusterInventory{UnreadableSecrets: []string{rootSecretsDir}}
	}

	// Keyed on cluster name - we use this to make sure we don't get asked to load in multiple clusters with the same name
	remoteClusterSecretNames := make(map[string]string, 0)

	// When we go through all the files we find and convert them to RemoteClusterInfos,
	// they get put into this map to be returned to the caller.
	meshClusters := make(map[string]RemoteClusterInfo)
	// Cluster names found in the secrets whose data could not be processed.
	unprocessableClusters := []string{}
	// Secret names whose directory could not be enumerated at all.
	unreadableSecrets := []string{}

	for _, sd := range secretDirs {
		if sd.Type().IsRegular() {
			continue
		}
		secretName := sd.Name()
		secretAbsDir := rootSecretsDir + "/" + secretName
		secretFiles, err := os.ReadDir(secretAbsDir)
		if err != nil {
			// The clusters this secret defines are unknowable, and its name cannot
			// stand in for them: a secret name is not a cluster name (one secret can
			// define several), so recording it in the cluster-keyed skip registry
			// would misfire - a secret named like the home cluster would be discarded
			// by its shadowing guard and silently re-enable unscoped queries, and one
			// named like a healthy cluster would mark that cluster skipped. Record
			// the inventory as incomplete instead: the readable registrations still
			// serve, and unscoped cross-cluster authorization fails closed until a
			// restart with a readable mount.
			log.Errorf("Failed to read remote cluster secret directory [%s]: %v", secretAbsDir, err)
			unreadableSecrets = append(unreadableSecrets, secretName)
			continue
		}
		for _, sf := range secretFiles {
			clusterName := sf.Name()
			secretAbsFile := secretAbsDir + "/" + clusterName
			// Stat before anything else, and skip directories outright: kubelet-mounted
			// secrets carry non-file entries (the ..data symlink-to-dir in every secret,
			// possibly stray directories), and those must not reserve a cluster name - a
			// directory entry named like a real cluster would silently reject the valid
			// secret's registration, leaving the cluster in no inventory at all. The
			// stat-error check comes first: a file that disappears between the directory
			// read and the stat leaves statinfo nil, and dereferencing it panics.
			statinfo, staterr := os.Stat(secretAbsFile)
			if staterr == nil && statinfo.IsDir() {
				continue // we only want to process files - we are not interested in other entries that get mounted here
			}
			// Reserve the cluster name at discovery, before any per-file processing:
			// two secrets must not provide information on the same cluster, and reserving
			// first keeps the active and skipped inventories disjoint whichever secret
			// sorts first - a broken definition cannot be overridden by a later valid one,
			// and a valid one cannot be shadowed into the skip registry. A discovered name
			// whose file cannot be stat'ed (for example a dangling projected-secret
			// symlink) still reserves: it is a registration Kiali can see but cannot read,
			// recorded as unprocessable rather than silently forgotten.
			if previousSecret, ok := remoteClusterSecretNames[clusterName]; ok {
				log.Errorf("Cluster [%s] was already defined in secret [%v]. Two secrets must not provide information on the same cluster.", clusterName, previousSecret)
				continue
			}
			remoteClusterSecretNames[clusterName] = secretName

			if staterr != nil {
				log.Errorf("Failed to stat remote cluster secret file [%s] for cluster [%s]: %v", secretAbsFile, clusterName, staterr)
				unprocessableClusters = append(unprocessableClusters, clusterName)
				continue
			}

			nextCluster, err := newRemoteClusterInfo(secretName, secretAbsFile)
			if err != nil {
				log.Errorf("Failed to process data for remote cluster [%s] and file [%s]. Err: %s", clusterName, secretAbsFile, err)
				unprocessableClusters = append(unprocessableClusters, clusterName)
				continue
			}
			meshClusters[clusterName] = nextCluster
			log.Debugf("Data for remote cluster [%s] has been loaded from secret file [%s]", clusterName, secretAbsFile)
		}
	}

	return RemoteClusterInventory{
		Clusters:              meshClusters,
		UnprocessableClusters: unprocessableClusters,
		UnreadableSecrets:     unreadableSecrets,
	}
}
