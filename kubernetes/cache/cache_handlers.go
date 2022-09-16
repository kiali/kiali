package cache

import (
	"k8s.io/apimachinery/pkg/api/meta"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/log"
)

type RegistryRefreshHandler struct {
	refresh func()
}

func NewRegistryHandler(refresh func()) RegistryRefreshHandler {
	log.Infof("Adding a RegistryRefreshHandler")
	return RegistryRefreshHandler{refresh: refresh}
}

func (sh RegistryRefreshHandler) OnAdd(obj interface{}) {
	sh.refresh()
}

func (sh RegistryRefreshHandler) OnUpdate(oldObj, newObj interface{}) {
	var (
		oldMeta v1.Object
		newMeta v1.Object
		err     error
	)

	if oldMeta, err = meta.Accessor(oldObj); err != nil {
		log.Errorf("oldObj is not a valid kube object. Err: %s", err)
		return
	}
	if newMeta, err = meta.Accessor(newObj); err != nil {
		log.Errorf("newObj is not a valid kube object. Err: %s", err)
		return
	}

	if oldMeta.GetResourceVersion() != newMeta.GetResourceVersion() {
		sh.refresh()
	}
}

func (sh RegistryRefreshHandler) OnDelete(obj interface{}) {
	sh.refresh()
}
