package config

import (
	"os"
	"testing"
)

func TestEnvVar(t *testing.T) {
	defer os.Setenv(ENV_FILESERVER_ADDRESS, os.Getenv(ENV_FILESERVER_ADDRESS))
	defer os.Setenv(ENV_FILESERVER_PORT, os.Getenv(ENV_FILESERVER_PORT))
	os.Setenv(ENV_FILESERVER_ADDRESS, "test-address")
	os.Setenv(ENV_FILESERVER_PORT, "12345")

	conf := NewConfig()

	if conf.FileServer.Address != "test-address" {
		t.Error("fileserver address is wrong")
	}
	if conf.FileServer.Port != 12345 {
		t.Error("fileserver port is wrong")
	}
}

func TestDefaults(t *testing.T) {
	conf := NewConfig()

	if conf.FileServer.Address != "" {
		t.Error("fileserver address default is wrong")
	}

	if conf.FileServer.Port != 20000 {
		t.Error("fileserver port default is wrong")
	}
}

func TestMarshalUnmarshal(t *testing.T) {
	testConf := Config{
		FileServer: FileServer{
			Address: "foo-test",
			Port:    321,
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

	if conf.FileServer.Address != "foo-test" {
		t.Errorf("Failed to unmarshal fileserver address:\n%v", conf)
	}
	if conf.FileServer.Port != 321 {
		t.Errorf("Failed to unmarshal fileserver port:\n%v", conf)
	}
}

func TestLoadSave(t *testing.T) {
	testConf := Config{
		FileServer: FileServer{
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

	if conf.FileServer.Address != "foo-test" {
		t.Errorf("Failed to unmarshal fileserver address:\n%v", conf)
	}
	if conf.FileServer.Port != 321 {
		t.Errorf("Failed to unmarshal fileserver port:\n%v", conf)
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
