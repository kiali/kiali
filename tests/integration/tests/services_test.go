package tests

import (
	"context"
	"fmt"
	"path"
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/tests/integration/utils"
	"github.com/kiali/kiali/tests/integration/utils/kiali"
	"github.com/kiali/kiali/tools/cmd"
)

func TestServicesList(t *testing.T) {
	assert := assert.New(t)
	serviceList, err := kiali.ServicesList(kiali.BOOKINFO)

	assert.Nil(err)
	assert.NotEmpty(serviceList)
	assert.True(len(serviceList.Services) >= 4)
	for _, service := range serviceList.Services {
		assert.NotEmpty(service.Name)
		assert.True(service.IstioSidecar)
		assert.True(service.AppLabel)
		assert.NotNil(service.Health)
		assert.NotNil(service.Health.Requests)
		assert.NotNil(service.Health.Requests.Outbound)
		assert.NotNil(service.Health.Requests.Inbound)
	}
	assert.NotNil(serviceList.Validations)
	assert.Equal(kiali.BOOKINFO, serviceList.Namespace.Name)
}

func TestServiceDetails(t *testing.T) {
	name := "productpage"
	assert := assert.New(t)
	service, _, err := kiali.ServiceDetails(name, kiali.BOOKINFO)

	assert.Nil(err)
	assert.NotNil(service)
	assert.NotNil(service.Service)
	assert.Equal(kiali.BOOKINFO, service.Service.Namespace.Name)
	assert.NotEmpty(service.Workloads)
	assert.NotEmpty(service.Service.Ports)
	assert.NotEmpty(service.Service.Ports)
	assert.NotNil(service.Endpoints)
	assert.NotNil(service.VirtualServices)
	assert.NotNil(service.DestinationRules)
	assert.NotNil(service.Validations)

	assert.NotNil(service.Health)
	assert.NotNil(service.Health.Requests)
	assert.NotNil(service.Health.Requests.Outbound)
	assert.NotNil(service.Health.Requests.Inbound)

	assert.True(service.IstioSidecar)
}

func TestServiceDetailsInvalidName(t *testing.T) {
	name := "invalid"
	assert := assert.New(t)
	app, code, _ := kiali.ServiceDetails(name, kiali.BOOKINFO)
	assert.NotEqual(200, code)
	assert.Empty(app)
}

func TestServiceDiscoverVS(t *testing.T) {
	assert := assert.New(t)
	serviceName := "reviews"
	vsName := "reviews"
	vsPath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-reviews-80-20.yaml")
	service, _, err := kiali.ServiceDetails(serviceName, kiali.BOOKINFO)
	assert.Nil(err)
	assert.NotNil(service)
	preVsCount := len(service.VirtualServices)
	defer utils.DeleteFile(vsPath, kiali.BOOKINFO)
	assert.True(utils.ApplyFile(vsPath, kiali.BOOKINFO))
	ctx := context.TODO()

	pollErr := wait.PollUntilContextTimeout(ctx, time.Second, time.Minute, false, func(ctx context.Context) (bool, error) {
		service, _, err = kiali.ServiceDetails(serviceName, kiali.BOOKINFO)
		assert.Nil(err)
		assert.NotNil(service)
		if len(service.VirtualServices) > preVsCount {
			return true, nil
		}
		return false, nil
	})
	assert.Nil(pollErr)
	assert.NotEmpty(service.VirtualServices)
	found := false
	for _, vs := range service.VirtualServices {
		if vs.Name == vsName {
			found = true

			http := vs.Spec.Http
			assert.NotEmpty(http)
			routes := http[0].Route
			assert.Len(routes, 2)

			assert.Equal(routes[0].Weight, int32(80))
			destination := routes[0].Destination
			assert.NotNil(destination)
			assert.Equal(destination.Host, "reviews")
			assert.Equal(destination.Subset, "v1")

			assert.Equal(routes[1].Weight, int32(20))
			destination = routes[1].Destination
			assert.NotNil(destination)
			assert.Equal(destination.Host, "reviews")
			assert.Equal(destination.Subset, "v2")

			break
		}
	}
	assert.True(found)
}

func TestServiceDiscoverDR(t *testing.T) {
	assert := assert.New(t)
	serviceName := "reviews"
	drName := "reviews"
	drPath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-destination-rule-reviews.yaml")
	service, _, err := kiali.ServiceDetails(serviceName, kiali.BOOKINFO)
	assert.Nil(err)
	assert.NotNil(service)
	preDrCount := len(service.DestinationRules)
	defer utils.DeleteFile(drPath, kiali.BOOKINFO)
	assert.True(utils.ApplyFile(drPath, kiali.BOOKINFO))
	ctx := context.TODO()

	pollErr := wait.PollUntilContextTimeout(ctx, time.Second, time.Minute, false, func(ctx context.Context) (bool, error) {
		service, _, err = kiali.ServiceDetails(serviceName, kiali.BOOKINFO)
		assert.Nil(err)
		assert.NotNil(service)
		if len(service.DestinationRules) > preDrCount {
			return true, nil
		}
		return false, nil
	})
	assert.Nil(pollErr)
	assert.NotEmpty(service.DestinationRules)
	found := false
	for _, dr := range service.DestinationRules {
		if dr.Name == drName {
			found = true

			assert.NotNil(dr.Spec.TrafficPolicy)
			assert.Len(dr.Spec.Subsets, 3)

			for i, subset := range dr.Spec.Subsets {
				assert.Equal(subset.Name, fmt.Sprintf("v%d", i+1))

				labels := subset.Labels
				assert.NotNil(labels)
				assert.Equal(labels["version"], fmt.Sprintf("v%d", i+1))
			}

			break
		}
	}
	assert.True(found)
}
