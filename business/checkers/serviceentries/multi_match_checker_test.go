package serviceentries

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestSameHostPortSameProtocolMultiMatch(t *testing.T) {
	assert := assert.New(t)

	serviceEntries := []*networking_v1.ServiceEntry{
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(13835, "https-13835", "HTTPS"),
			data.CreateEmptyMeshExternalServiceEntry("se1", "test", []string{"example.com"}),
		),
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(13835, "https-13835", "HTTPS"),
			data.CreateEmptyMeshExternalServiceEntry("se2", "test", []string{"example.com"}),
		),
	}

	vals := MultiMatchChecker{ServiceEntries: serviceEntries}.Check()

	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))
	assertMultiMatchValidation(assert, vals, "se1", "test", []string{"se2"})
	assertMultiMatchValidation(assert, vals, "se2", "test", []string{"se1"})
}

func TestDifferentPortNumbersNoConflict(t *testing.T) {
	assert := assert.New(t)

	serviceEntries := []*networking_v1.ServiceEntry{
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(80, "http", "HTTP"),
			data.CreateEmptyMeshExternalServiceEntry("se1", "test", []string{"example.com"}),
		),
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(443, "https", "HTTPS"),
			data.CreateEmptyMeshExternalServiceEntry("se2", "test", []string{"example.com"}),
		),
	}

	vals := MultiMatchChecker{ServiceEntries: serviceEntries}.Check()
	assert.Empty(vals)
}

func TestDifferentHostsNoConflict(t *testing.T) {
	assert := assert.New(t)

	serviceEntries := []*networking_v1.ServiceEntry{
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(13835, "https-13835", "HTTPS"),
			data.CreateEmptyMeshExternalServiceEntry("se1", "test", []string{"example.com"}),
		),
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(13835, "http-13835", "HTTP"),
			data.CreateEmptyMeshExternalServiceEntry("se2", "test", []string{"other.com"}),
		),
	}

	vals := MultiMatchChecker{ServiceEntries: serviceEntries}.Check()
	assert.Empty(vals)
}

func TestConflictingProtocols(t *testing.T) {
	assert := assert.New(t)

	serviceEntries := []*networking_v1.ServiceEntry{
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(13835, "https-13835", "HTTPS"),
			data.CreateEmptyMeshExternalServiceEntry("se1", "test", []string{"example.com"}),
		),
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(13835, "http-13835", "HTTP"),
			data.CreateEmptyMeshExternalServiceEntry("se2", "test", []string{"example.com"}),
		),
	}

	vals := MultiMatchChecker{ServiceEntries: serviceEntries}.Check()

	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))

	assertProtocolConflictValidation(assert, vals, "se1", "test", []string{"se2"})
	assertProtocolConflictValidation(assert, vals, "se2", "test", []string{"se1"})
}

func TestThreeSEsTwoConflicting(t *testing.T) {
	assert := assert.New(t)

	serviceEntries := []*networking_v1.ServiceEntry{
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(13835, "https-13835", "HTTPS"),
			data.CreateEmptyMeshExternalServiceEntry("se1", "test", []string{"example.com"}),
		),
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(13835, "http-13835", "HTTP"),
			data.CreateEmptyMeshExternalServiceEntry("se2", "test", []string{"example.com"}),
		),
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(443, "https", "HTTPS"),
			data.CreateEmptyMeshExternalServiceEntry("se3", "test", []string{"other.com"}),
		),
	}

	vals := MultiMatchChecker{ServiceEntries: serviceEntries}.Check()

	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))

	assertProtocolConflictValidation(assert, vals, "se1", "test", []string{"se2"})
	assertProtocolConflictValidation(assert, vals, "se2", "test", []string{"se1"})

	_, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "test", Name: "se3"}]
	assert.False(ok)
}

func TestMultipleHostsConflictOnOne(t *testing.T) {
	assert := assert.New(t)

	se1 := data.CreateEmptyMeshExternalServiceEntry("se1", "test", []string{"example.com", "other.com"})
	data.AddPortDefinitionToServiceEntry(
		data.CreateEmptyServicePortDefinition(443, "https", "HTTPS"), se1)

	se2 := data.CreateEmptyMeshExternalServiceEntry("se2", "test", []string{"example.com"})
	data.AddPortDefinitionToServiceEntry(
		data.CreateEmptyServicePortDefinition(443, "http", "HTTP"), se2)

	serviceEntries := []*networking_v1.ServiceEntry{se1, se2}
	vals := MultiMatchChecker{ServiceEntries: serviceEntries}.Check()

	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))
	assertProtocolConflictValidation(assert, vals, "se1", "test", []string{"se2"})
	assertProtocolConflictValidation(assert, vals, "se2", "test", []string{"se1"})
}

func TestMultiplePortsConflictOnOne(t *testing.T) {
	assert := assert.New(t)

	se1 := data.CreateEmptyMeshExternalServiceEntry("se1", "test", []string{"example.com"})
	data.AddPortDefinitionToServiceEntry(
		data.CreateEmptyServicePortDefinition(80, "http", "HTTP"), se1)
	data.AddPortDefinitionToServiceEntry(
		data.CreateEmptyServicePortDefinition(443, "https", "HTTPS"), se1)

	se2 := data.CreateEmptyMeshExternalServiceEntry("se2", "test", []string{"example.com"})
	data.AddPortDefinitionToServiceEntry(
		data.CreateEmptyServicePortDefinition(443, "tls", "TLS"), se2)

	serviceEntries := []*networking_v1.ServiceEntry{se1, se2}
	vals := MultiMatchChecker{ServiceEntries: serviceEntries}.Check()

	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))

	v1 := vals[models.IstioValidationKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "test", Name: "se1"}]
	assert.NotNil(v1)
	assert.Equal("spec/ports[1]", v1.Checks[0].Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("serviceentries.port.protocol.conflict", v1.Checks[0]))

	v2 := vals[models.IstioValidationKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "test", Name: "se2"}]
	assert.NotNil(v2)
	assert.Equal("spec/ports[0]", v2.Checks[0].Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("serviceentries.port.protocol.conflict", v2.Checks[0]))
}

func TestProtocolCaseInsensitiveMultiMatch(t *testing.T) {
	assert := assert.New(t)

	serviceEntries := []*networking_v1.ServiceEntry{
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(80, "http", "http"),
			data.CreateEmptyMeshExternalServiceEntry("se1", "test", []string{"example.com"}),
		),
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(80, "http2", "HTTP"),
			data.CreateEmptyMeshExternalServiceEntry("se2", "test", []string{"example.com"}),
		),
	}

	vals := MultiMatchChecker{ServiceEntries: serviceEntries}.Check()

	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))
	assertMultiMatchValidation(assert, vals, "se1", "test", []string{"se2"})
	assertMultiMatchValidation(assert, vals, "se2", "test", []string{"se1"})
}

func TestCrossNamespaceConflict(t *testing.T) {
	assert := assert.New(t)

	serviceEntries := []*networking_v1.ServiceEntry{
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(13835, "https-13835", "HTTPS"),
			data.CreateEmptyMeshExternalServiceEntry("se1", "ns1", []string{"example.com"}),
		),
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(13835, "http-13835", "HTTP"),
			data.CreateEmptyMeshExternalServiceEntry("se2", "ns2", []string{"example.com"}),
		),
	}

	vals := MultiMatchChecker{ServiceEntries: serviceEntries}.Check()

	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))

	v1 := vals[models.IstioValidationKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "ns1", Name: "se1"}]
	assert.NotNil(v1)
	assert.True(v1.Valid)
	assert.NotEmpty(v1.Checks)
	assert.Equal(models.WarningSeverity, v1.Checks[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("serviceentries.port.protocol.conflict", v1.Checks[0]))
	assert.Contains(v1.References, models.IstioValidationKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "ns2", Name: "se2"})

	v2 := vals[models.IstioValidationKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "ns2", Name: "se2"}]
	assert.NotNil(v2)
	assert.Contains(v2.References, models.IstioValidationKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "ns1", Name: "se1"})
}

func TestCrossNamespaceMultiMatch(t *testing.T) {
	assert := assert.New(t)

	serviceEntries := []*networking_v1.ServiceEntry{
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(443, "https", "HTTPS"),
			data.CreateEmptyMeshExternalServiceEntry("se1", "ns1", []string{"example.com"}),
		),
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(443, "https", "HTTPS"),
			data.CreateEmptyMeshExternalServiceEntry("se2", "ns2", []string{"example.com"}),
		),
	}

	vals := MultiMatchChecker{ServiceEntries: serviceEntries}.Check()

	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))

	v1 := vals[models.IstioValidationKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "ns1", Name: "se1"}]
	assert.NotNil(v1)
	assert.NoError(validations.ConfirmIstioCheckMessage("serviceentries.multimatch", v1.Checks[0]))
	assert.Contains(v1.References, models.IstioValidationKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "ns2", Name: "se2"})

	v2 := vals[models.IstioValidationKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "ns2", Name: "se2"}]
	assert.NotNil(v2)
	assert.NoError(validations.ConfirmIstioCheckMessage("serviceentries.multimatch", v2.Checks[0]))
	assert.Contains(v2.References, models.IstioValidationKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "ns1", Name: "se1"})
}

func TestNoPortsNoConflict(t *testing.T) {
	assert := assert.New(t)

	serviceEntries := []*networking_v1.ServiceEntry{
		data.CreateEmptyMeshExternalServiceEntry("se1", "test", []string{"example.com"}),
		data.CreateEmptyMeshExternalServiceEntry("se2", "test", []string{"example.com"}),
	}

	vals := MultiMatchChecker{ServiceEntries: serviceEntries}.Check()
	assert.Empty(vals)
}

func TestSingleServiceEntryNoConflict(t *testing.T) {
	assert := assert.New(t)

	serviceEntries := []*networking_v1.ServiceEntry{
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(80, "http", "HTTP"),
			data.CreateEmptyMeshExternalServiceEntry("se1", "test", []string{"example.com"}),
		),
	}

	vals := MultiMatchChecker{ServiceEntries: serviceEntries}.Check()
	assert.Empty(vals)
}

func TestMultiMatchNotProtocolConflict(t *testing.T) {
	assert := assert.New(t)

	serviceEntries := []*networking_v1.ServiceEntry{
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(443, "https", "HTTPS"),
			data.CreateEmptyMeshExternalServiceEntry("se1", "test", []string{"example.com"}),
		),
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(443, "https-alt", "HTTPS"),
			data.CreateEmptyMeshExternalServiceEntry("se2", "test", []string{"example.com"}),
		),
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(443, "https-backup", "HTTPS"),
			data.CreateEmptyMeshExternalServiceEntry("se3", "test", []string{"example.com"}),
		),
	}

	vals := MultiMatchChecker{ServiceEntries: serviceEntries}.Check()

	assert.NotEmpty(vals)
	assert.Equal(3, len(vals))

	assertMultiMatchValidation(assert, vals, "se1", "test", []string{"se2", "se3"})
	assertMultiMatchValidation(assert, vals, "se2", "test", []string{"se1", "se3"})
	assertMultiMatchValidation(assert, vals, "se3", "test", []string{"se1", "se2"})
}

func TestThreeSEsMixedProtocolConflict(t *testing.T) {
	assert := assert.New(t)

	serviceEntries := []*networking_v1.ServiceEntry{
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(443, "https", "HTTPS"),
			data.CreateEmptyMeshExternalServiceEntry("se1", "test", []string{"example.com"}),
		),
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(443, "https-alt", "HTTPS"),
			data.CreateEmptyMeshExternalServiceEntry("se2", "test", []string{"example.com"}),
		),
		data.AddPortDefinitionToServiceEntry(
			data.CreateEmptyServicePortDefinition(443, "http", "HTTP"),
			data.CreateEmptyMeshExternalServiceEntry("se3", "test", []string{"example.com"}),
		),
	}

	vals := MultiMatchChecker{ServiceEntries: serviceEntries}.Check()

	assert.NotEmpty(vals)
	assert.Equal(3, len(vals))

	for _, seName := range []string{"se1", "se2", "se3"} {
		v := vals[models.IstioValidationKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "test", Name: seName}]
		assert.NotNil(v)
		assert.NoError(validations.ConfirmIstioCheckMessage("serviceentries.port.protocol.conflict", v.Checks[0]))
	}
}

func assertMultiMatchValidation(assert *assert.Assertions, vals models.IstioValidations, seName, seNamespace string, refNames []string) {
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: seNamespace, Name: seName}]
	assert.True(ok)
	assert.True(validation.Valid)
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("serviceentries.multimatch", validation.Checks[0]))

	assert.NotEmpty(validation.References)
	for _, refName := range refNames {
		assert.Contains(validation.References,
			models.IstioValidationKey{
				ObjectGVK: kubernetes.ServiceEntries,
				Namespace: seNamespace,
				Name:      refName,
			},
		)
	}
}

func assertProtocolConflictValidation(assert *assert.Assertions, vals models.IstioValidations, seName, seNamespace string, refNames []string) {
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: seNamespace, Name: seName}]
	assert.True(ok)
	assert.True(validation.Valid)
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("serviceentries.port.protocol.conflict", validation.Checks[0]))

	assert.NotEmpty(validation.References)
	for _, refName := range refNames {
		assert.Contains(validation.References,
			models.IstioValidationKey{
				ObjectGVK: kubernetes.ServiceEntries,
				Namespace: seNamespace,
				Name:      refName,
			},
		)
	}
}
