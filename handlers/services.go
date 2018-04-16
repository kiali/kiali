package handlers

import (
	"net/http"

	"github.com/gorilla/mux"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/services/business"
	"github.com/kiali/kiali/services/models"
	"github.com/kiali/kiali/graph/tree"
	"strings"
)

// ServiceList is the API handler to fetch the list of services in a given namespace
func ServiceList(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	// Get business layer
	business, err := business.Get()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	namespace := params["namespace"]
	queryParams := r.URL.Query()
	ratesInterval := "1m"
	if rateIntervals, ok := queryParams["rateInterval"]; ok && len(rateIntervals) > 0 {
		ratesInterval = rateIntervals[0]
	}

	// Fetch and build services
	serviceList, err := business.Svc.GetServiceList(namespace, ratesInterval)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, serviceList)
}

// ServiceMetrics is the API handler to fetch metrics to be displayed, related to a single service
func ServiceMetrics(w http.ResponseWriter, r *http.Request) {
	getServiceMetrics(w, r, prometheus.NewClient)
}

// getServiceMetrics (mock-friendly version)
func getServiceMetrics(w http.ResponseWriter, r *http.Request, promClientSupplier func() (*prometheus.Client, error)) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	service := vars["service"]

	params, err := extractServiceMetricsQuery(r, namespace, service)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	prometheusClient, err := promClientSupplier()
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusServiceUnavailable, "Prometheus client error: "+err.Error())
		return
	}
	metrics := prometheusClient.GetServiceMetrics(params)
	RespondWithJSON(w, http.StatusOK, metrics)
}

// ServiceHealth is the API handler to get health of a single service
func ServiceHealth(w http.ResponseWriter, r *http.Request) {
	// Get business layer
	business, err := business.Get()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	vars := mux.Vars(r)
	namespace := vars["namespace"]
	service := vars["service"]

	health := business.Health.GetServiceHealth(namespace, service)
	RespondWithJSON(w, http.StatusOK, health)
}

// ServiceDetails is the API handler to fetch full details of an specific service
func ServiceDetails(w http.ResponseWriter, r *http.Request) {
	// Get business layer
	business, err := business.Get()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	params := mux.Vars(r)
	svcName := params["service"]
	nSpace := params["namespace"]
	service, err := business.Svc.GetService(nSpace, svcName)
	if err != nil {
		if errors.IsNotFound(err) {
			RespondWithError(w, http.StatusNotFound, err.Error())
		} else if statusError, isStatus := err.(*errors.StatusError); isStatus {
			RespondWithError(w, http.StatusInternalServerError, statusError.ErrStatus.Message)
		} else {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// If we don't have an explicit RR, create them on the fly
	if service.RouteRules == nil {

		// read the graph to see where we are talking to
		trees := TreesService(nSpace,svcName)
		svcNamePfix := svcName + "." + nSpace
		for _, tree := range trees {
			result := findNode(&tree, svcNamePfix)
			if result != nil {
				populateRule(service,result, svcNamePfix)
			}
		}
	}

	RespondWithJSON(w, http.StatusOK, service)
}
func populateRule(service *models.Service, node *tree.ServiceNode, sname string) {
	// 1st find different destinations
	tmp := make(map[string]int, len(node.Children))
	log.Debugf("Found %d children", len(node.Children))
	for _, n := range node.Children {
		_, ok := tmp[n.Name]
		if ok {
			tmp[n.Name]++
		} else {
			tmp[n.Name] = 1
		}
	}

	// now loop over destinations and find services
	for k := range tmp {

		count := tmp[k]
		rule := models.RouteRule{}

		t := k
		t = strings.TrimSuffix(t,".svc.cluster.local")
		destMap := make(map[string]string,1)
		destMap["name"] = t
		rule.Destination = destMap

		rule.Precedence = 1

		var weightList  []interface{}

		for _,n := range node.Children {
			if n.Name == k {
				weightMap := make(map[string]interface{}, 2)
				weightMap["weight"] = 100/count
				labelContent := make(map[string]string, 1)
				labelContent["version"] = n.Version
				weightMap["labels"] = labelContent
				weightList = append(weightList, weightMap)
			}
		}

		rule.Route = weightList

		rule.Name = sname + "_" + t +"_synth"
		log.Debugf("New rule: %s", rule)
		service.RouteRules = append(service.RouteRules, rule)
	}
}

func findNode(node *tree.ServiceNode, svcNamePfix string) (result *tree.ServiceNode) {

	log.Debug(node)
	if strings.HasPrefix(node.Name, svcNamePfix) {
		//div := len(node.Children)
		//synthRR.Destination := make(map[],div)
		log.Debugf("Found %s " , node)
		return node
	}
	if node.Children != nil {
		for _, c := range node.Children {
			return findNode(c, svcNamePfix)
		}
	}
	return nil

}
