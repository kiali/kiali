package tests

import (
	"path"
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tests/integration/utils"
	"github.com/kiali/kiali/tools/cmd"
)

const DURATION = "60s"
const CB_BADGE = "hasCB"
const VS_BADGE = "hasVS"
const TF_BADGE = "hasTrafficShifting"
const TCP_TF_BADGE = "hasTCPTrafficShifting"
const RT_BADGE = "hasRequestTimeout"
const FI_BADGE = "hasFaultInjection"
const CIRCUIT_BREAKER_FILE = "bookinfo-reviews-all-cb.yaml"
const VIRTUAL_SERVICE_FILE = "bookinfo-ratings-delay.yaml"
const TRAFFIC_SHIFTING_FILE = "bookinfo-traffic-shifting-reviews.yaml"
const TCP_TRAFFIC_SHIFTING_FILE = "bookinfo-tcp-traffic-shifting-reviews.yaml"
const REQUEST_ROUTING_FILE = "bookinfo-request-timeouts-reviews.yaml"
const FAULT_INJECTION_FILE = "bookinfo-fault-injection-reviews.yaml"

var VERSIONED_APP_PARAMS = map[string]string{"graphType": "versionedApp", "duration": DURATION, "injectServiceNodes": "true"}
var WORKLOAD_PARAMS = map[string]string{"graphType": "workload", "duration": DURATION, "injectServiceNodes": "true"}
var APP_PARAMS = map[string]string{"graphType": "app", "duration": DURATION, "injectServiceNodes": "true"}
var SERVICE_PARAMS = map[string]string{"graphType": "service", "duration": DURATION, "injectServiceNodes": "true"}

func TestCBVersionedApp(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(VERSIONED_APP_PARAMS, CIRCUIT_BREAKER_FILE, CB_BADGE, assert)
}

func TestCBWorkload(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(WORKLOAD_PARAMS, CIRCUIT_BREAKER_FILE, CB_BADGE, assert)
}

func TestCBService(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(SERVICE_PARAMS, CIRCUIT_BREAKER_FILE, CB_BADGE, assert)
}

func TestVSVersionedApp(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(VERSIONED_APP_PARAMS, VIRTUAL_SERVICE_FILE, VS_BADGE, assert)
}

func TestVSWorkload(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(WORKLOAD_PARAMS, VIRTUAL_SERVICE_FILE, VS_BADGE, assert)
}

func TestVSApp(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(APP_PARAMS, VIRTUAL_SERVICE_FILE, VS_BADGE, assert)
}

func TestVSService(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(SERVICE_PARAMS, VIRTUAL_SERVICE_FILE, VS_BADGE, assert)
}

func TestTraficShiftingVersionedApp(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(VERSIONED_APP_PARAMS, TRAFFIC_SHIFTING_FILE, TF_BADGE, assert)
}

func TestTcpTraficShiftingVersionedApp(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(VERSIONED_APP_PARAMS, TCP_TRAFFIC_SHIFTING_FILE, TCP_TF_BADGE, assert)
}

func TestRequestTimeoutsVersionedApp(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(VERSIONED_APP_PARAMS, REQUEST_ROUTING_FILE, RT_BADGE, assert)
}

func TestFaultInjectionVersionedApp(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(VERSIONED_APP_PARAMS, FAULT_INJECTION_FILE, FI_BADGE, assert)
}

func TestTrafficShiftingWorkload(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(WORKLOAD_PARAMS, TRAFFIC_SHIFTING_FILE, TF_BADGE, assert)
}

func TestTcpTrafficShiftingWorkload(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(WORKLOAD_PARAMS, TCP_TRAFFIC_SHIFTING_FILE, TCP_TF_BADGE, assert)
}

func TestRequestTimeoutWorkload(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(WORKLOAD_PARAMS, REQUEST_ROUTING_FILE, RT_BADGE, assert)
}

func TestFaultInjectionWorkload(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(WORKLOAD_PARAMS, FAULT_INJECTION_FILE, FI_BADGE, assert)
}

func TestTrafficShiftingApp(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(APP_PARAMS, TRAFFIC_SHIFTING_FILE, TF_BADGE, assert)
}

func TestTcpTrafficShiftingApp(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(APP_PARAMS, TCP_TRAFFIC_SHIFTING_FILE, TCP_TF_BADGE, assert)
}

func TestRequestTimeoutsApp(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(APP_PARAMS, REQUEST_ROUTING_FILE, RT_BADGE, assert)
}

func TestFaultInjectionApp(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(APP_PARAMS, FAULT_INJECTION_FILE, FI_BADGE, assert)
}

func TestTrafficShiftingService(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(SERVICE_PARAMS, TRAFFIC_SHIFTING_FILE, TF_BADGE, assert)
}

func TestTcpTrafficShiftingService(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(SERVICE_PARAMS, TCP_TRAFFIC_SHIFTING_FILE, TCP_TF_BADGE, assert)
}

func TestRequestTimeoutsService(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(SERVICE_PARAMS, REQUEST_ROUTING_FILE, RT_BADGE, assert)
}

func TestFultInjectionService(t *testing.T) {
	assert := assert.New(t)
	assertGraphBadges(SERVICE_PARAMS, FAULT_INJECTION_FILE, FI_BADGE, assert)
}

func assertGraphBadges(params map[string]string, yaml, badge string, assert *assert.Assertions) {
	params["namespaces"] = utils.BOOKINFO
	filePath := path.Join(cmd.KialiProjectRoot, utils.ASSETS+"/"+yaml)
	preBadgeCount := BadgeCount(params, badge)
	defer utils.DeleteFile(filePath, utils.BOOKINFO)
	assert.True(utils.ApplyFile(filePath, utils.BOOKINFO))

	pollErr := wait.Poll(time.Second, time.Minute, func() (bool, error) {
		badgeCount := BadgeCount(params, badge)
		if badgeCount > preBadgeCount {
			return true, nil
		}
		return false, nil
	})
	assert.Nil(pollErr, "Badge %s should exist", badge)
}

func BadgeCount(params map[string]string, badge string) int {
	count := 0
	graph, statusCode, err := utils.Graph(params)
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
