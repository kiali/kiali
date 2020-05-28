package data

import (
	"bytes"
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
