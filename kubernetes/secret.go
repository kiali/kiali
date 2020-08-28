package kubernetes

import (
	"io/ioutil"

	yaml "gopkg.in/yaml.v2"
)

type RemoteSecretCluster struct {
	CertificateAuthorityData string `yaml:"certificate-authority-data"`
	Server                   string `yaml:"server"`
}

type RemoteSecretClusterListItem struct {
	Cluster RemoteSecretCluster `yaml:"cluster"`
	Name    string              `yaml:"name"`
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
	Users []struct {
		Name string `yaml:"name"`
		User struct {
			Token string `yaml:"token"`
		} `yaml:"user"`
	} `yaml:"users"`
}

func GetRemoteSecret(path string) (*RemoteSecret, error) {
	secret := &RemoteSecret{}
	secretFile, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}
	err = yaml.Unmarshal(secretFile, &secret)
	if err != nil {
		return nil, err
	}
	return secret, nil
}
