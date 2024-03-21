package kubetest

import (
	"context"

	osappsfake "github.com/openshift/client-go/apps/clientset/versioned/fake"
	osappsscheme "github.com/openshift/client-go/apps/clientset/versioned/scheme"
	projectfake "github.com/openshift/client-go/project/clientset/versioned/fake"
	projectscheme "github.com/openshift/client-go/project/clientset/versioned/scheme"
	routefake "github.com/openshift/client-go/route/clientset/versioned/fake"
	routescheme "github.com/openshift/client-go/route/clientset/versioned/scheme"
	userfake "github.com/openshift/client-go/user/clientset/versioned/fake"
	userscheme "github.com/openshift/client-go/user/clientset/versioned/scheme"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	istio "istio.io/client-go/pkg/clientset/versioned"
	istiofake "istio.io/client-go/pkg/clientset/versioned/fake"
	istioscheme "istio.io/client-go/pkg/clientset/versioned/scheme"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes"
	kubefake "k8s.io/client-go/kubernetes/fake"
	kubescheme "k8s.io/client-go/kubernetes/scheme"
	gatewayapi "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned"
	gatewayapifake "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned/fake"
	gatewayapischeme "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned/scheme"

	kialikube "github.com/kiali/kiali/kubernetes"
)

func isIstioResource(obj runtime.Object) bool {
	_, _, err := istioscheme.Scheme.ObjectKinds(obj)
	return err == nil
}

func isKubeResource(obj runtime.Object) bool {
	_, _, err := kubescheme.Scheme.ObjectKinds(obj)
	return err == nil
}

func isGatewayAPIResource(obj runtime.Object) bool {
	_, _, err := gatewayapischeme.Scheme.ObjectKinds(obj)
	return err == nil
}

func isProjectResource(obj runtime.Object) bool {
	_, _, err := projectscheme.Scheme.ObjectKinds(obj)
	return err == nil
}

func isRouteResource(obj runtime.Object) bool {
	_, _, err := routescheme.Scheme.ObjectKinds(obj)
	return err == nil
}

func isOSAppsResource(obj runtime.Object) bool {
	_, _, err := osappsscheme.Scheme.ObjectKinds(obj)
	return err == nil
}

func isUserResource(obj runtime.Object) bool {
	_, _, err := userscheme.Scheme.ObjectKinds(obj)
	return err == nil
}

// NewFakeK8sClient creates a new fake kubernetes client for testing purposes.
func NewFakeK8sClient(objects ...runtime.Object) *FakeK8sClient {
	// NOTE: The kube fake client object tracker guesses the resource name based on the Kind.
	// For a plural resource, it will convert the kind to lowercase and add an "ies" to the end.
	// In the case of objects like "Gateway" where the plural is actually "Gateways", the conversion
	// is wrong. The guessing of the resource name only happens with tracker.Add inside of NewSimpleClientset.
	// If we create the object after creating the clientset, then the tracker will use the correct resource name.
	var (
		kubeObjects       []runtime.Object
		istioObjects      []runtime.Object
		gatewayapiObjects []runtime.Object
		osAppsObjects     []runtime.Object
		routeObjects      []runtime.Object
		projectObjects    []runtime.Object
		userObjects       []runtime.Object
		istioGateways     []*networking_v1beta1.Gateway
	)

	for _, obj := range objects {
		o := obj
		switch {
		case isKubeResource(o):
			kubeObjects = append(kubeObjects, o)
		case isIstioResource(o):
			if gw, ok := o.(*networking_v1beta1.Gateway); ok {
				istioGateways = append(istioGateways, gw)
			} else {
				istioObjects = append(istioObjects, o)
			}
		case isGatewayAPIResource(o):
			gatewayapiObjects = append(gatewayapiObjects, o)
		case isOSAppsResource(o):
			osAppsObjects = append(osAppsObjects, o)
		case isRouteResource(o):
			routeObjects = append(routeObjects, o)
		case isProjectResource(o):
			projectObjects = append(projectObjects, o)
		case isUserResource(o):
			userObjects = append(userObjects, o)
		}
	}

	kubeClient := kubefake.NewSimpleClientset(kubeObjects...)
	istioClient := istiofake.NewSimpleClientset(istioObjects...)
	gatewayAPIClient := gatewayapifake.NewSimpleClientset(gatewayapiObjects...)
	osAppsClient := osappsfake.NewSimpleClientset(osAppsObjects...)
	projectClient := projectfake.NewSimpleClientset(projectObjects...)
	routeClient := routefake.NewSimpleClientset(routeObjects...)
	userClient := userfake.NewSimpleClientset(userObjects...)

	// These are created separately because the fake clientset guesses the resource name based on the Kind.
	for _, gw := range istioGateways {
		if _, err := istioClient.NetworkingV1beta1().Gateways(gw.Namespace).Create(context.TODO(), gw, metav1.CreateOptions{}); err != nil {
			panic(err)
		}
	}

	return &FakeK8sClient{
		ClientInterface: kialikube.NewClient(kubeClient, istioClient, gatewayAPIClient, osAppsClient, projectClient, routeClient, userClient),
		KubeClientset:   kubeClient,
		IstioClientset:  istioClient,
		ProjectFake:     projectClient,
		IstioAPIEnabled: true,
	}
}

// FakeK8sClient is an implementation of the kiali Kubernetes client interface used for tests.
type FakeK8sClient struct {
	OpenShift         bool
	GatewayAPIEnabled bool
	IstioAPIEnabled   bool
	kialikube.ClientInterface
	// Underlying kubernetes clientset.
	KubeClientset kubernetes.Interface
	// Underlying istio clientset.
	IstioClientset istio.Interface
	// Underlying gateway api clientset.
	GatewayAPIClientset gatewayapi.Interface
	// Token is the kiali token this client uses.
	Token           string
	KubeClusterInfo kialikube.ClusterInfo
	ProjectFake     *projectfake.Clientset
}

func (c *FakeK8sClient) IsOpenShift() bool                  { return c.OpenShift }
func (c *FakeK8sClient) IsExpGatewayAPI() bool              { return c.GatewayAPIEnabled }
func (c *FakeK8sClient) IsGatewayAPI() bool                 { return c.GatewayAPIEnabled }
func (c *FakeK8sClient) IsIstioAPI() bool                   { return c.IstioAPIEnabled }
func (c *FakeK8sClient) GetToken() string                   { return c.Token }
func (c *FakeK8sClient) ClusterInfo() kialikube.ClusterInfo { return c.KubeClusterInfo }

var _ kialikube.ClientInterface = &FakeK8sClient{}
