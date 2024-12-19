package tests

import (
	"context"
	"path"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tests/integration/utils"
	"github.com/kiali/kiali/tests/integration/utils/kiali"
	"github.com/kiali/kiali/tools/cmd"
)

const (
	DURATION                  = "60s"
	CB_BADGE                  = "hasCB"
	VS_BADGE                  = "hasVS"
	TF_BADGE                  = "hasTrafficShifting"
	TCP_TF_BADGE              = "hasTCPTrafficShifting"
	RT_BADGE                  = "hasRequestTimeout"
	FI_BADGE                  = "hasFaultInjection"
	CIRCUIT_BREAKER_FILE      = "bookinfo-reviews-all-cb.yaml"
	VIRTUAL_SERVICE_FILE      = "bookinfo-ratings-delay.yaml"
	TRAFFIC_SHIFTING_FILE     = "bookinfo-traffic-shifting-reviews.yaml"
	TCP_TRAFFIC_SHIFTING_FILE = "bookinfo-tcp-traffic-shifting-reviews.yaml"
	REQUEST_ROUTING_FILE      = "bookinfo-request-timeouts-reviews.yaml"
	FAULT_INJECTION_FILE      = "bookinfo-fault-injection-reviews.yaml"
)

var (
	VERSIONED_APP_PARAMS = map[string]string{"graphType": "versionedApp", "duration": DURATION, "injectServiceNodes": "true"}
	WORKLOAD_PARAMS      = map[string]string{"graphType": "workload", "duration": DURATION, "injectServiceNodes": "true"}
	APP_PARAMS           = map[string]string{"graphType": "app", "duration": DURATION, "injectServiceNodes": "true"}
	SERVICE_PARAMS       = map[string]string{"graphType": "service", "duration": DURATION, "injectServiceNodes": "true"}
)

func TestCBVersionedApp(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(VERSIONED_APP_PARAMS, CIRCUIT_BREAKER_FILE, CB_BADGE, require)
}

func TestCBWorkload(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(WORKLOAD_PARAMS, CIRCUIT_BREAKER_FILE, CB_BADGE, require)
}

func TestCBService(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(SERVICE_PARAMS, CIRCUIT_BREAKER_FILE, CB_BADGE, require)
}

func TestVSVersionedApp(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(VERSIONED_APP_PARAMS, VIRTUAL_SERVICE_FILE, VS_BADGE, require)
}

func TestVSWorkload(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(WORKLOAD_PARAMS, VIRTUAL_SERVICE_FILE, VS_BADGE, require)
}

func TestVSApp(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(APP_PARAMS, VIRTUAL_SERVICE_FILE, VS_BADGE, require)
}

func TestVSService(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(SERVICE_PARAMS, VIRTUAL_SERVICE_FILE, VS_BADGE, require)
}

func TestTraficShiftingVersionedApp(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(VERSIONED_APP_PARAMS, TRAFFIC_SHIFTING_FILE, TF_BADGE, require)
}

func TestTcpTraficShiftingVersionedApp(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(VERSIONED_APP_PARAMS, TCP_TRAFFIC_SHIFTING_FILE, TCP_TF_BADGE, require)
}

func TestRequestTimeoutsVersionedApp(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(VERSIONED_APP_PARAMS, REQUEST_ROUTING_FILE, RT_BADGE, require)
}

func TestFaultInjectionVersionedApp(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(VERSIONED_APP_PARAMS, FAULT_INJECTION_FILE, FI_BADGE, require)
}

func TestTrafficShiftingWorkload(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(WORKLOAD_PARAMS, TRAFFIC_SHIFTING_FILE, TF_BADGE, require)
}

func TestTcpTrafficShiftingWorkload(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(WORKLOAD_PARAMS, TCP_TRAFFIC_SHIFTING_FILE, TCP_TF_BADGE, require)
}

func TestRequestTimeoutWorkload(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(WORKLOAD_PARAMS, REQUEST_ROUTING_FILE, RT_BADGE, require)
}

func TestFaultInjectionWorkload(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(WORKLOAD_PARAMS, FAULT_INJECTION_FILE, FI_BADGE, require)
}

func TestTrafficShiftingApp(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(APP_PARAMS, TRAFFIC_SHIFTING_FILE, TF_BADGE, require)
}

func TestTcpTrafficShiftingApp(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(APP_PARAMS, TCP_TRAFFIC_SHIFTING_FILE, TCP_TF_BADGE, require)
}

func TestRequestTimeoutsApp(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(APP_PARAMS, REQUEST_ROUTING_FILE, RT_BADGE, require)
}

func TestFaultInjectionApp(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(APP_PARAMS, FAULT_INJECTION_FILE, FI_BADGE, require)
}

func TestTrafficShiftingService(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(SERVICE_PARAMS, TRAFFIC_SHIFTING_FILE, TF_BADGE, require)
}

func TestTcpTrafficShiftingService(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(SERVICE_PARAMS, TCP_TRAFFIC_SHIFTING_FILE, TCP_TF_BADGE, require)
}

func TestRequestTimeoutsService(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(SERVICE_PARAMS, REQUEST_ROUTING_FILE, RT_BADGE, require)
}

func TestFultInjectionService(t *testing.T) {
	require := require.New(t)
	assertGraphBadges(SERVICE_PARAMS, FAULT_INJECTION_FILE, FI_BADGE, require)
}

func assertGraphBadges(params map[string]string, yaml, badge string, require *require.Assertions) {
	params["namespaces"] = kiali.BOOKINFO
	filePath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/"+yaml)
	preBadgeCount := BadgeCount(params, badge)
	defer utils.DeleteFile(filePath, kiali.BOOKINFO)
	require.True(utils.ApplyFile(filePath, kiali.BOOKINFO))
	ctx := context.TODO()
	pollErr := wait.PollUntilContextTimeout(ctx, time.Second, time.Minute, false, func(ctx context.Context) (bool, error) {
		badgeCount := BadgeCount(params, badge)
		if badgeCount > preBadgeCount {
			return true, nil
		}
		return false, nil
	})
	require.Nil(pollErr, "Badge %s should exist", badge)
}

func BadgeCount(params map[string]string, badge string) int {
	count := 0
	graph, statusCode, err := kiali.Graph(params)
	if statusCode != 200 {
		log.Debugf("Graph response status code %d and error %s", statusCode, err)
		return 0
	}
	for _, node := range graph.Elements.Nodes {
		switch badge {
		case "hasCB":
			if node.Data.HasCB {
				count = count + 1
			}
		case "hasVS":
			if node.Data.HasVS != nil && len(node.Data.HasVS.Hostnames) >= 0 {
				count = count + 1
			}
		case "hasTrafficShifting":
			if node.Data.HasTrafficShifting {
				count = count + 1
			}
		case "hasTCPTrafficShifting":
			if node.Data.HasTCPTrafficShifting {
				count = count + 1
			}
		case "hasRequestTimeout":
			if node.Data.HasRequestTimeout {
				count = count + 1
			}
		case "hasFaultInjection":
			if node.Data.HasFaultInjection {
				count = count + 1
			}

		}
	}

	return count
}
