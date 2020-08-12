package business

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type ProxyStatus struct {
	k8s kubernetes.ClientInterface
}

// GetWorkloadProxyStatus returns the proxy status of the workload defined by the name and namespace
func (in *ProxyStatus) GetWorkloadProxyStatus(workloadName, namespace string) (int32, error) {
	proxyStatuses, err := in.k8s.GetProxyStatus()
	if err != nil {
		return int32(0), err
	}

	return hasWorkloadProxiesSynced(getProxyStatusByName(workloadName, namespace, proxyStatuses)), nil
}

// GetWorkloadsProxyStatus returns all the proxy statuses of each workload with name in the `workloadNames` array
// The returning map uses as a key the name of the workload. Each value is its associated ProxyStatus.
func (in *ProxyStatus) GetWorkloadsProxyStatus(namespace string, workloadNames []string) (map[string]int32, error) {
	statuses := map[string]int32{}

	proxyStatuses, err := in.k8s.GetProxyStatus()
	if err != nil {
		return map[string]int32{}, err
	}

	for _, ws := range workloadNames {
		statuses[ws] = hasWorkloadProxiesSynced(getProxyStatusByName(ws, namespace, proxyStatuses))
	}

	return statuses, nil
}

// getProxyStatusByName returns selects the raw ProxyStatus of the workload specified by name and namespace
func getProxyStatusByName(name, namespace string, proxyStatus []*kubernetes.ProxyStatus) map[string][]models.ProxyStatus {
	workloadsStatus := map[string][]models.ProxyStatus{}

	for _, ps := range proxyStatus {
		if strings.HasPrefix(ps.ProxyID, name) && strings.HasSuffix(ps.ProxyID, namespace) {
			workloadsStatus[ps.ProxyID] = castProxyStatus(*ps)
		}
	}

	return workloadsStatus
}

func hasWorkloadProxiesSynced(proxyStatuses map[string][]models.ProxyStatus) int32 {
	synced := int32(0)
	for _, ps := range proxyStatuses {
		if len(ps) == 0 {
			synced = synced + 1
		}
	}
	return synced
}

func castProxyStatus(ps kubernetes.ProxyStatus) []models.ProxyStatus {
	statuses := make([]models.ProxyStatus, 0, 4)

	r := reflect.ValueOf(ps)
	for component, key := range map[string]string{"Cluster": "CDS", "Endpoint": "EDS", "Listener": "LDS", "Route": "RDS"} {
		cSent := reflect.Indirect(r).FieldByName(fmt.Sprintf("%s%s", component, "Sent")).String()
		cAck := reflect.Indirect(r).FieldByName(fmt.Sprintf("%s%s", component, "Acked")).String()
		if xdsStatus := xdsStatus(cSent, cAck); xdsStatus != models.Synced {
			statuses = append(statuses, models.ProxyStatus{
				Component: key,
				Status:    xdsStatus,
			})
		}
	}

	return statuses
}

func xdsStatus(sent, acked string) models.ProxyStatuses {
	if sent == "" {
		return models.NotSent
	}
	if sent == acked {
		return models.Synced
	}
	// acked will be empty string when there is never Acknowledged
	if acked == "" {
		return models.StaleNa
	}
	// Since the Nonce changes to uuid, so there is no more any time diff info
	return models.Stale
}
