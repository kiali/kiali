package kubernetes

import (
	"fmt"

	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/log"
)

// GetIstioRules returns a list of mixer rules for a given namespace.
func (in *IstioClient) GetIstioRules(namespace string, labelSelector string) ([]IstioObject, error) {
	result, err := in.istioConfigApi.Get().Namespace(namespace).Resource(rules).Param("labelSelector", labelSelector).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[rules],
		APIVersion: ApiConfigVersion,
	}
	ruleList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a rules list", namespace)
	}
	istioRules := make([]IstioObject, 0)
	for _, rule := range ruleList.Items {
		r := rule.DeepCopyIstioObject()
		r.SetTypeMeta(typeMeta)
		istioRules = append(istioRules, r)
	}
	return istioRules, nil
}

func (in *IstioClient) GetAdapters(namespace, labelSelector string) ([]IstioObject, error) {
	return in.getAdaptersTemplates(namespace, "adapter", adapterPlurals, labelSelector)
}

func (in *IstioClient) GetTemplates(namespace, labelSelector string) ([]IstioObject, error) {
	return in.getAdaptersTemplates(namespace, "template", templatePlurals, labelSelector)
}

func (in *IstioClient) GetIstioRule(namespace string, istiorule string) (IstioObject, error) {
	result, err := in.istioConfigApi.Get().Namespace(namespace).Resource(rules).SubResource(istiorule).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[rules],
		APIVersion: ApiConfigVersion,
	}
	mRule, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a Rule", namespace, istiorule)
	}
	r := mRule.DeepCopyIstioObject()
	r.SetTypeMeta(typeMeta)
	return r, nil
}

func (in *IstioClient) GetAdapter(namespace, adapterType, adapterName string) (IstioObject, error) {
	return in.getAdapterTemplate(namespace, "adapter", adapterType, adapterName, adapterPlurals)
}

func (in *IstioClient) GetTemplate(namespace, templateType, templateName string) (IstioObject, error) {
	return in.getAdapterTemplate(namespace, "template", templateType, templateName, templatePlurals)
}

func (in *IstioClient) getAdaptersTemplates(namespace string, itemType string, pluralsMap map[string]string, labelSelector string) ([]IstioObject, error) {
	resultsChan := make(chan istioResponse)
	for name, plural := range pluralsMap {
		go func(name, plural string) {
			results, err := in.istioConfigApi.Get().Namespace(namespace).Resource(plural).Param("labelSelector", labelSelector).Do().Get()
			istioObjects := istioResponse{}
			typeMeta := meta_v1.TypeMeta{
				Kind:       PluralType[plural],
				APIVersion: ApiConfigVersion,
			}
			resultList, ok := results.(*GenericIstioObjectList)
			if !ok {
				err = fmt.Errorf("%s doesn't return a %s list", namespace, plural)
			}
			if err == nil {
				istioObjects.results = make([]IstioObject, 0)
				for _, result := range resultList.Items {
					adapter := result.DeepCopyIstioObject()
					// We need to specifically add the adapter name in the label
					if adapter.GetObjectMeta().Labels == nil {
						objectMeta := adapter.GetObjectMeta()
						objectMeta.Labels = make(map[string]string)
						adapter.SetObjectMeta(objectMeta)
					}
					adapter.GetObjectMeta().Labels[itemType] = name
					// To support plural, we have only adapter/template -> adapters/templates
					adapter.GetObjectMeta().Labels[itemType] = name
					adapter.GetObjectMeta().Labels[itemType+"s"] = plural
					adapter.SetTypeMeta(typeMeta)
					istioObjects.results = append(istioObjects.results, adapter)
					istioObjects.err = nil
				}
			} else {
				istioObjects.results = nil
				istioObjects.err = err
			}
			resultsChan <- istioObjects
		}(name, plural)
	}

	results := make([]IstioObject, 0)
	for i := 0; i < len(pluralsMap); i++ {
		adapterTemplate := <-resultsChan
		if adapterTemplate.err == nil {
			results = append(results, adapterTemplate.results...)
		} else {
			log.Warningf("Querying %s got an error: %s", itemType, adapterTemplate.err)
		}
	}
	return results, nil
}

func (in *IstioClient) getAdapterTemplate(namespace string, itemType string, itemSubtype, itemName string, pluralsMap map[string]string) (IstioObject, error) {
	ok := false
	subtype := ""
	for key, plural := range pluralsMap {
		if itemSubtype == plural {
			subtype = key
			ok = true
			break
		}
	}
	if !ok {
		return nil, fmt.Errorf("%s is not supported", itemSubtype)
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[itemSubtype],
		APIVersion: ApiConfigVersion,
	}
	result, err := in.istioConfigApi.Get().Namespace(namespace).Resource(itemSubtype).SubResource(itemName).Do().Get()
	istioObject, ok := result.(IstioObject)
	if !ok {
		istioObject = nil
		if err == nil {
			err = fmt.Errorf("%s/%s doesn't return a valid IstioObject", itemSubtype, itemName)
		}
	}
	if err != nil {
		return nil, err
	}
	if istioObject.GetObjectMeta().Labels == nil {
		objectMeta := istioObject.GetObjectMeta()
		objectMeta.Labels = make(map[string]string)
		istioObject.SetObjectMeta(objectMeta)
	}
	// Adding the singular name of the adapter/template to propagate it into the Kiali model
	istioObject.GetObjectMeta().Labels[itemType] = subtype
	istioObject.GetObjectMeta().Labels[itemType+"s"] = itemSubtype
	istioObject.SetTypeMeta(typeMeta)
	return istioObject, nil
}
