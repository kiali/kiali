package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type VirtualServices []VirtualService
type VirtualService struct {
	Name            string      `json:"name"`
	CreatedAt       string      `json:"created_at"`
	ResourceVersion string      `json:"resource_version"`
	Hosts           interface{} `json:"hosts"`
	Gateways        interface{} `json:"gateways"`
	Http            interface{} `json:"http"`
	Tcp             interface{} `json:"tcp"`
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
}
