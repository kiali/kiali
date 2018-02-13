package models

import "math/rand"

type Service struct {
	Id        int    `json:"id"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

func ServiceNew(name, namespace string) *Service {
	var service = Service{}
	service.Id = rand.Int()
	service.Name = name
	service.Namespace = namespace
	return &service
}
