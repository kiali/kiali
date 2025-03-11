package virtualservices

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestOneVirtualServicePerHostExported(t *testing.T) {
	vss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "reviews"),
	}
	evss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo2", "virtual-2", "ratings"),
	}
	vals := SingleHostChecker{
		Conf:            config.Get(),
		VirtualServices: append(vss, evss...),
	}.Check()

	emptyValidationTestNS(t, vals, "virtual-1", "bookinfo")
	emptyValidationTestNS(t, vals, "virtual-2", "bookinfo2")

	// First virtual service has a gateway
	vss = []*networking_v1.VirtualService{
		buildVirtualServiceWithGatewayNS("bookinfo", "virtual-1", "reviews", "bookinfo-gateway"),
	}
	evss = []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo2", "virtual-2", "ratings"),
	}
	vals = SingleHostChecker{
		Conf:            config.Get(),
		VirtualServices: append(vss, evss...),
	}.Check()

	emptyValidationTestNS(t, vals, "virtual-1", "bookinfo")
	emptyValidationTestNS(t, vals, "virtual-2", "bookinfo2")

	// Second virtual service has a gateway
	vss = []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "reviews"),
	}
	evss = []*networking_v1.VirtualService{
		buildVirtualServiceWithGatewayNS("bookinfo2", "virtual-2", "ratings", "bookinfo-gateway"),
	}
	vals = SingleHostChecker{
		Conf:            config.Get(),
		VirtualServices: append(vss, evss...),
	}.Check()

	emptyValidationTestNS(t, vals, "virtual-1", "bookinfo")
	emptyValidationTestNS(t, vals, "virtual-2", "bookinfo2")

	// Both virtual services have a gateway
	vss = []*networking_v1.VirtualService{
		buildVirtualServiceWithGatewayNS("bookinfo", "virtual-1", "reviews", "bookinfo-gateway"),
	}
	evss = []*networking_v1.VirtualService{
		buildVirtualServiceWithGatewayNS("bookinfo2", "virtual-2", "ratings", "bookinfo-gateway"),
	}
	vals = SingleHostChecker{
		Conf:            config.Get(),
		VirtualServices: append(vss, evss...),
	}.Check()

	emptyValidationTestNS(t, vals, "virtual-1", "bookinfo")
	emptyValidationTestNS(t, vals, "virtual-2", "bookinfo2")
}

func TestOneVirtualServicePerFQDNHostExported(t *testing.T) {
	vss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "ratings.bookinfo.svc.cluster.local"),
	}
	evss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo2", "virtual-2", "ratings.bookinfo2.svc.cluster.local"),
	}
	vals := SingleHostChecker{
		Conf:            config.Get(),
		VirtualServices: append(vss, evss...),
	}.Check()

	emptyValidationTestNS(t, vals, "virtual-1", "bookinfo")
	emptyValidationTestNS(t, vals, "virtual-2", "bookinfo2")
}

func TestOneVirtualServicePerFQDNWildcardHostExported(t *testing.T) {
	vss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "*.bookinfo.svc.cluster.local"),
	}
	evss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo2", "virtual-2", "*.eshop.svc.cluster.local"),
	}
	vals := SingleHostChecker{
		Conf:            config.Get(),
		VirtualServices: append(vss, evss...),
	}.Check()

	emptyValidationTestNS(t, vals, "virtual-1", "bookinfo")
	emptyValidationTestNS(t, vals, "virtual-2", "bookinfo2")
}

func TestRepeatingSimpleHostExported(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	vss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "reviews.bookinfo.svc.cluster.local"),
	}
	evss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo2", "virtual-2", "reviews.bookinfo.svc.cluster.local"),
		buildVirtualServiceNS("bookinfo3", "virtual-3", "reviews.bookinfo.svc.cluster.local"),
	}
	vals := SingleHostChecker{
		Conf:            config.Get(),
		VirtualServices: append(vss, evss...),
	}.Check()

	presentValidationTestNS(t, vals, "virtual-1", "bookinfo")
	presentValidationTestNS(t, vals, "virtual-2", "bookinfo2")
	presentValidationTestNS(t, vals, "virtual-3", "bookinfo3")

	for _, validation := range vals {
		switch validation.Name {
		case "virtual-1":
			presentReferencesNS(t, *validation, []string{"virtual-2"}, "bookinfo2")
			presentReferencesNS(t, *validation, []string{"virtual-3"}, "bookinfo3")
		case "virtual-2":
			presentReferencesNS(t, *validation, []string{"virtual-1"}, "bookinfo")
			presentReferencesNS(t, *validation, []string{"virtual-3"}, "bookinfo3")
		case "virtual-3":
			presentReferencesNS(t, *validation, []string{"virtual-1"}, "bookinfo")
			presentReferencesNS(t, *validation, []string{"virtual-2"}, "bookinfo2")
		}
	}
}

func TestRepeatingSimpleHostWithGatewayExported(t *testing.T) {
	vss := []*networking_v1.VirtualService{
		buildVirtualServiceWithGatewayNS("bookinfo", "virtual-1", "reviews.bookinfo.svc.cluster.local", "bookinfo"),
	}
	evss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo2", "virtual-2", "reviews.bookinfo.svc.cluster.local"),
	}
	vals := SingleHostChecker{
		Conf:            config.Get(),
		VirtualServices: append(vss, evss...),
	}.Check()

	noObjectValidationTestNS(t, vals, "virtual-1", "bookinfo")
	noObjectValidationTestNS(t, vals, "virtual-2", "bookinfo2")

	vss = []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "reviews.bookinfo.svc.cluster.local"),
	}
	evss = []*networking_v1.VirtualService{
		buildVirtualServiceWithGatewayNS("bookinfo2", "virtual-2", "reviews.bookinfo.svc.cluster.local", "bookinfo2"),
	}
	vals = SingleHostChecker{
		Conf:            config.Get(),
		VirtualServices: append(vss, evss...),
	}.Check()

	noObjectValidationTestNS(t, vals, "virtual-1", "bookinfo")
	noObjectValidationTestNS(t, vals, "virtual-2", "bookinfo2")

	vss = []*networking_v1.VirtualService{
		buildVirtualServiceWithGatewayNS("bookinfo", "virtual-1", "reviews.bookinfo.svc.cluster.local", "bookinfo"),
	}
	evss = []*networking_v1.VirtualService{
		buildVirtualServiceWithGatewayNS("bookinfo2", "virtual-2", "reviews.bookinfo.svc.cluster.local", "bookinfo"),
	}
	vals = SingleHostChecker{
		Conf:            config.Get(),
		VirtualServices: append(vss, evss...),
	}.Check()

	refKey := models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "bookinfo2", Name: "virtual-2"}
	presentValidationTestNS(t, vals, "virtual-1", "bookinfo")
	presentReferenceNS(t, *(vals[refKey]), "virtual-1", "bookinfo")

	refKey.Name = "virtual-2"
	presentValidationTestNS(t, vals, "virtual-2", "bookinfo2")
	presentReferenceNS(t, *(vals[refKey]), "virtual-1", "bookinfo")
}

func TestRepeatingSVCNSHostExported(t *testing.T) {
	vss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "reviews.bookinfo.svc.cluster.local"),
	}
	evss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo2", "virtual-2", "reviews.bookinfo.svc.cluster.local"),
	}
	vals := SingleHostChecker{
		Conf: config.Get(),
		Namespaces: models.Namespaces{
			{Name: "bookinfo"},
			{Name: "bookinfo2"},
		},
		VirtualServices: append(vss, evss...),
	}.Check()

	presentValidationTestNS(t, vals, "virtual-1", "bookinfo")
	presentValidationTestNS(t, vals, "virtual-2", "bookinfo2")

	vss = []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "reviews.bookinfo.svc.cluster.local"),
	}
	evss = []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo2", "virtual-2", "reviews.bookinfo.svc.cluster.local"),
	}
	vals = SingleHostChecker{
		Conf: config.Get(),
		Namespaces: models.Namespaces{
			{Name: "bookinfo"},
			{Name: "bookinfo2"},
		},
		VirtualServices: append(vss, evss...),
	}.Check()

	presentValidationTestNS(t, vals, "virtual-1", "bookinfo")
	presentValidationTestNS(t, vals, "virtual-2", "bookinfo2")

	vss = []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "reviews.bookinfo.svc.cluster.local"),
		buildVirtualServiceWithGatewayNS("bookinfo", "virtual-3", "reviews.bookinfo.svc.cluster.local", "bookinfo-gateway-auto"),
	}
	evss = []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo2", "virtual-2", "reviews.bookinfo.svc.cluster.local"),
	}
	vals = SingleHostChecker{
		Conf: config.Get(),
		Namespaces: models.Namespaces{
			{Name: "bookinfo"},
			{Name: "bookinfo2"},
		},
		VirtualServices: append(vss, evss...),
	}.Check()

	presentValidationTestNS(t, vals, "virtual-1", "bookinfo")
	presentValidationTestNS(t, vals, "virtual-2", "bookinfo2")

	vss = []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "*.bookinfo.svc.cluster.local"),
	}
	evss = []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo2", "virtual-2", "reviews.bookinfo.svc.cluster.local"),
	}
	vals = SingleHostChecker{
		Conf: config.Get(),
		Namespaces: models.Namespaces{
			{Name: "bookinfo"},
			{Name: "bookinfo2"},
		},
		VirtualServices: append(vss, evss...),
	}.Check()

	presentValidationTestNS(t, vals, "virtual-1", "bookinfo")
	presentValidationTestNS(t, vals, "virtual-2", "bookinfo2")

	vss = []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "reviews.bookinfo.svc.cluster.local"),
	}
	evss = []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo2", "virtual-2", "details.bookinfo.svc.cluster.local"),
	}
	vals = SingleHostChecker{
		Conf: config.Get(),
		Namespaces: models.Namespaces{
			{Name: "bookinfo"},
			{Name: "bookinfo2"},
		},
		VirtualServices: append(vss, evss...),
	}.Check()

	noObjectValidationTestNS(t, vals, "virtual-1", "bookinfo")
	noObjectValidationTestNS(t, vals, "virtual-2", "bookinfo2")
	emptyValidationTestNS(t, vals, "virtual-1", "bookinfo")
	emptyValidationTestNS(t, vals, "virtual-2", "bookinfo2")

	vss = []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "reviews.bookinfo.svc.cluster.local"),
	}
	evss = []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo2", "virtual-2", "details.bookinfo.svc.cluster.local"),
	}
	vals = SingleHostChecker{
		Conf: config.Get(),
		Namespaces: models.Namespaces{
			{Name: "bookinfo"},
			{Name: "bookinfo2"},
		},
		VirtualServices: append(vss, evss...),
	}.Check()

	noObjectValidationTestNS(t, vals, "virtual-1", "bookinfo")
	noObjectValidationTestNS(t, vals, "virtual-2", "bookinfo2")
	emptyValidationTestNS(t, vals, "virtual-1", "bookinfo")
	emptyValidationTestNS(t, vals, "virtual-2", "bookinfo")
}

func TestRepeatingFQDNHostExported(t *testing.T) {
	vss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "reviews.bookinfo.svc.cluster.local"),
	}
	evss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo2", "virtual-2", "reviews.bookinfo.svc.cluster.local"),
		buildVirtualServiceNS("bookinfo3", "virtual-3", "reviews.bookinfo.svc.cluster.local"),
	}
	vals := SingleHostChecker{
		Conf:            config.Get(),
		VirtualServices: append(vss, evss...),
	}.Check()

	presentValidationTestNS(t, vals, "virtual-1", "bookinfo")
	presentValidationTestNS(t, vals, "virtual-2", "bookinfo2")
	presentValidationTestNS(t, vals, "virtual-3", "bookinfo3")

	for _, validation := range vals {
		switch validation.Name {
		case "virtual-1":
			presentReferencesNS(t, *validation, []string{"virtual-2"}, "bookinfo2")
			presentReferencesNS(t, *validation, []string{"virtual-3"}, "bookinfo3")
		case "virtual-2":
			presentReferencesNS(t, *validation, []string{"virtual-1"}, "bookinfo")
			presentReferencesNS(t, *validation, []string{"virtual-3"}, "bookinfo3")
		case "virtual-3":
			presentReferencesNS(t, *validation, []string{"virtual-1"}, "bookinfo")
			presentReferencesNS(t, *validation, []string{"virtual-2"}, "bookinfo2")
		}
	}
}

func TestRepeatingFQDNWildcardHostExported(t *testing.T) {
	vss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "*.bookinfo.svc.cluster.local"),
	}
	evss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo2", "virtual-2", "*.bookinfo.svc.cluster.local"),
		buildVirtualServiceNS("bookinfo3", "virtual-3", "*.bookinfo.svc.cluster.local"),
	}
	vals := SingleHostChecker{
		Conf:            config.Get(),
		VirtualServices: append(vss, evss...),
	}.Check()

	presentValidationTestNS(t, vals, "virtual-1", "bookinfo")
	presentValidationTestNS(t, vals, "virtual-2", "bookinfo2")
	presentValidationTestNS(t, vals, "virtual-3", "bookinfo3")

	for _, validation := range vals {
		switch validation.Name {
		case "virtual-1":
			presentReferencesNS(t, *validation, []string{"virtual-2"}, "bookinfo2")
			presentReferencesNS(t, *validation, []string{"virtual-3"}, "bookinfo3")
		case "virtual-2":
			presentReferencesNS(t, *validation, []string{"virtual-1"}, "bookinfo")
			presentReferencesNS(t, *validation, []string{"virtual-3"}, "bookinfo3")
		case "virtual-3":
			presentReferencesNS(t, *validation, []string{"virtual-1"}, "bookinfo")
			presentReferencesNS(t, *validation, []string{"virtual-2"}, "bookinfo2")
		}
	}
}

func TestIncludedIntoWildCardExported(t *testing.T) {
	vss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "*.bookinfo.svc.cluster.local"),
	}
	evss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo2", "virtual-2", "reviews.bookinfo.svc.cluster.local"),
		buildVirtualServiceNS("bookinfo3", "virtual-3", "reviews.bookinfo.svc.cluster.local"),
	}
	vals := SingleHostChecker{
		Conf:            config.Get(),
		VirtualServices: append(vss, evss...),
	}.Check()

	presentValidationTestNS(t, vals, "virtual-1", "bookinfo")
	presentValidationTestNS(t, vals, "virtual-2", "bookinfo2")
	presentValidationTestNS(t, vals, "virtual-3", "bookinfo3")

	for _, validation := range vals {
		switch validation.Name {
		case "virtual-1":
			presentReferencesNS(t, *validation, []string{"virtual-2"}, "bookinfo2")
			presentReferencesNS(t, *validation, []string{"virtual-3"}, "bookinfo3")
		case "virtual-2":
			presentReferencesNS(t, *validation, []string{"virtual-1"}, "bookinfo")
			presentReferencesNS(t, *validation, []string{"virtual-3"}, "bookinfo3")
		case "virtual-3":
			presentReferencesNS(t, *validation, []string{"virtual-1"}, "bookinfo")
			presentReferencesNS(t, *validation, []string{"virtual-2"}, "bookinfo2")
		}
	}

	// Same test, with different order of appearance
	vss = []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "reviews.bookinfo.svc.cluster.local"),
	}
	evss = []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo2", "virtual-2", "*.bookinfo.svc.cluster.local"),
		buildVirtualServiceNS("bookinfo3", "virtual-3", "reviews.bookinfo.svc.cluster.local"),
	}
	vals = SingleHostChecker{
		Conf:            config.Get(),
		VirtualServices: append(vss, evss...),
	}.Check()

	presentValidationTestNS(t, vals, "virtual-1", "bookinfo")
	presentValidationTestNS(t, vals, "virtual-2", "bookinfo2")
	presentValidationTestNS(t, vals, "virtual-3", "bookinfo3")

	for _, validation := range vals {
		switch validation.Name {
		case "virtual-1":
			presentReferencesNS(t, *validation, []string{"virtual-2"}, "bookinfo2")
			presentReferencesNS(t, *validation, []string{"virtual-3"}, "bookinfo3")
		case "virtual-2":
			presentReferencesNS(t, *validation, []string{"virtual-1"}, "bookinfo")
			presentReferencesNS(t, *validation, []string{"virtual-3"}, "bookinfo3")
		case "virtual-3":
			presentReferencesNS(t, *validation, []string{"virtual-1"}, "bookinfo")
			presentReferencesNS(t, *validation, []string{"virtual-2"}, "bookinfo2")
		}
	}
}

func TestShortHostNameIncludedIntoWildCardExported(t *testing.T) {
	vss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "*.bookinfo.svc.cluster.local"),
	}
	evss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo2", "virtual-2", "reviews.bookinfo.svc.cluster.local"),
		buildVirtualServiceNS("bookinfo3", "virtual-3", "reviews.bookinfo.svc.cluster.local"),
	}
	vals := SingleHostChecker{
		Conf:            config.Get(),
		VirtualServices: append(vss, evss...),
	}.Check()

	presentValidationTestNS(t, vals, "virtual-1", "bookinfo")
	presentValidationTestNS(t, vals, "virtual-2", "bookinfo2")
	presentValidationTestNS(t, vals, "virtual-3", "bookinfo3")

	for _, validation := range vals {
		switch validation.Name {
		case "virtual-1":
			presentReferencesNS(t, *validation, []string{"virtual-2"}, "bookinfo2")
			presentReferencesNS(t, *validation, []string{"virtual-3"}, "bookinfo3")
		case "virtual-2":
			presentReferencesNS(t, *validation, []string{"virtual-1"}, "bookinfo")
			presentReferencesNS(t, *validation, []string{"virtual-3"}, "bookinfo3")
		case "virtual-3":
			presentReferencesNS(t, *validation, []string{"virtual-1"}, "bookinfo")
			presentReferencesNS(t, *validation, []string{"virtual-2"}, "bookinfo2")
		}
	}
}

func TestWildcardisMarkedInvalidExported(t *testing.T) {
	vss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "*"),
	}
	evss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo2", "virtual-2", "reviews.bookinfo.svc.cluster.local"),
		buildVirtualServiceNS("bookinfo3", "virtual-3", "reviews.bookinfo.svc.cluster.local"),
	}
	vals := SingleHostChecker{
		Conf:            config.Get(),
		VirtualServices: append(vss, evss...),
	}.Check()

	presentValidationTestNS(t, vals, "virtual-1", "bookinfo")
	presentValidationTestNS(t, vals, "virtual-2", "bookinfo2")
	presentValidationTestNS(t, vals, "virtual-3", "bookinfo3")

	for _, validation := range vals {
		switch validation.Name {
		case "virtual-1":
			presentReferencesNS(t, *validation, []string{"virtual-2"}, "bookinfo2")
			presentReferencesNS(t, *validation, []string{"virtual-3"}, "bookinfo3")
		case "virtual-2":
			presentReferencesNS(t, *validation, []string{"virtual-1"}, "bookinfo")
			presentReferencesNS(t, *validation, []string{"virtual-3"}, "bookinfo3")
		case "virtual-3":
			presentReferencesNS(t, *validation, []string{"virtual-1"}, "bookinfo")
			presentReferencesNS(t, *validation, []string{"virtual-2"}, "bookinfo2")
		}
	}
}

func TestMultipleHostsFailingExported(t *testing.T) {
	vss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "reviews.bookinfo.svc.cluster.local"),
	}
	evss := []*networking_v1.VirtualService{
		buildVirtualServiceMultipleHostsNS("bookinfo2", "virtual-2", []string{"reviews.bookinfo.svc.cluster.local",
			"mongo.backup.svc.cluster.local", "mongo.staging.svc.cluster.local"}),
	}
	vals := SingleHostChecker{
		Conf:            config.Get(),
		VirtualServices: append(vss, evss...),
	}.Check()

	presentValidationTestNS(t, vals, "virtual-1", "bookinfo")
	presentValidationTestNS(t, vals, "virtual-2", "bookinfo2")

	for _, validation := range vals {
		switch validation.Name {
		case "virtual-1":
			presentReferenceNS(t, *validation, "virtual-2", "bookinfo2")
		case "virtual-2":
			presentReferenceNS(t, *validation, "virtual-1", "bookinfo")
		}
	}
}

func TestMultipleHostsPassingExported(t *testing.T) {
	vss := []*networking_v1.VirtualService{
		buildVirtualServiceNS("bookinfo", "virtual-1", "reviews"),
	}
	evss := []*networking_v1.VirtualService{
		buildVirtualServiceMultipleHostsNS("bookinfo2", "virtual-2", []string{"ratings",
			"mongo.backup.svc.cluster.local", "mongo.staging.svc.cluster.local"}),
	}
	vals := SingleHostChecker{
		Conf:            config.Get(),
		VirtualServices: append(vss, evss...),
	}.Check()

	emptyValidationTestNS(t, vals, "virtual-1", "bookinfo")
	emptyValidationTestNS(t, vals, "virtual-2", "bookinfo2")
}

func buildVirtualServiceNS(namespace, name, host string) *networking_v1.VirtualService {
	return buildVirtualServiceMultipleHostsNS(namespace, name, []string{host})
}

func buildVirtualServiceWithGatewayNS(namespace, name, host, gateway string) *networking_v1.VirtualService {
	return data.AddGatewaysToVirtualService([]string{gateway}, data.CreateEmptyVirtualService(name,
		namespace, []string{host}))
}

func buildVirtualServiceMultipleHostsNS(namespace, name string, hosts []string) *networking_v1.VirtualService {
	return data.CreateEmptyVirtualService(name, namespace, hosts)
}

func emptyValidationTestNS(t *testing.T, vals models.IstioValidations, name string, namespace string) {
	assert := assert.New(t)
	assert.Empty(vals)

	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: namespace, Name: name}]
	assert.False(ok)
	assert.Nil(validation)
}

func noObjectValidationTestNS(t *testing.T, vals models.IstioValidations, name string, namespace string) {
	assert := assert.New(t)

	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: namespace, Name: name}]
	assert.False(ok)
	assert.Nil(validation)
}

func presentValidationTestNS(t *testing.T, vals models.IstioValidations, serviceName string, namespace string) {
	assert := assert.New(t)
	assert.NotEmpty(vals)

	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: namespace, Name: serviceName}]
	assert.True(ok)

	assert.True(validation.Valid)
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.singlehost", validation.Checks[0]))
	assert.Equal("spec/hosts", validation.Checks[0].Path)
}

func presentReferenceNS(t *testing.T, validation models.IstioValidation, serviceName string, namespace string) {
	assert := assert.New(t)
	refKey := models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: namespace, Name: serviceName}

	assert.True(len(validation.References) > 0)
	assert.Contains(validation.References, refKey)
}

func presentReferencesNS(t *testing.T, validation models.IstioValidation, serviceNames []string, namespace string) {
	assert := assert.New(t)
	assert.True(len(validation.References) > 0)

	for _, sn := range serviceNames {
		refKey := models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: namespace, Name: sn}
		assert.Contains(validation.References, refKey)
	}
}
