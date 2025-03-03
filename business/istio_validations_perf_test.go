package business

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestGetValidationsPerf(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	sNumNs := os.Getenv("NUMNS")
	sNumDr := os.Getenv("NUMDR")
	sNumVs := os.Getenv("NUMVS")
	sNumGw := os.Getenv("NUMGW")
	numNs := 10
	numDr := 10
	numVs := 10
	numGw := 10
	if sNumNs != "" {
		if n, err := strconv.Atoi(sNumNs); err == nil {
			numNs = n
		}
		if n, err := strconv.Atoi(sNumDr); err == nil {
			numDr = n
		}
		if n, err := strconv.Atoi(sNumVs); err == nil {
			numVs = n
		}
		if n, err := strconv.Atoi(sNumGw); err == nil {
			numGw = n
		}
	}

	vs := mockCombinedValidationService(t, conf, fakeIstioConfigListPerf(numNs, numDr, numVs, numGw),
		[]string{"details.test.svc.cluster.local", "product.test.svc.cluster.local", "product2.test.svc.cluster.local", "customer.test.svc.cluster.local"})

	now := time.Now()
	vInfo, err := vs.NewValidationInfo(context.TODO(), []string{conf.KubernetesConfig.ClusterName})
	require.NoError(err)
	validations, err := vs.Validate(context.TODO(), conf.KubernetesConfig.ClusterName, vInfo)
	require.NoError(err)
	log.Debugf("Validation Performance test took %f seconds for %d namespaces", time.Since(now).Seconds(), numNs)
	assert.NotEmpty(validations)
}

func fakeIstioConfigListPerf(numNs, numDr, numVs, numGw int) *models.IstioConfigList {
	istioConfigList := models.IstioConfigList{}

	n := 0
	for n < numNs {
		d := 0
		for d < numDr {
			istioConfigList.DestinationRules = append(istioConfigList.DestinationRules,
				data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"), data.CreateEmptyDestinationRule(fmt.Sprintf("test%d", n), fmt.Sprintf("product-dr%d", d), fmt.Sprintf("product%d", d))),
				data.CreateEmptyDestinationRule(fmt.Sprintf("test%d", n), fmt.Sprintf("customer-dr%d", d), fmt.Sprintf("customer%d", d)))
			d++
		}
		v := 0
		for v < numVs {
			istioConfigList.VirtualServices = append(istioConfigList.VirtualServices,
				data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination(fmt.Sprintf("product-%d", v), "v1", -1),
					data.AddTcpRoutesToVirtualService(data.CreateTcpRoute(fmt.Sprintf("product2-%d", v), "v1", -1),
						data.CreateEmptyVirtualService(fmt.Sprintf("product-vs%d", v), fmt.Sprintf("test%d", n), []string{fmt.Sprintf("product%d", v)}))))
			v++
		}
		g := 0
		for g < numGw {
			istioConfigList.Gateways = append(istioConfigList.Gateways, append(getGateway(fmt.Sprintf("first%d", g), fmt.Sprintf("test%d", n)), getGateway(fmt.Sprintf("second%d", g), fmt.Sprintf("test2%d", n))...)...)
			g++
		}
		n++
	}
	return &istioConfigList
}
