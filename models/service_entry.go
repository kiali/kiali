package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type ServiceEntries []ServiceEntry
type ServiceEntry struct {
	IstioBase
	Spec struct {
		Hosts            interface{} `json:"hosts"`
		Addresses        interface{} `json:"addresses"`
		Ports            interface{} `json:"ports"`
		Location         interface{} `json:"location"`
		Resolution       interface{} `json:"resolution"`
		Endpoints        interface{} `json:"endpoints"`
		WorkloadSelector interface{} `json:"workloadSelector"`
		ExportTo         interface{} `json:"exportTo"`
		SubjectAltNames  interface{} `json:"subjectAltNames"`
	} `json:"spec"`
}

func (ses *ServiceEntries) Parse(serviceEntries []kubernetes.IstioObject) {
	for _, se := range serviceEntries {
		serviceEntry := ServiceEntry{}
		serviceEntry.Parse(se)
		*ses = append(*ses, serviceEntry)
	}
}

func (se *ServiceEntry) Parse(serviceEntry kubernetes.IstioObject) {
	se.IstioBase.Parse(serviceEntry)
	se.Spec.Hosts = serviceEntry.GetSpec()["hosts"]
	se.Spec.Addresses = serviceEntry.GetSpec()["addresses"]
	se.Spec.Ports = serviceEntry.GetSpec()["ports"]
	se.Spec.Location = serviceEntry.GetSpec()["location"]
	se.Spec.Resolution = serviceEntry.GetSpec()["resolution"]
	se.Spec.Endpoints = serviceEntry.GetSpec()["endpoints"]
	se.Spec.WorkloadSelector = serviceEntry.GetSpec()["workloadSelector"]
	se.Spec.ExportTo = serviceEntry.GetSpec()["exportTo"]
	se.Spec.SubjectAltNames = serviceEntry.GetSpec()["subjectAltNames"]
}
