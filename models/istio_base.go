package models

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

type IstioBase struct {
	meta_v1.TypeMeta
	Metadata meta_v1.ObjectMeta     `json:"metadata"`
	Status   map[string]interface{} `json:"status,omitempty"`
}

func (ib *IstioBase) Parse(io kubernetes.IstioObject) {
	ib.TypeMeta = io.GetTypeMeta()
	ib.Metadata = io.GetObjectMeta()
	ib.Status = io.GetStatus()
}
