package sidecars

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestEgressHostFormatCorrect(t *testing.T) {
	assert := assert.New(t)

	c := config.Get()
	c.ExternalServices.Istio.IstioIdentityDomain = "svc.cluster.local"
	config.Set(c)

	fakeServices := data.CreateFakeMultiServices([]string{"details.bookinfo.svc.cluster.local", "reviews.bookinfo.svc.cluster.local"}, "bookinfo")
	vals, valid := EgressHostChecker{
		Conf:             config.Get(),
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, config.Get()),
		ServiceEntries:   kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{data.CreateExternalServiceEntry()}),
		Sidecar: sidecarWithHosts([]string{
			"*/*",
			"~/*",
			"./*",
			"./reviews.bookinfo.svc.cluster.local",
			"./*.bookinfo.svc.cluster.local",
			"./wikipedia.org",
			"bookinfo/*",
			"bookinfo/*.bookinfo.svc.cluster.local",
			"bookinfo/reviews.bookinfo.svc.cluster.local",
			"bookinfo/wikipedia.org",
		}),
	}.Check()

	assert.Empty(vals)
	assert.True(valid)
}

func TestEgressHostNotFoundService(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeServicesWithSelector("reviews", "bookinfo")
	vals, valid := EgressHostChecker{
		Conf:             config.Get(),
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, config.Get()),
		ServiceEntries:   kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{data.CreateExternalServiceEntry()}),
		Sidecar: sidecarWithHosts([]string{
			"bookinfo2/reviews.bookinfo2.svc.cluster.local",
		}),
	}.Check()

	assert.NotEmpty(vals)
	assert.True(valid)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.Equal("spec/egress[0]/hosts[0]", vals[0].Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("sidecar.egress.servicenotfound", vals[0]))
}

func TestEgressHostNotFoundWronglyExportedService(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"reviews.bookinfo2.svc.cluster.local"}, "bookinfo")
	vals, valid := EgressHostChecker{
		Conf:             config.Get(),
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, config.Get()),
		ServiceEntries:   kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{data.CreateExternalServiceEntry()}),
		Sidecar: sidecarWithHosts([]string{
			"bookinfo2/reviews.bookinfo2.svc.cluster.local",
		}),
	}.Check()

	assert.NotEmpty(vals)
	assert.True(valid)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.Equal("spec/egress[0]/hosts[0]", vals[0].Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("sidecar.egress.servicenotfound", vals[0]))
}

func TestEgressHostFoundExportedService(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	fakeServices := data.CreateFakeMultiServices([]string{"reviews.bookinfo2.svc.cluster.local"}, "bookinfo2")
	fakeServices[0].Annotations = map[string]string{kubernetes.ExportToAnnotation: "*"}
	vals, valid := EgressHostChecker{
		Conf:             conf,
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, conf),
		ServiceEntries:   kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{data.CreateExternalServiceEntry()}),
		Sidecar: sidecarWithHosts([]string{
			"bookinfo2/reviews.bookinfo2.svc.cluster.local",
		}),
	}.Check()

	assert.Empty(vals)
	assert.True(valid)
}

func TestEgressHostFoundLocalService(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	fakeServices := data.CreateFakeMultiServices([]string{"reviews.bookinfo2.svc.cluster.local"}, "bookinfo2")
	vals, valid := EgressHostChecker{
		Conf:             conf,
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, conf),
		ServiceEntries:   kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{data.CreateExternalServiceEntry()}),
		Sidecar: sidecarWithHosts([]string{
			"bookinfo2/reviews.bookinfo2.svc.cluster.local",
		}),
	}.Check()

	assert.Empty(vals)
	assert.True(valid)
}

func TestEgressExportedInternalServiceEntryPresent(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"wrong.bookinfo.svc.cluster.local"}, "bookinfo")
	vals, valid := EgressHostChecker{
		Conf:             config.Get(),
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, config.Get()),
		ServiceEntries:   kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{data.CreateEmptyMeshInternalServiceEntry("details-se", "bookinfo3", []string{"details.bookinfo2.svc.cluster.local"})}),
		Sidecar: sidecarWithHosts([]string{
			"bookinfo/details.bookinfo2.svc.cluster.local",
		}),
	}.Check()

	assert.Empty(vals)
	assert.True(valid)
}

func TestEgressExportedExternalServiceEntryPresent(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"wrong.bookinfo.svc.cluster.local"}, "bookinfo")
	vals, valid := EgressHostChecker{
		Conf:             config.Get(),
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, config.Get()),
		ServiceEntries:   kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{data.CreateEmptyMeshExternalServiceEntry("details-se", "bookinfo3", []string{"www.myhost.com"})}),
		Sidecar: sidecarWithHosts([]string{
			"bookinfo/www.myhost.com",
		}),
	}.Check()

	assert.Empty(vals)
	assert.True(valid)
}

func TestWildcardHostEgressExportedExternalServiceEntryNotPresent(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"wrong.bookinfo.svc.cluster.local"}, "bookinfo")
	vals, valid := EgressHostChecker{
		Conf:             config.Get(),
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, config.Get()),
		ServiceEntries:   kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{data.CreateEmptyMeshExternalServiceEntry("details-se", "bookinfo3", []string{"www.myhost.com"})}),
		Sidecar: sidecarWithHosts([]string{
			"bookinfo/*.myhost.com",
		}),
	}.Check()

	assert.NotEmpty(vals)
	assert.True(valid)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.Equal("spec/egress[0]/hosts[0]", vals[0].Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("sidecar.egress.servicenotfound", vals[0]))
}

func TestEgressExportedExternalWildcardServiceEntryPresent(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"wrong.bookinfo.svc.cluster.local"}, "bookinfo")
	vals, valid := EgressHostChecker{
		Conf:             config.Get(),
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, config.Get()),
		ServiceEntries:   kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{data.CreateEmptyMeshExternalServiceEntry("details-se", "bookinfo3", []string{"*.myhost.com"})}),
		Sidecar: sidecarWithHosts([]string{
			"bookinfo/www.myhost.com",
		}),
	}.Check()

	assert.Empty(vals)
	assert.True(valid)
}

func TestEgressExportedInternalServiceEntryNotPresent(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"wrong.bookinfo.svc.cluster.local"}, "bookinfo")
	vals, valid := EgressHostChecker{
		Conf:             config.Get(),
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, config.Get()),
		ServiceEntries:   kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{data.CreateEmptyMeshInternalServiceEntry("details-se", "bookinfo3", []string{"details.bookinfo2.svc.cluster.local"})}),
		Sidecar: sidecarWithHosts([]string{
			"bookinfo/details.bookinfo.svc.cluster.local",
		}),
	}.Check()

	assert.NotEmpty(vals)
	assert.True(valid)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.Equal("spec/egress[0]/hosts[0]", vals[0].Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("sidecar.egress.servicenotfound", vals[0]))
}

func TestEgressExportedExternalServiceEntryNotPresent(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"wrong.bookinfo.svc.cluster.local"}, "bookinfo")
	vals, valid := EgressHostChecker{
		Conf:             config.Get(),
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, config.Get()),
		ServiceEntries:   kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{data.CreateEmptyMeshExternalServiceEntry("details-se", "bookinfo3", []string{"www.myhost.com"})}),
		Sidecar: sidecarWithHosts([]string{
			"bookinfo/www.wrong.com",
		}),
	}.Check()

	assert.NotEmpty(vals)
	assert.True(valid)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.Equal("spec/egress[0]/hosts[0]", vals[0].Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("sidecar.egress.servicenotfound", vals[0]))
}

func TestEgressExportedWildcardInternalServiceEntryPresent(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"wrong.bookinfo.svc.cluster.local"}, "bookinfo")
	vals, valid := EgressHostChecker{
		Conf:             config.Get(),
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, config.Get()),
		ServiceEntries:   kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{data.CreateEmptyMeshInternalServiceEntry("details-se", "bookinfo3", []string{"*.bookinfo2.svc.cluster.local"})}),
		Sidecar: sidecarWithHosts([]string{
			"bookinfo/details.bookinfo2.svc.cluster.local",
		}),
	}.Check()

	assert.Empty(vals)
	assert.True(valid)
}

func TestEgressExportedWildcardInternalServiceEntryNotPresent(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"wrong.bookinfo.svc.cluster.local"}, "bookinfo")
	vals, valid := EgressHostChecker{
		Conf:             config.Get(),
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, config.Get()),
		ServiceEntries:   kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{data.CreateEmptyMeshInternalServiceEntry("details-se", "bookinfo3", []string{"*.bookinfo3.svc.cluster.local"})}),
		Sidecar: sidecarWithHosts([]string{
			"bookinfo/*.bookinfo2.svc.cluster.local",
		}),
	}.Check()

	assert.NotEmpty(vals)
	assert.True(valid)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.Equal("spec/egress[0]/hosts[0]", vals[0].Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("sidecar.egress.servicenotfound", vals[0]))
}

func TestEgressExportedNonFQDNInternalServiceEntryNotPresent(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"wrong.bookinfo.svc.cluster.local"}, "bookinfo")
	vals, valid := EgressHostChecker{
		Conf:             config.Get(),
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, config.Get()),
		ServiceEntries:   kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{data.CreateEmptyMeshInternalServiceEntry("details-se", "bookinfo3", []string{"details"})}),
		Sidecar: sidecarWithHosts([]string{
			"bookinfo/details.bookinfo2.svc.cluster.local",
		}),
	}.Check()

	assert.NotEmpty(vals)
	assert.True(valid)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.Equal("spec/egress[0]/hosts[0]", vals[0].Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("sidecar.egress.servicenotfound", vals[0]))
}

func TestEgressHostCrossNamespaceServiceNotFound(t *testing.T) {
	assert := assert.New(t)

	hosts := []string{
		"*/*.example.com",
		"*/www.example.com",
		"*/example.prod.svc.cluster.local",
		"~/*.example.com",
		"~/www.example.com",
		"~/example.prod.svc.cluster.local",
		"bookinfo/reviews.bogus.svc.cluster.local",
		"bookinfo/*.bogus.svc.cluster.local",
	}

	vals, valid := EgressHostChecker{
		Conf:    config.Get(),
		Sidecar: sidecarWithHosts(hosts),
	}.Check()

	assert.NotEmpty(vals)
	assert.Len(vals, len(hosts))
	assert.True(valid)

	for i, c := range vals {
		assert.Equal(models.WarningSeverity, c.Severity)
		assert.Equal(fmt.Sprintf("spec/egress[0]/hosts[%d]", i), c.Path)
		assert.NoError(validations.ConfirmIstioCheckMessage("sidecar.egress.servicenotfound", c))
	}
}

func TestEgressServiceNotFound(t *testing.T) {
	assert := assert.New(t)

	vals, valid := EgressHostChecker{
		Conf: config.Get(),
		Sidecar: sidecarWithHosts([]string{
			"bookinfo/boggus.bookinfo.svc.cluster.local",
			"bookinfo/boggus.org",
		}),
	}.Check()

	assert.NotEmpty(vals)
	assert.Len(vals, 2)
	assert.True(valid)

	for i, c := range vals {
		assert.Equal(models.WarningSeverity, c.Severity)
		assert.Equal(fmt.Sprintf("spec/egress[0]/hosts[%d]", i), c.Path)
		assert.NoError(validations.ConfirmIstioCheckMessage("sidecar.egress.servicenotfound", c))
	}
}

func TestEgressKubeService(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	fakeServices := data.CreateFakeMultiServices([]string{"boggus.bookinfo.svc.cluster.local"}, "bookinfo")
	fakeServices[0].Annotations = map[string]string{kubernetes.ExportToAnnotation: "."}
	vals, valid := EgressHostChecker{
		Conf: conf,
		Sidecar: sidecarWithHosts([]string{
			"bookinfo/boggus.bookinfo.svc.cluster.local",
		}),
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, conf),
	}.Check()

	assert.Empty(vals)
	assert.True(valid)
}

func TestEgressKubeServiceExported(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	fakeServices := data.CreateFakeMultiServices([]string{"boggus.bookinfo.svc.cluster.local"}, "bookinfo")
	fakeServices[0].Annotations = map[string]string{kubernetes.ExportToAnnotation: "*"}
	vals, valid := EgressHostChecker{
		Conf: conf,
		Sidecar: sidecarWithHosts([]string{
			"bookinfo/boggus.bookinfo.svc.cluster.local",
		}),
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, conf),
	}.Check()

	assert.Empty(vals)
	assert.True(valid)
}

func TestEgressKubeServiceNotFound(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"wrong.bookinfo.svc.cluster.local"}, "bookinfo")
	vals, valid := EgressHostChecker{
		Conf: config.Get(),
		Sidecar: sidecarWithHosts([]string{
			"bookinfo/boggus.bookinfo.svc.cluster.local",
		}),
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, config.Get()),
	}.Check()

	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.True(valid)

	for i, c := range vals {
		assert.Equal(models.WarningSeverity, c.Severity)
		assert.Equal(fmt.Sprintf("spec/egress[0]/hosts[%d]", i), c.Path)
		assert.NoError(validations.ConfirmIstioCheckMessage("sidecar.egress.servicenotfound", c))
	}
}

func TestEgressKubeServiceNotFoundWronglyExported(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	fakeServices := data.CreateFakeMultiServices([]string{"boggus.bookinfo.svc.cluster.local"}, "bookinfo")
	fakeServices[0].Annotations = map[string]string{kubernetes.ExportToAnnotation: "bookinfo2"}
	vals, valid := EgressHostChecker{
		Conf: conf,
		Sidecar: sidecarWithHosts([]string{
			"bookinfo/boggus.bookinfo.svc.cluster.local",
		}),
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, conf),
	}.Check()

	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.True(valid)

	for i, c := range vals {
		assert.Equal(models.WarningSeverity, c.Severity)
		assert.Equal(fmt.Sprintf("spec/egress[0]/hosts[%d]", i), c.Path)
		assert.NoError(validations.ConfirmIstioCheckMessage("sidecar.egress.servicenotfound", c))
	}
}

func TestEgressKubeServiceNotFoundWronglyExported2(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"boggus.bookinfo.svc.cluster.local"}, "bookinfo2")
	vals, valid := EgressHostChecker{
		Conf: config.Get(),
		Sidecar: sidecarWithHosts([]string{
			"bookinfo/boggus.bookinfo.svc.cluster.local",
		}),
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, config.Get()),
	}.Check()

	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.True(valid)

	for i, c := range vals {
		assert.Equal(models.WarningSeverity, c.Severity)
		assert.Equal(fmt.Sprintf("spec/egress[0]/hosts[%d]", i), c.Path)
		assert.NoError(validations.ConfirmIstioCheckMessage("sidecar.egress.servicenotfound", c))
	}
}

func sidecarWithHosts(hl []string) *networking_v1.Sidecar {
	return data.AddHostsToSidecar(hl, data.CreateSidecar("sidecar", "bookinfo"))
}
