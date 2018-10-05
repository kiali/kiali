package data

import (
	"github.com/kiali/kiali/kubernetes"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func CreateEmptyGateway(name string, selector map[string]string) kubernetes.IstioObject {
	iSelector := make(map[string]interface{}, len(selector))
	for k, v := range selector {
		iSelector[k] = v
	}
	gateway := kubernetes.Gateway{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: name,
		},
		Spec: map[string]interface{}{
			"selector": iSelector,
		},
	}
	return &gateway
}

func AddGatewaysToVirtualService(gateways []string, vs kubernetes.IstioObject) kubernetes.IstioObject {
	gates := make([]interface{}, 0, len(gateways))
	for _, v := range gateways {
		gates = append(gates, v)
	}
	vs.GetSpec()["gateways"] = gates
	return vs
}
