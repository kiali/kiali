package config

import (
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/kiali/kiali/config/security"
)

func TestMarshalUnmarshalStaticContentRootDirectory(t *testing.T) {
	testConf := Config{
		Server: Server{
			StaticContentRootDirectory: "/tmp",
		},
	}

	yamlString, err := Marshal(&testConf)
	if err != nil {
		t.Errorf("Failed to marshal: %v", err)
	}
	if yamlString != "server:\n  static_content_root_directory: /tmp\n" {
		t.Errorf("Failed to marshal - StaticContentRootDirectory to static_content_root_directory: [%v]", yamlString)
	}
	conf, err := Unmarshal(yamlString)
	if err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}
	if conf.Server.StaticContentRootDirectory != "/tmp" {
		t.Errorf("Failed to unmarshal static content root directory:\n%v", conf)
	}
}

func TestMarshalUnmarshalApiConfig(t *testing.T) {
	testConf := Config{
		API: ApiConfig{
			Namespaces: ApiNamespacesConfig{
				Exclude: []string{"istio-operator", "kube.*"},
			},
		},
	}

	yamlString, err := Marshal(&testConf)
	if err != nil {
		t.Errorf("Failed to marshal: %v", err)
	}
	if yamlString != "api:\n  namespaces:\n    exclude:\n    - istio-operator\n    - kube.*\n" {
		t.Errorf("Failed to marshal Api:\n%q", yamlString)
	}
	conf, err := Unmarshal(yamlString)
	if err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}
	if len(conf.API.Namespaces.Exclude) != 2 {
		t.Errorf("Failed to unmarshal Api:\n%+v", conf.API)
	}
}

func TestMarshalUnmarshal(t *testing.T) {
	testConf := Config{
		Server: Server{
			Address: "foo-test",
			Port:    321,

			StaticContentRootDirectory: "/tmp",
		},
	}

	yamlString, err := Marshal(&testConf)
	if err != nil {
		t.Errorf("Failed to marshal: %v", err)
	}
	if yamlString == "" {
		t.Errorf("Failed to marshal - empty yaml string")
	}

	conf, err := Unmarshal(yamlString)
	if err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}

	if conf.Server.Address != "foo-test" {
		t.Errorf("Failed to unmarshal server address:\n%v", conf)
	}
	if conf.Server.Port != 321 {
		t.Errorf("Failed to unmarshal server port:\n%v", conf)
	}
	if conf.Server.StaticContentRootDirectory != "/tmp" {
		t.Errorf("Failed to unmarshal static content root directory:\n%v", conf)
	}
}

func TestLoadSave(t *testing.T) {
	testConf := Config{
		Server: Server{
			Address: "foo-test",
			Port:    321,
		},
	}

	filename := "/tmp/config_test.yaml"
	defer os.Remove(filename)

	err := SaveToFile(filename, &testConf)
	if err != nil {
		t.Errorf("Failed to save to file: %v", err)
	}

	conf, err := LoadFromFile(filename)
	if err != nil {
		t.Errorf("Failed to load from file: %v", err)
	}

	t.Logf("Config from file\n%v", conf)

	if conf.Server.Address != "foo-test" {
		t.Errorf("Failed to unmarshal server address:\n%v", conf)
	}
	if conf.Server.Port != 321 {
		t.Errorf("Failed to unmarshal server port:\n%v", conf)
	}
}

func TestError(t *testing.T) {
	_, err := Unmarshal("bogus-yaml")
	if err == nil {
		t.Errorf("Unmarshal should have failed")
	}

	_, err = LoadFromFile("bogus-file-name")
	if err == nil {
		t.Errorf("Load should have failed")
	}
}

func TestMarshalUnmarshalCredentials(t *testing.T) {
	testConf := Config{
		Server: Server{
			Credentials: security.Credentials{
				Username:   "foo",
				Passphrase: "bar",
			},
		},
	}

	yamlString, err := Marshal(&testConf)
	if err != nil {
		t.Errorf("Failed to marshal: %v", err)
	}
	if !strings.Contains(yamlString, "username: foo\n") {
		t.Errorf("Failed to marshal credentials - [%v]", yamlString)
	}
	conf, err := Unmarshal(yamlString)
	if err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}
	if conf.Server.Credentials.Username != "foo" {
		t.Errorf("Failed to unmarshal username credentials:\n%v", conf)
	}
	if conf.Server.Credentials.Passphrase != "bar" {
		t.Errorf("Failed to unmarshal password credentials:\n%v", conf)
	}

	testConf = Config{
		Server: Server{
			Credentials: security.Credentials{
				Username:   "",
				Passphrase: "",
			},
		},
	}

	yamlString, err = Marshal(&testConf)
	if err != nil {
		t.Errorf("Failed to marshal: %v", err)
	}
	conf, err = Unmarshal(yamlString)
	if err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}
	if conf.Server.Credentials.Username != "" {
		t.Errorf("Failed to unmarshal empty username credentials:\n%v", conf)
	}
	if conf.Server.Credentials.Passphrase != "" {
		t.Errorf("Failed to unmarshal empty password credentials:\n%v", conf)
	}
}

func TestRaces(t *testing.T) {

	wg := sync.WaitGroup{}
	wg.Add(10)

	cfg := NewConfig()

	for i := 0; i < 5; i++ {
		go func() {
			defer wg.Done()
			Get()
		}()
	}

	for i := 0; i < 5; i++ {
		go func() {
			defer wg.Done()
			Set(cfg)
		}()
	}

	wg.Wait()
}
