package kubernetes

import (
	"io/ioutil"

	yaml "gopkg.in/yaml.v2"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
	Name string                `yaml:"name"`
	User RemoteSecretUserToken `yaml:"user"`
}

type RemoteSecretUserToken struct {
	Token string `yaml:"token"`
}

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
	secretFile, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return ParseRemoteSecretBytes(secretFile)
}

// GetSecrets returns a list of secrets for a given namespace.
// If selectorLabels is defined, the list will only contain services matching
// the specified label selector.
func (in *K8SClient) GetSecrets(namespace string, labelSelector string) ([]core_v1.Secret, error) {
	listOptions := emptyListOptions
	if len(labelSelector) > 0 {
		listOptions = meta_v1.ListOptions{LabelSelector: labelSelector}
	}

	if secretsList, err := in.k8s.CoreV1().Secrets(namespace).List(in.ctx, listOptions); err == nil {
		return secretsList.Items, nil
	} else {
		return []core_v1.Secret{}, err
	}
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
