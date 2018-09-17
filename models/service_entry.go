package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type ServiceEntries []ServiceEntry
type ServiceEntry struct {
	Name            string      `json:"name"`
	CreatedAt       string      `json:"createdAt"`
	ResourceVersion string      `json:"resourceVersion"`
	Hosts           interface{} `json:"hosts"`
	Addresses       interface{} `json:"addresses"`
	Ports           interface{} `json:"ports"`
	Location        interface{} `json:"location"`
	Resolution      interface{} `json:"resolution"`
	Endpoints       interface{} `json:"endpoints"`
}

func (ses *ServiceEntries) Parse(serviceEntries []kubernetes.IstioObject) {
	for _, se := range serviceEntries {
		serviceEntry := ServiceEntry{}
		serviceEntry.Parse(se)
		*ses = append(*ses, serviceEntry)
	}
}

func (se *ServiceEntry) Parse(serviceEntry kubernetes.IstioObject) {
	se.Name = serviceEntry.GetObjectMeta().Name
	se.CreatedAt = formatTime(serviceEntry.GetObjectMeta().CreationTimestamp.Time)
	se.ResourceVersion = serviceEntry.GetObjectMeta().ResourceVersion
	se.Hosts = serviceEntry.GetSpec()["hosts"]
	se.Addresses = serviceEntry.GetSpec()["addresses"]
	se.Ports = serviceEntry.GetSpec()["ports"]
	se.Location = serviceEntry.GetSpec()["location"]
	se.Resolution = serviceEntry.GetSpec()["resolution"]
	se.Endpoints = serviceEntry.GetSpec()["endpoints"]
}
