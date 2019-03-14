package data

import (
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func CreateEmptyGateway(name, namespace string, selector map[string]string) kubernetes.IstioObject {
	iSelector := make(map[string]interface{}, len(selector))
	for k, v := range selector {
		iSelector[k] = v
	}
	gateway := kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:        name,
			Namespace:   namespace,
			ClusterName: config.Get().ExternalServices.Istio.IstioIdentityDomain,
		},
		Spec: map[string]interface{}{
			"selector": iSelector,
		},
	}
	return &gateway
}

func AddServerToGateway(server map[string]interface{}, gw kubernetes.IstioObject) kubernetes.IstioObject {
	if serversTypeExists, found := gw.GetSpec()["servers"]; found {
		if serversTypeCasted, ok := serversTypeExists.([]interface{}); ok {
			serversTypeCasted = append(serversTypeCasted, server)
			gw.GetSpec()["servers"] = serversTypeCasted
		}
	} else {
		gw.GetSpec()["servers"] = []interface{}{server}
	}
	return gw
}

func CreateServer(hosts []string, port uint32, portName, protocolName string) map[string]interface{} {
	hostSlice := make([]interface{}, 0, len(hosts))
	for _, h := range hosts {
		hostSlice = append(hostSlice, h)
	}
	return map[string]interface{}{
		"port":  CreateEmptyPortDefinition(port, portName, protocolName),
		"hosts": hostSlice,
	}
}

func AddGatewaysToVirtualService(gateways []string, vs kubernetes.IstioObject) kubernetes.IstioObject {
	gates := make([]interface{}, 0, len(gateways))
	for _, v := range gateways {
		gates = append(gates, v)
	}
	vs.GetSpec()["gateways"] = gates
	return vs
}
