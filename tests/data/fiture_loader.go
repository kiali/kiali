package data

import (
	"bytes"
	"fmt"
	"gopkg.in/yaml.v2"
	"io/ioutil"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

type FixtureLoader interface {
	Load() error
	GetResources(kind string) kubernetes.IstioObjectList
}

type YamlFixtureLoader struct {
	Filename  string
	loaded    bool
	resources map[string][]kubernetes.IstioObject
}

func (l *YamlFixtureLoader) Load() error {
	yamlFile, err := ioutil.ReadFile(l.Filename)
	if err != nil {
		log.Errorf("Error loading test file: #%v ", err)
		return err
	}

	r := bytes.NewReader(yamlFile)
	dec := yaml.NewDecoder(r)

	var resources []kubernetes.GenericIstioObject

	for err == nil {
		var resource kubernetes.GenericIstioObject

		err = dec.Decode(&resource)
		if err == nil {
			resource.Spec = cleanUpStringInterfaceMap(resource.Spec)
			resources = append(resources, resource)
		}
	}

	l.sortResources(&kubernetes.GenericIstioObjectList{Items: resources})
	l.loaded = true

	return nil
}

func (l *YamlFixtureLoader) sortResources(resources kubernetes.IstioObjectList) {
	l.resources = map[string][]kubernetes.IstioObject{}

	for _, r := range resources.GetItems() {
		kind := r.GetObjectKind().GroupVersionKind().Kind
		if l.resources[kind] == nil {
			l.resources[kind] = []kubernetes.IstioObject{}
		}

		l.resources[kind] = append(l.resources[kind], r)
	}
}

func (l YamlFixtureLoader) GetResources(kind string) []kubernetes.IstioObject {
	if !l.loaded {
		return nil
	}

	return l.resources[kind]
}

func (l YamlFixtureLoader) GetResource(kind string) kubernetes.IstioObject {
	if len(l.GetResources(kind)) > 0 {
		return l.GetResources(kind)[0]
	}
	return nil
}

// Needed due to Yaml.Decode default map type is map[interface{}]interface{}
// We need to convert it to map[string]interface{} to be compliant with real Istio Objects.
// Known issue: https://github.com/go-yaml/yaml/issues/139

func cleanUpInterfaceArray(in []interface{}) []interface{} {
	result := make([]interface{}, len(in))
	for i, v := range in {
		result[i] = cleanUpMapValue(v)
	}
	return result
}

func cleanUpInterfaceMap(in map[interface{}]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range in {
		result[fmt.Sprintf("%v", k)] = cleanUpMapValue(v)
	}
	return result
}

func cleanUpStringInterfaceMap(in map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range in {
		result[k] = cleanUpMapValue(v)
	}
	return result
}

func cleanUpMapValue(v interface{}) interface{} {
	switch v := v.(type) {
	case []interface{}:
		return cleanUpInterfaceArray(v)
	case map[interface{}]interface{}:
		return cleanUpInterfaceMap(v)
	case map[string]interface{}:
		return cleanUpStringInterfaceMap(v)
	default:
		return v
	}
}
