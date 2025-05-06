package k8sreferencegrants

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

type NamespaceChecker struct {
	Namespaces     models.Namespaces
	ReferenceGrant k8s_networking_v1beta1.ReferenceGrant
}

func (in NamespaceChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	if len(in.ReferenceGrant.Spec.From) > 0 {
		for nsIndex, from := range in.ReferenceGrant.Spec.From {
			if !in.Namespaces.Includes(string(from.Namespace)) {
				validation := models.Build("k8sreferencegrants.from.namespacenotfound",
					fmt.Sprintf("spec/from[%d]/namespace", nsIndex))
				validations = append(validations, &validation)
			}
		}
	}

	return validations, len(validations) == 0
}

type SingleNamespaceChecker struct {
	Client         client.Reader
	ReferenceGrant k8s_networking_v1beta1.ReferenceGrant
}

func (in SingleNamespaceChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	for nsIndex, from := range in.ReferenceGrant.Spec.From {
		ns := &corev1.Namespace{}
		if err := in.Client.Get(context.TODO(), types.NamespacedName{Name: string(from.Namespace)}, ns); err != nil {
			if errors.IsNotFound(err) {
				validation := models.Build("k8sreferencegrants.from.namespacenotfound",
					fmt.Sprintf("spec/from[%d]/namespace", nsIndex))
				validations = append(validations, &validation)
			} else {
				log.Errorf("Unable to get namespace %s while validating ReferenceGrant %s: %s", string(from.Namespace), in.ReferenceGrant.Name, err)
			}
		}
	}

	return validations, len(validations) == 0
}
