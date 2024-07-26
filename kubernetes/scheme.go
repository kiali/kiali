package kubernetes

import (
	osappsscheme "github.com/openshift/client-go/apps/clientset/versioned/scheme"
	oauthscheme "github.com/openshift/client-go/oauth/clientset/versioned/scheme"
	projectscheme "github.com/openshift/client-go/project/clientset/versioned/scheme"
	routescheme "github.com/openshift/client-go/route/clientset/versioned/scheme"
	userscheme "github.com/openshift/client-go/user/clientset/versioned/scheme"
	extentionsv1alpha1 "istio.io/client-go/pkg/apis/extensions/v1alpha1"
	networkingv1 "istio.io/client-go/pkg/apis/networking/v1"
	networkingv1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

	securityv1 "istio.io/client-go/pkg/apis/security/v1"
	telemetryv1 "istio.io/client-go/pkg/apis/telemetry/v1"
	"k8s.io/apimachinery/pkg/runtime"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	k8sinferencev1alpha2 "sigs.k8s.io/gateway-api-inference-extension/api/v1alpha2"
	k8snetworkingv1 "sigs.k8s.io/gateway-api/apis/v1"
	k8snetworkingv1alpha2 "sigs.k8s.io/gateway-api/apis/v1alpha2"
	k8snetworkingv1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"
	gatewayapischeme "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned/scheme"
)

// NewScheme creates a scheme will all the Kinds that Kiali consumes.
func NewScheme() (*runtime.Scheme, error) {
	scheme := runtime.NewScheme()
	addSchemeFuncs := []func(s *runtime.Scheme) error{
		clientgoscheme.AddToScheme,
		networkingv1.AddToScheme,
		networkingv1alpha3.AddToScheme,
		extentionsv1alpha1.AddToScheme,
		securityv1.AddToScheme,
		telemetryv1.AddToScheme,
		k8snetworkingv1.Install,
		k8snetworkingv1beta1.Install,
		k8snetworkingv1alpha2.Install,
		k8sinferencev1alpha2.Install,
		osappsscheme.AddToScheme,
		oauthscheme.AddToScheme,
		projectscheme.AddToScheme,
		routescheme.AddToScheme,
		userscheme.AddToScheme,
		gatewayapischeme.AddToScheme,
	}

	for _, addToScheme := range addSchemeFuncs {
		if err := addToScheme(scheme); err != nil {
			return nil, err
		}
	}

	return scheme, nil
}
