package manage_istio_config

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

func IstioGet(ctx context.Context, args map[string]interface{}, businessLayer *business.Layer, conf *config.Config) (interface{}, int) {
	// Extract parameters
	cluster := mcputil.GetStringArg(args, "clusterName")
	namespace := mcputil.GetStringArg(args, "namespace")
	group := mcputil.GetStringArg(args, "group")
	version := mcputil.GetStringArg(args, "version")
	kind := mcputil.GetStringArg(args, "kind")
	object := mcputil.GetStringArg(args, "object")

	if cluster == "" {
		cluster = conf.KubernetesConfig.ClusterName
	}

	gvk := schema.GroupVersionKind{
		Group:   group,
		Version: version,
		Kind:    kind,
	}

	if !business.GetIstioAPI(gvk) {
		return fmt.Sprintf("Object type not managed: %s", gvk.String()), http.StatusOK
	}

	istioConfigDetails, err := businessLayer.IstioConfig.GetIstioConfigDetails(ctx, cluster, namespace, gvk, object)
	if err != nil {
		msg, _ := classifyError(err, kind, object, namespace)
		return msg, http.StatusOK
	}

	validationsResult := make(chan error)
	istioConfigValidations := models.IstioValidations{}
	istioConfigReferences := models.IstioReferencesMap{}

	go func(istioConfigValidations *models.IstioValidations, istioConfigReferences *models.IstioReferencesMap) {
		defer func() {
			close(validationsResult)
		}()
		// ValidateIstioObject validates the object from its own namespace and
		// from every namespace it is exported to, matching the background
		// validation that produces the list-view results.
		istioConfigValidationResults, istioConfigReferencesResults, err := businessLayer.Validations.ValidateIstioObject(ctx, cluster, namespace, gvk, object)
		if err != nil {
			validationsResult <- err
			return
		}
		*istioConfigValidations = istioConfigValidations.MergeValidations(istioConfigValidationResults)
		*istioConfigReferences = istioConfigReferences.MergeReferencesMap(istioConfigReferencesResults)
	}(&istioConfigValidations, &istioConfigReferences)

	istioConfigDetails.IstioConfigHelpFields = models.IstioConfigHelpMessages[gvk.String()]
	err = <-validationsResult
	if err != nil {
		return fmt.Sprintf("Error validating %s %q in namespace %q: %s", kind, object, namespace, err.Error()), http.StatusOK
	}

	if validation, found := istioConfigValidations[models.IstioValidationKey{ObjectGVK: gvk, Namespace: namespace, Name: object, Cluster: cluster}]; found {
		istioConfigDetails.IstioValidation = validation
	}
	if references, found := istioConfigReferences[models.IstioReferenceKey{ObjectGVK: gvk, Namespace: namespace, Name: object}]; found {
		istioConfigDetails.IstioReferences = references
	}

	return istioConfigDetails, http.StatusOK
}
