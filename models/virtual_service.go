package models

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

// VirtualServices virtualServices
//
// This type is used for returning an array of VirtualServices with some permission flags
//
// swagger:model virtualServices
// An array of virtualService
// swagger:allOf
type VirtualServices struct {
	Permissions ResourcePermissions `json:"permissions"`
	Items       []VirtualService    `json:"items"`
}

// VirtualService virtualService
//
// This type is used for returning a VirtualService
//
// swagger:model virtualService
type VirtualService struct {
	meta_v1.TypeMeta
	Metadata meta_v1.ObjectMeta `json:"metadata"`
	Status map[string]interface{} `json:"status,omitempty"`
	Spec     struct {
		Hosts    interface{} `json:"hosts,omitempty"`
		Gateways interface{} `json:"gateways,omitempty"`
		Http     interface{} `json:"http,omitempty"`
		Tcp      interface{} `json:"tcp,omitempty"`
		Tls      interface{} `json:"tls,omitempty"`
		ExportTo interface{} `json:"exportTo,omitempty"`
	} `json:"spec"`
}

func (vServices *VirtualServices) Parse(virtualServices []kubernetes.IstioObject) {
	vServices.Items = []VirtualService{}
	for _, vs := range virtualServices {
		virtualService := VirtualService{}
		virtualService.Parse(vs)
		vServices.Items = append(vServices.Items, virtualService)
	}
}

func (vService *VirtualService) Parse(virtualService kubernetes.IstioObject) {
	vService.TypeMeta = virtualService.GetTypeMeta()
	vService.Metadata = virtualService.GetObjectMeta()
	vService.Status = virtualService.GetStatus()
	vService.Spec.Hosts = virtualService.GetSpec()["hosts"]
	vService.Spec.Gateways = virtualService.GetSpec()["gateways"]
	vService.Spec.Http = virtualService.GetSpec()["http"]
	vService.Spec.Tls = virtualService.GetSpec()["tls"]
	vService.Spec.Tcp = virtualService.GetSpec()["tcp"]
	vService.Spec.ExportTo = virtualService.GetSpec()["exportTo"]
}

// IsValidHost returns true if VirtualService hosts applies to the service
func (vService *VirtualService) IsValidHost(namespace string, serviceName string) bool {
	if serviceName == "" {
		return false
	}

	protocolNames := []string{"http", "tcp"}
	protocols := map[string]interface{}{
		"http": vService.Spec.Http,
		"tcp":  vService.Spec.Tcp,
	}

	return kubernetes.FilterByRoute(protocols, protocolNames, serviceName, namespace, nil)
}
