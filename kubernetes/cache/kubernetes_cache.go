package cache

import (
	"errors"

	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
)

func (c *kialiCacheImpl) GetDeployments(namespace string) ([]apps_v1.Deployment, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		deps := nsCache["Deployment"].GetStore().List()
		if len(deps) > 0 {
			_, ok := deps[0].(*apps_v1.Deployment)
			if !ok {
				return nil, errors.New("bad Deployment type found in cache")
			}
			nsDeps := make([]apps_v1.Deployment, len(deps))
			for i, dep := range deps {
				nsDeps[i] = *(dep.(*apps_v1.Deployment))
			}
			return nsDeps, nil
		}
	}
	return []apps_v1.Deployment{}, nil
}

func (c *kialiCacheImpl) GetServices(namespace string) ([]core_v1.Service, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		services := nsCache["Service"].GetStore().List()
		if len(services) > 0 {
			_, ok := services[0].(*core_v1.Service)
			if !ok {
				return []core_v1.Service{}, errors.New("bad Service type found in cache")
			}
			nsServices := make([]core_v1.Service, len(services))
			for i, service := range services {
				nsServices[i] = *(service.(*core_v1.Service))
			}
			return nsServices, nil
		}
	}
	return []core_v1.Service{}, nil
}
