package models

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

// AttributeManifests attributeManifests
//
// This is used for returning an array of AttributeManifest
//
// swagger:model attributeManifests
// An array of attributeManifest
// swagger:allOf
type AttributeManifests []AttributeManifest

// AttributeManifest attributeManifest
//
// This is used for returning an AttributeManifest
//
// swagger:model attributeManifest
type AttributeManifest struct {
	meta_v1.TypeMeta
	Metadata meta_v1.ObjectMeta `json:"metadata"`
	Spec     struct {
		Revision   interface{} `json:"revision"`
		Name       interface{} `json:"name"`
		Attributes interface{} `json:"attributes"`
	} `json:"spec"`
}

func (ams *AttributeManifests) Parse(attributeManifests []kubernetes.IstioObject) {
	for _, am := range attributeManifests {
		attributeManifest := AttributeManifest{}
		attributeManifest.Parse(am)
		*ams = append(*ams, attributeManifest)
	}
}

func (am *AttributeManifest) Parse(attributeManifest kubernetes.IstioObject) {
	am.TypeMeta = attributeManifest.GetTypeMeta()
	am.Metadata = attributeManifest.GetObjectMeta()
	am.Spec.Revision = attributeManifest.GetSpec()["revision"]
	am.Spec.Name = attributeManifest.GetSpec()["name"]
	am.Spec.Attributes = attributeManifest.GetSpec()["attributes"]
}
