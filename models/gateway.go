package models

import "github.com/kiali/kiali/kubernetes"

type Gateways []Gateway
type Gateway struct {
	IstioBase
	Spec struct {
		Servers  interface{} `json:"servers"`
		Selector interface{} `json:"selector"`
	} `json:"spec"`
}

func (gws *Gateways) Parse(gateways []kubernetes.IstioObject) {
	for _, gw := range gateways {
		gateway := Gateway{}
		gateway.Parse(gw)
		*gws = append(*gws, gateway)
	}
}

func (gw *Gateway) Parse(gateway kubernetes.IstioObject) {
	gw.IstioBase.Parse(gateway)
	gw.Spec.Servers = gateway.GetSpec()["servers"]
	gw.Spec.Selector = gateway.GetSpec()["selector"]
}
