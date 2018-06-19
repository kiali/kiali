package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type Gateways []Gateway
type Gateway struct {
	Name            string      `json:"name"`
	CreatedAt       string      `json:"createdAt"`
	ResourceVersion string      `json:"resourceVersion"`
	Servers         interface{} `json:"servers"`
	Selector        interface{} `json:"selector"`
}

func (gws *Gateways) Parse(gateways []kubernetes.IstioObject) {
	for _, gw := range gateways {
		gateway := Gateway{}
		gateway.Parse(gw)
		*gws = append(*gws, gateway)
	}
}

func (gw *Gateway) Parse(gateway kubernetes.IstioObject) {
	gw.Name = gateway.GetObjectMeta().Name
	gw.CreatedAt = formatTime(gateway.GetObjectMeta().CreationTimestamp.Time)
	gw.ResourceVersion = gateway.GetObjectMeta().ResourceVersion
	gw.Servers = gateway.GetSpec()["servers"]
	gw.Selector = gateway.GetSpec()["selector"]
}
