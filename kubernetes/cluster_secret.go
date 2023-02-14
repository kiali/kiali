package kubernetes

import (
	"errors"
	"fmt"
	"os"

	"github.com/kiali/kiali/log"
)

// RemoteClusterInfo is data that identifies a cluster particpating in the mesh. Multi-cluster meshes have multiple RemoteClusterInfos.
// Information obtained for a RemoteClusterInfo comes from remote cluster secrets.
type RemoteClusterInfo struct {
	// Cluster contains information necessary to connect to the remote cluster
	Cluster RemoteSecretClusterListItem
	// SecretFile is the absolute file location of the secret as found on the file system
	SecretFile string
	// SecretName is the name of the secret where the data about this cluster was found
	SecretName string
	// User contains information about the user credentials that can be used to connect to the remote cluster
	User RemoteSecretUser
}

// newRemoteClusterInfo returns a new RemoteClusterInfo with Cluster and User data that are extracted from the given kubeconfig data.
// It is assumed there is a single cluster in the given kubeconfig - otherwise, an error is returned.
// If multiple users are defined in the given kubeconfig, the first one in the user list is used.
func newRemoteClusterInfo(secretName string, secretFile string, kubeconfig []byte) (RemoteClusterInfo, error) {
	parsedSecret, parseErr := ParseRemoteSecretBytes(kubeconfig)
	if parseErr != nil {
		return RemoteClusterInfo{}, fmt.Errorf("Failed to parse bytes from remote cluster secret [%s](%s): %v", secretName, secretFile, parseErr)
	}

	if len(parsedSecret.Clusters) != 1 {
		return RemoteClusterInfo{}, fmt.Errorf("Bytes for remote cluster secret [%s](%s) has [%v] clusters associated with it", secretName, secretFile, len(parsedSecret.Clusters))
	}

	if len(parsedSecret.Users) == 0 {
		return RemoteClusterInfo{}, fmt.Errorf("Bytes for remote cluster secret [%s](%s) has 0 users associated with it", secretName, secretFile)
	}

	if len(parsedSecret.Users) > 1 {
		log.Warningf("Bytes for remote cluster secret [%s](%s) has [%v] users associated with it - will use the first one", secretName, secretFile, len(parsedSecret.Users))
	}

	return RemoteClusterInfo{
		Cluster:    parsedSecret.Clusters[0],
		SecretFile: secretFile,
		SecretName: secretName,
		User:       parsedSecret.Users[0],
	}, nil
}

// Defines where the files are located that contain the remote cluster secrets
var RemoteClusterSecretsDir = "/kiali-remote-cluster-secrets"

// GetRemoteClusterInfos loads remote cluster secrets that contain information about other remote mesh clusters.
// The returned map is keyed on cluster name.
func GetRemoteClusterInfos() (map[string]RemoteClusterInfo, error) {
	return getRemoteClusterInfosFromDir(RemoteClusterSecretsDir)
}

// GetRemoteClusterInfosFromDir loads remote cluster secrets mounted to the file system that contain information about other remote mesh clusters.
// The secrets should be mounted on the directory specified.
// The returned map is keyed on cluster name.
func getRemoteClusterInfosFromDir(rootSecretsDir string) (map[string]RemoteClusterInfo, error) {
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
		if !errors.Is(err, os.ErrNotExist) {
			log.Errorf("Failed to read remote cluster secrets directory [%s]: %v", rootSecretsDir, err)
		}
		return map[string]RemoteClusterInfo{}, nil
	}

	// Keyed on cluster name - we use this to make sure we don't get asked to load in multiple clusters with the same name
	remoteClusterSecretNames := make(map[string]string, 0)

	// When we go through all the files we find and convert them to RemoteClusterInfos,
	// they get put into this map to be returned to the caller.
	meshClusters := make(map[string]RemoteClusterInfo)

	for _, sd := range secretDirs {
		secretName := sd.Name()
		secretAbsDir := rootSecretsDir + "/" + secretName
		secretFiles, err := os.ReadDir(secretAbsDir)
		if err != nil {
			log.Errorf("Failed to read remote cluster secret directory [%s]: %v", secretAbsDir, err)
			continue
		}
		for _, sf := range secretFiles {
			clusterName := sf.Name()
			secretAbsFile := secretAbsDir + "/" + clusterName
			statinfo, staterr := os.Stat(secretAbsFile)
			if statinfo.IsDir() || staterr != nil {
				continue // we only want to process readable files - we are not interested in other files that get mounted here
			}
			if previousSecret, ok := remoteClusterSecretNames[clusterName]; ok {
				log.Errorf("Cluster [%s] was already defined in secret [%v]. Two secrets must not provide information on the same cluster.", clusterName, previousSecret)
				continue
			}
			b, err := os.ReadFile(secretAbsFile)
			if err != nil {
				log.Errorf("Failed to read remote cluster secret file [%s]: %v", secretAbsFile, err)
				continue
			}
			if len(b) == 0 {
				log.Errorf("There is no data in remote cluster secret file [%s]", secretAbsFile)
				continue
			}

			nextCluster, err := newRemoteClusterInfo(secretName, secretAbsFile, b)
			if err != nil {
				log.Errorf("Failed to process data for remote cluster [%s](%s)", clusterName, secretAbsFile)
				continue
			}
			meshClusters[clusterName] = nextCluster
			remoteClusterSecretNames[clusterName] = secretName
			log.Debugf("Data for remote cluster [%s] has been loaded from secret file [%s]", clusterName, secretAbsFile)
		}
	}

	return meshClusters, nil
}

// reloadRemoteClusterInfoFromFile will re-read the remote cluster secret from the file system and if the data is different
// than the given RemoteClusterInfo, a new one is returned. Otherwise, nil is returned to indicate nothing has changed and
// the given RemoteClusterInfo is already up to date.
func reloadRemoteClusterInfoFromFile(rci RemoteClusterInfo) (*RemoteClusterInfo, error) {
	b, err := os.ReadFile(rci.SecretFile)
	if err != nil {
		return nil, fmt.Errorf("Failed to reload remote cluster [%s] secret file [%s]: %v", rci.Cluster.Name, rci.SecretFile, err)
	}
	if len(b) == 0 {
		return nil, fmt.Errorf("There is no data in remote cluster [%s] secret file [%s]", rci.Cluster.Name, rci.SecretFile)
	}

	newRci, err := newRemoteClusterInfo(rci.SecretName, rci.SecretFile, b)
	if err != nil {
		return nil, fmt.Errorf("Failed to process data for remote cluster [%s] secret file [%s]", rci.Cluster.Name, rci.SecretFile)
	}

	if rci != newRci {
		return &newRci, nil
	}

	// the information did not change - return nil to indicate the original one passed to this funcation is already up to date
	return nil, nil
}
