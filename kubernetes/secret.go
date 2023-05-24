package kubernetes

import (
	"os"

	yaml "gopkg.in/yaml.v2"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/client-go/tools/clientcmd/api"
)

type RemoteSecretCluster struct {
	CertificateAuthorityData string `yaml:"certificate-authority-data"`
	Server                   string `yaml:"server"`
}

type RemoteSecretClusterListItem struct {
	Cluster RemoteSecretCluster `yaml:"cluster"`
	Name    string              `yaml:"name"`
}

type RemoteSecretUser struct {
	Name string                   `yaml:"name"`
	User RemoteSecretUserAuthInfo `yaml:"user"`
}

type RemoteSecretUserAuthInfo struct {
	Token string                `yaml:"token"`
	Exec  *RemoteSecretUserExec `yaml:"exec"`
}

type RemoteSecretUserExec struct {
	Command            string                  `yaml:"command"`
	Args               []string                `yaml:"args"`
	Env                []api.ExecEnvVar        `yaml:"env"`
	APIVersion         string                  `yaml:"apiVersion"`
	InstallHint        string                  `yaml:"installHint"`
	ProvideClusterInfo bool                    `yaml:"provideClusterInfo"`
	InteractiveMode    api.ExecInteractiveMode `yaml:"interactiveMode"`
}

// RemoteSecret contains all the content for a secret containing kubeconfig information.
// It can contain information about one or more clusters and one or more users.
type RemoteSecret struct {
	APIVersion string                        `yaml:"apiVersion"`
	Clusters   []RemoteSecretClusterListItem `yaml:"clusters"`
	Contexts   []struct {
		Context struct {
			Cluster string `yaml:"cluster"`
			User    string `yaml:"user"`
		} `yaml:"context"`
		Name string `yaml:"name"`
	} `yaml:"contexts"`
	CurrentContext string `yaml:"current-context"`
	Kind           string `yaml:"kind"`
	Preferences    struct {
	} `yaml:"preferences"`
	Users []RemoteSecretUser `yaml:"users"`
}

func GetRemoteSecret(path string) (*RemoteSecret, error) {
	secretFile, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return ParseRemoteSecretBytes(secretFile)
}

// GetSecret fetches and returns the specified Secret definition
// from the cluster
func (in *K8SClient) GetSecret(namespace, name string) (*core_v1.Secret, error) {
	configMap, err := in.k8s.CoreV1().Secrets(namespace).Get(in.ctx, name, emptyGetOptions)
	if err != nil {
		return &core_v1.Secret{}, err
	}

	return configMap, nil
}

// ParseRemoteSecretBytes parses a raw file containing a <Kubeconfig file> and returns
// the parsed file in a RemoteSecret structure.
func ParseRemoteSecretBytes(secretBytes []byte) (*RemoteSecret, error) {
	secret := &RemoteSecret{}
	err := yaml.Unmarshal(secretBytes, &secret)
	if err != nil {
		return nil, err
	}
	return secret, nil
}
