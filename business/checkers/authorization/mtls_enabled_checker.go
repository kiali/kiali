package authorization

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/mtls"
)

const objectType = "authorizationpolicy"

type MtlsEnabledChecker struct {
	Namespace             string
	AuthorizationPolicies []kubernetes.IstioObject
	MtlsDetails           kubernetes.MTLSDetails
}

// Checks if mTLS is enabled, mark all Authz Policies with error
func (c MtlsEnabledChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	if mode := c.hasMtlsEnabledForNamespace(); mode != mtls.MTLSEnabled {
		for _, ap := range c.AuthorizationPolicies {
			key := models.BuildKey(objectType, ap.GetObjectMeta().Name, ap.GetObjectMeta().Namespace)
			checks := models.Build("authorizationpolicy.mtls.needstobeenabled", "metadata/name")
			validations.MergeValidations(models.IstioValidations{key: &models.IstioValidation{
				Name:       ap.GetObjectMeta().Namespace,
				ObjectType: objectType,
				Valid:      false,
				Checks:     []*models.IstioCheck{&checks},
			}})
		}
	}

	return validations
}

func (c MtlsEnabledChecker) hasMtlsEnabledForNamespace() string {
	return mtls.OverallMtlsStatus(c.namespaceMtlsStatus(), c.meshWideMtlsStatus(), c.MtlsDetails.EnabledAutoMtls)
}

func (c MtlsEnabledChecker) meshWideMtlsStatus() string {
	mtlsStatus := mtls.MtlsStatus{
		Namespace:           c.Namespace,
		PeerAuthentications: c.MtlsDetails.MeshPeerAuthentications,
		DestinationRules:    c.MtlsDetails.DestinationRules,
		AutoMtlsEnabled:     c.MtlsDetails.EnabledAutoMtls,
	}

	return mtlsStatus.MeshMtlsStatus()
}

func (c MtlsEnabledChecker) namespaceMtlsStatus() string {
	mtlsStatus := mtls.MtlsStatus{
		Namespace:           c.Namespace,
		PeerAuthentications: c.MtlsDetails.PeerAuthentications,
		DestinationRules:    c.MtlsDetails.DestinationRules,
		AutoMtlsEnabled:     c.MtlsDetails.EnabledAutoMtls,
	}

	return mtlsStatus.NamespaceMtlsStatus()
}
