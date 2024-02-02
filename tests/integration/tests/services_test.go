package tests

import (
	"context"
	"fmt"
	"path"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/kiali/kiali/tests/integration/utils"
	"github.com/kiali/kiali/tests/integration/utils/kiali"
	"github.com/kiali/kiali/tools/cmd"
)

func TestServicesList(t *testing.T) {
	require := require.New(t)
	serviceList, err := kiali.ServicesList(kiali.BOOKINFO)

	require.NoError(err)
	require.NotEmpty(serviceList)
	require.True(len(serviceList.Services) >= 4)
	for _, service := range serviceList.Services {
		require.NotEmpty(service.Name)
		if service.Name == "productpage" {
			require.True(service.IstioSidecar)
			require.True(service.AppLabel)
			require.NotNil(service.Health)
			require.NotNil(service.Health.Requests)
			require.NotNil(service.Health.Requests.Outbound)
			require.NotNil(service.Health.Requests.Inbound)
		}
	}
	require.NotNil(serviceList.Validations)
	require.Equal(kiali.BOOKINFO, serviceList.Namespace.Name)
}

func TestServiceDetails(t *testing.T) {
	name := "productpage"
	require := require.New(t)
	service, _, err := kiali.ServiceDetails(name, kiali.BOOKINFO)

	require.NoError(err)
	require.NotNil(service)
	require.NotNil(service.Service)
	require.Equal(kiali.BOOKINFO, service.Service.Namespace.Name)
	require.NotEmpty(service.Workloads)
	require.NotEmpty(service.Service.Ports)
	require.NotEmpty(service.Service.Ports)
	require.NotNil(service.Endpoints)
	require.NotNil(service.VirtualServices)
	require.NotNil(service.DestinationRules)
	require.NotNil(service.Validations)

	require.NotNil(service.Health)
	require.NotNil(service.Health.Requests)
	require.NotNil(service.Health.Requests.Outbound)
	require.NotNil(service.Health.Requests.Inbound)

	require.True(service.IstioSidecar)
}

func TestServiceDetailsInvalidName(t *testing.T) {
	name := "invalid"
	require := require.New(t)
	app, code, _ := kiali.ServiceDetails(name, kiali.BOOKINFO)
	require.NotEqual(200, code)
	require.Empty(app)
}

func TestServiceDiscoverVS(t *testing.T) {
	require := require.New(t)
	serviceName := "reviews"
	vsName := "reviews"
	vsPath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-reviews-80-20.yaml")
	service, _, err := kiali.ServiceDetails(serviceName, kiali.BOOKINFO)
	require.NoError(err)
	require.NotNil(service)
	preVsCount := len(service.VirtualServices)
	defer utils.DeleteFile(vsPath, kiali.BOOKINFO)
	require.True(utils.ApplyFile(vsPath, kiali.BOOKINFO))
	ctx := context.TODO()

	pollErr := wait.PollUntilContextTimeout(ctx, time.Second, time.Minute, false, func(ctx context.Context) (bool, error) {
		service, _, err = kiali.ServiceDetails(serviceName, kiali.BOOKINFO)
		require.NoError(err)
		require.NotNil(service)
		if len(service.VirtualServices) > preVsCount {
			return true, nil
		}
		return false, nil
	})
	require.Nil(pollErr)
	require.NotEmpty(service.VirtualServices)
	found := false
	for _, vs := range service.VirtualServices {
		if vs.Name == vsName {
			found = true

			http := vs.Spec.Http
			require.NotEmpty(http)
			routes := http[0].Route
			require.Len(routes, 2)

			require.Equal(routes[0].Weight, int32(80))
			destination := routes[0].Destination
			require.NotNil(destination)
			require.Equal(destination.Host, "reviews")
			require.Equal(destination.Subset, "v1")

			require.Equal(routes[1].Weight, int32(20))
			destination = routes[1].Destination
			require.NotNil(destination)
			require.Equal(destination.Host, "reviews")
			require.Equal(destination.Subset, "v2")

			break
		}
	}
	require.True(found)
}

func TestServiceDiscoverDR(t *testing.T) {
	require := require.New(t)
	serviceName := "reviews"
	drName := "reviews"
	drPath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-destination-rule-reviews.yaml")
	service, _, err := kiali.ServiceDetails(serviceName, kiali.BOOKINFO)
	require.NoError(err)
	require.NotNil(service)
	preDrCount := len(service.DestinationRules)
	defer utils.DeleteFile(drPath, kiali.BOOKINFO)
	require.True(utils.ApplyFile(drPath, kiali.BOOKINFO))
	ctx := context.TODO()

	pollErr := wait.PollUntilContextTimeout(ctx, time.Second, time.Minute, false, func(ctx context.Context) (bool, error) {
		service, _, err = kiali.ServiceDetails(serviceName, kiali.BOOKINFO)
		require.NoError(err)
		require.NotNil(service)
		if len(service.DestinationRules) > preDrCount {
			return true, nil
		}
		return false, nil
	})
	require.Nil(pollErr)
	require.NotEmpty(service.DestinationRules)
	found := false
	for _, dr := range service.DestinationRules {
		if dr.Name == drName {
			found = true

			require.NotNil(dr.Spec.TrafficPolicy)
			require.Len(dr.Spec.Subsets, 3)

			for i, subset := range dr.Spec.Subsets {
				require.Equal(subset.Name, fmt.Sprintf("v%d", i+1))

				labels := subset.Labels
				require.NotNil(labels)
				require.Equal(labels["version"], fmt.Sprintf("v%d", i+1))
			}

			break
		}
	}
	require.True(found)
}
