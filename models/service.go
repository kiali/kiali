package models

import (
	"github.com/swift-sunshine/swscore/kubernetes"
	"github.com/swift-sunshine/swscore/log"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"math/rand"
)

type Service struct {
	Id        int    `json:"id"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

type ServiceDetail struct {
}

func ServiceNew(name, namespace string) *Service {
	var service = Service{}
	service.Id = rand.Int()
	service.Name = name
	service.Namespace = namespace
	return &service
}

func ServiceDetailsGet(namespace string, serviceName string) (interface{}, error) {
	client, err := kubernetes.NewClient()
	if err != nil {
		return nil, err
	}
	details, err := client.GetServiceDetails(namespace, serviceName)
	if err != nil {
		log.Error(err)
		return nil, err
	}
	return details, nil
}

func ServicesNamespace(namespace string) (interface{}, error) {
	client, err := kubernetes.NewClient()
	if err != nil {
		return nil, err
	}
	listNamespaces, err := client.GetNamespaces()
	if err != nil {
		return nil, err
	}
	if !stringInSlice(namespace, listNamespaces) {

		return nil, errors.NewNotFound(schema.GroupResource{Resource: "namespaces"}, namespace)
	}
	servicesList, err := client.GetServices(namespace)
	if err != nil {
		log.Error(err)
		return nil, err
	}
	return servicesList, nil
}
