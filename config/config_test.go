package config

import (
	"os"
	"testing"
)

func TestEnvVar(t *testing.T) {
	defer os.Setenv(ENV_FOO_STRING, os.Getenv(ENV_FOO_STRING))
	defer os.Setenv(ENV_FOO_INT, os.Getenv(ENV_FOO_INT))
	os.Setenv(ENV_FOO_STRING, "test-foo-env")
	os.Setenv(ENV_FOO_INT, "123")

	conf := NewConfig()

	if conf.Foo.String != "test-foo-env" {
		t.Error("foo string is wrong")
	}
	if conf.Foo.Int != 123 {
		t.Error("foo int is wrong")
	}
}

func TestDefaults(t *testing.T) {
	conf := NewConfig()

	if conf.Foo.String != "" {
		t.Error("foo string default is wrong")
	}

	if conf.Foo.Int != 0 {
		t.Error("foo int default is wrong")
	}
}

func TestMarshalUnmarshal(t *testing.T) {
	testConf := Config{
		Foo: Foo{
			String: "foo-test",
			Int: 321,
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

	if conf.Foo.String != "foo-test" {
		t.Errorf("Failed to unmarshal foo string:\n%v", conf)
	}
	if conf.Foo.Int != 321 {
		t.Errorf("Failed to unmarshal foo int:\n%v", conf)
	}
}

func TestLoadSave(t *testing.T) {
	testConf := Config{
		Foo: Foo{
			String: "foo-test",
			Int: 321,
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

	if conf.Foo.String != "foo-test" {
		t.Errorf("Failed to unmarshal foo string:\n%v", conf)
	}
	if conf.Foo.Int != 321 {
		t.Errorf("Failed to unmarshal foo int:\n%v", conf)
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
