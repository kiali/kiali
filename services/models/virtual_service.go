package models

import (
	"time"

	"github.com/kiali/kiali/kubernetes"
)

type VirtualServices []VirtualService
type VirtualService struct {
	Name            string      `json:"name"`
	CreatedAt       string      `json:"created_at"`
	ResourceVersion string      `json:"resource_version"`
	Hosts           interface{} `json:"hosts,omitempty"`
	Gateways        interface{} `json:"gateways,omitempty"`
	Http            interface{} `json:"http,omitempty"`
	Tcp             interface{} `json:"tcp,omitempty"`
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
	vService.CreatedAt = virtualService.GetObjectMeta().CreationTimestamp.Time.Format(time.RFC3339)
	vService.ResourceVersion = virtualService.GetObjectMeta().ResourceVersion
	vService.Hosts = virtualService.GetSpec()["hosts"]
	vService.Gateways = virtualService.GetSpec()["gateways"]
	vService.Http = virtualService.GetSpec()["http"]
	vService.Tcp = virtualService.GetSpec()["tcp"]
}
