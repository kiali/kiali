package sidecars

import (
	"fmt"
	"testing"

	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/stretchr/testify/assert"
)

func TestEgressHostFormatCorrect(t *testing.T) {
	assert := assert.New(t)

	validations, valid := EgressHostChecker{
		Services:       fakeServices([]string{"details", "reviews"}),
		ServiceEntries: kubernetes.ServiceEntryHostnames([]kubernetes.IstioObject{data.CreateExternalServiceEntry()}),
		Sidecar: sidecarWithHosts([]interface{}{
			"*/*",
			"~/*",
			"./*",
			"./reviews.bookinfo.svc.cluster.local",
			"./*.bookinfo.svc.cluster.com",
			"./wikipedia.org",
			"bookinfo/*",
			"bookinfo/*.bookinfo.svc.cluster.local",
			"bookinfo/reviews.bookinfo.svc.cluster.local",
			"bookinfo/wikipedia.org",
		}),
	}.Check()

	assert.Empty(validations)
	assert.True(valid)
}

func TestEgressHostCrossNamespace(t *testing.T) {
	assert := assert.New(t)

	hosts := []interface{}{
		"*/*.example.com",
		"*/www.example.com",
		"*/example.prod.svc.cluster.local",
		"~/*.example.com",
		"~/www.example.com",
		"~/example.prod.svc.cluster.local",
		"bookinfo/reviews.bogus.svc.cluster.local",
		"bookinfo/*.bogus.svc.cluster.local",
	}

	validations, valid := EgressHostChecker{
		Sidecar: sidecarWithHosts(hosts),
	}.Check()

	assert.NotEmpty(validations)
	assert.Len(validations, len(hosts))
	assert.True(valid)

	for i, c := range validations {
		assert.Equal(models.Unknown, c.Severity)
		assert.Equal(fmt.Sprintf("spec/egress[0]/hosts[%d]", i), c.Path)
		assert.Equal(models.CheckMessage("validation.unable.cross-namespace"), c.Message)
	}
}

func TestEgressInvalidHostFormat(t *testing.T) {
	assert := assert.New(t)

	validations, valid := EgressHostChecker{
		Sidecar: sidecarWithHosts([]interface{}{
			"no-dash-used",
		}),
	}.Check()

	assert.NotEmpty(validations)
	assert.Len(validations, 1)
	assert.False(valid)

	assert.Equal(models.ErrorSeverity, validations[0].Severity)
	assert.Equal("spec/egress[0]/hosts[0]", validations[0].Path)
	assert.Equal(models.CheckMessage("sidecar.egress.invalidhostformat"), validations[0].Message)
}

func TestEgressServiceNotFound(t *testing.T) {
	assert := assert.New(t)

	validations, valid := EgressHostChecker{
		Sidecar: sidecarWithHosts([]interface{}{
			"bookinfo/boggus.bookinfo.svc.cluster.local",
			"bookinfo/boggus.org",
		}),
	}.Check()

	assert.NotEmpty(validations)
	assert.Len(validations, 2)
	assert.True(valid)

	for i, c := range validations {
		assert.Equal(models.WarningSeverity, c.Severity)
		assert.Equal(fmt.Sprintf("spec/egress[0]/hosts[%d]", i), c.Path)
		assert.Equal(models.CheckMessage("sidecar.egress.servicenotfound"), c.Message)
	}
}

func sidecarWithHosts(hl []interface{}) kubernetes.IstioObject {
	return data.AddHostsToSidecar(hl, data.CreateSidecar("sidecar", "bookinfo"))
}

func fakeServices(serviceNames []string) []core_v1.Service {
	services := make([]core_v1.Service, 0, len(serviceNames))

	for _, sName := range serviceNames {
		service := core_v1.Service{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      sName,
				Namespace: "bookinfo",
				Labels: map[string]string{
					"app":     sName,
					"version": "v1"}},
			Spec: core_v1.ServiceSpec{
				ClusterIP: "fromservice",
				Type:      "ClusterIP",
				Selector:  map[string]string{"app": sName},
			},
		}

		services = append(services, service)
	}

	return services
}
