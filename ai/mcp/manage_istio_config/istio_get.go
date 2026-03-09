package manage_istio_config

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/sliceutil"
)

func IstioGet(ctx context.Context, args map[string]interface{}, businessLayer *business.Layer, conf *config.Config) (interface{}, int) {
	// Extract parameters
	cluster, _ := args["cluster"].(string)
	namespace, _ := args["namespace"].(string)
	group, _ := args["group"].(string)
	version, _ := args["version"].(string)
	kind, _ := args["kind"].(string)
	object, _ := args["object"].(string)

	if cluster == "" {
		cluster = conf.KubernetesConfig.ClusterName
	}

	gvk := schema.GroupVersionKind{
		Group:   group,
		Version: version,
		Kind:    kind,
	}

	if !business.GetIstioAPI(gvk) {
		return fmt.Sprintf("Object type not managed: %s", gvk.String()), http.StatusBadRequest
	}

	istioConfigDetails, err := businessLayer.IstioConfig.GetIstioConfigDetails(ctx, cluster, namespace, gvk, object)
	if err != nil {
		return err.Error(), http.StatusInternalServerError
	}

	validationsResult := make(chan error)
	exportTo := istioConfigDetails.GetExportTo()
	istioConfigValidations := models.IstioValidations{}
	istioConfigReferences := models.IstioReferencesMap{}

	go func(istioConfigValidations *models.IstioValidations, istioConfigReferences *models.IstioReferencesMap) {
		defer func() {
			close(validationsResult)
		}()
		if len(exportTo) != 0 {
			// validations should be done per exported namespaces to apply exportTo configs
			loadedNamespaces, _ := businessLayer.Namespace.GetClusterNamespaces(ctx, cluster)
			for _, ns := range loadedNamespaces {
				if sliceutil.SomeString(exportTo, ns.Name) && ns.Name != namespace {
					istioConfigValidationResults, istioConfigReferencesResults, err := businessLayer.Validations.ValidateIstioObject(ctx, cluster, ns.Name, gvk, object)
					if err != nil {
						validationsResult <- err
					}
					*istioConfigValidations = istioConfigValidations.MergeValidations(istioConfigValidationResults)
					*istioConfigReferences = istioConfigReferences.MergeReferencesMap(istioConfigReferencesResults)
				}
			}
		}
		// also validate own namespace
		istioConfigValidationResults, istioConfigReferencesResults, err := businessLayer.Validations.ValidateIstioObject(ctx, cluster, namespace, gvk, object)
		if err != nil {
			validationsResult <- err
		}
		*istioConfigValidations = istioConfigValidations.MergeValidations(istioConfigValidationResults)
		*istioConfigReferences = istioConfigReferences.MergeReferencesMap(istioConfigReferencesResults)
	}(&istioConfigValidations, &istioConfigReferences)

	istioConfigDetails.IstioConfigHelpFields = models.IstioConfigHelpMessages[gvk.String()]
	err = <-validationsResult
	if err != nil {
		return err.Error(), http.StatusInternalServerError
	}

	if validation, found := istioConfigValidations[models.IstioValidationKey{ObjectGVK: gvk, Namespace: namespace, Name: object, Cluster: cluster}]; found {
		istioConfigDetails.IstioValidation = validation
	}
	if references, found := istioConfigReferences[models.IstioReferenceKey{ObjectGVK: gvk, Namespace: namespace, Name: object}]; found {
		istioConfigDetails.IstioReferences = references
	}

	return istioConfigDetails, http.StatusOK
}
