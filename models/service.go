package models

import (
	"github.com/swift-sunshine/swscore/log"
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
	client, err := KubernetesClient()
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
	client, err := KubernetesClient()
	if err != nil {
		return nil, err
	}
	servicesList, err := client.GetServices(namespace)
	if err != nil {
		log.Error(err)
		return nil, err
	}
	return servicesList, nil
}
