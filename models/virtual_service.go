package models

import (
	"github.com/kiali/kiali/kubernetes"
)

// VirtualServices virtualServices
//
// This type is used for returning an array of VirtualServices
//
// swagger:model virtualServices
// An array of virtualService
// swagger:allOf
type VirtualServices []VirtualService

// VirtualService virtualService
//
// This type is used for returning a VirtualService
//
// swagger:model virtualService
type VirtualService struct {
	// The name of the virtualService
	//
	// required: true
	Name string `json:"name"`
	// The creation date of the virtualService
	//
	// required: true
	CreatedAt string `json:"createdAt"`
	// The resource version of the virtualService
	//
	// required: true
	ResourceVersion string      `json:"resourceVersion"`
	Hosts           interface{} `json:"hosts"`
	Gateways        interface{} `json:"gateways"`
	Http            interface{} `json:"http"`
	Tcp             interface{} `json:"tcp"`
	Tls             interface{} `json:"tls"`
}

func (vServices *VirtualServices) Parse(virtualServices []kubernetes.IstioObject) {
	for _, vs := range virtualServices {
		virtualService := VirtualService{}
		virtualService.Parse(vs)
		*vServices = append(*vServices, virtualService)
	}
}

func (vService *VirtualService) Parse(virtualService kubernetes.IstioObject) {
	vService.Name = virtualService.GetObjectMeta().Name
	vService.CreatedAt = formatTime(virtualService.GetObjectMeta().CreationTimestamp.Time)
	vService.ResourceVersion = virtualService.GetObjectMeta().ResourceVersion
	vService.Hosts = virtualService.GetSpec()["hosts"]
	vService.Gateways = virtualService.GetSpec()["gateways"]
	vService.Http = virtualService.GetSpec()["http"]
	vService.Tcp = virtualService.GetSpec()["tcp"]
	vService.Tls = virtualService.GetSpec()["tls"]
}
