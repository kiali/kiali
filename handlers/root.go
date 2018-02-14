package handlers

import (
	"fmt"
	"net/http"

	"github.com/swift-sunshine/swscore/kubernetes"
	"github.com/swift-sunshine/swscore/log"
	"github.com/swift-sunshine/swscore/prometheus"
)

// This method shows how to use the API to fetch and print all info that would be necessary
// for listing services and details
// It is temporal, so don't be afraid to delete it when handlers are in place
func demoFetchAllServicesAndPrintThem(w http.ResponseWriter) {
	istioClient, err := kubernetes.NewClient()
	if err != nil {
		log.Error(err)
		return
	}
	prometheusClient, err := prometheus.NewClient()
	if err != nil {
		log.Error(err)
		return
	}

	namespaces, err := istioClient.GetNamespaces()
	if err != nil {
		log.Error(err)
		return
	}
	fmt.Fprintf(w, "Namespaces: %v \n\n", namespaces)

	for _, namespace := range namespaces {
		services, err := istioClient.GetServices(namespace)
		if err != nil {
			log.Error(err)
			return
		}
		fmt.Fprintf(w, "Namespace: %s Services %v \n\n", namespace, services)

		for _, service := range services {
			fmt.Fprintf(w, "Service Name: %s \n", service)
			details, err := istioClient.GetServiceDetails(namespace, service)
			if err != nil {
				log.Error(err)
				return
			}

			fmt.Fprintf(w, "Service Labels: \n")
			for key, value := range details.Service.Labels {
				fmt.Fprintf(w, "%s = %s \n", key, value)
			}
			fmt.Fprintf(w, "Type: %s \n", details.Service.Spec.Type)
			fmt.Fprintf(w, "IP: %s \n", details.Service.Spec.ClusterIP)

			fmt.Fprintf(w, "Ports: \n")
			for _, port := range details.Service.Spec.Ports {
				fmt.Fprintf(w, "%s %d %s \n", port.Protocol, port.Port, port.Name)
			}

			fmt.Fprintf(w, "Endpoints: \n")
			for _, subset := range details.Endpoints.Subsets {
				for _, address := range subset.Addresses {
					fmt.Fprintf(w, "Address: %s \n", address.IP)
					if address.TargetRef != nil {
						fmt.Fprintf(w, "Kind: %s \n", address.TargetRef.Kind)
						fmt.Fprintf(w, "Name: %s \n", address.TargetRef.Name)
					}
				}
				for _, port := range subset.Ports {
					fmt.Fprintf(w, "Port: %d \n", port.Port)
					fmt.Fprintf(w, "Protocol: %s \n", port.Protocol)
					fmt.Fprintf(w, "Name: %s \n", port.Name)
				}
			}

			fmt.Fprintf(w, "Pods: \n")
			for _, pod := range details.Pods {
				fmt.Fprintf(w, "Pod: %s \n", pod.Name)
				fmt.Fprintf(w, "Pod Labels: \n")
				for key, value := range pod.Labels {
					fmt.Fprintf(w, "%s = %s \n", key, value)
				}
			}

			fmt.Fprintf(w, "Istio Rules: \n")
			if istioDetails, err := istioClient.GetIstioDetails(namespace, service); err != nil {
				log.Error(err)
				return
			} else {
				for _, rule := range istioDetails.RouteRules {
					fmt.Fprintf(w, "RouteRule: %+v \n", rule.Spec)
				}
			}

			fmt.Fprintf(w, "Dependencies: \n")
			if incomeServices, err := prometheusClient.GetSourceServices(namespace, service); err != nil {
				log.Error(err)
				return
			} else {
				for dest, origin := range incomeServices {
					fmt.Fprintf(w, "To: %s, From: %s \n", dest, origin)
				}
			}

			fmt.Fprint(w, "\n")
		}
	}
}

func Root(w http.ResponseWriter, r *http.Request) {
	demoFetchAllServicesAndPrintThem(w)
	log.Info("ROOT HANDLER CALLED!")
}
