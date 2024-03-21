package kubetest

import (
	"context"

	osapps_v1 "github.com/openshift/api/apps/v1"
	osproject_v1 "github.com/openshift/api/project/v1"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	istio "istio.io/client-go/pkg/clientset/versioned"
	istiofake "istio.io/client-go/pkg/clientset/versioned/fake"
	istioscheme "istio.io/client-go/pkg/clientset/versioned/scheme"
	kubeerrors "k8s.io/apimachinery/pkg/api/errors"
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

func isOpenShiftResource(obj runtime.Object) bool {
	// We don't use openshift's client-go package where the scheme is located
	// so just manually checking a few types that Kiali uses here. Not all the
	// types are covered.
	switch obj.(type) {
	case *osapps_v1.DeploymentConfig, *osproject_v1.Project:
		return true
	}

	return false
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
		istioGateways     []*networking_v1beta1.Gateway
		deploymentConfigs = make(map[string][]osapps_v1.DeploymentConfig)
		projects          = []osproject_v1.Project{}
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
		case isOpenShiftResource(o):
			if dc, ok := o.(*osapps_v1.DeploymentConfig); ok {
				if _, exists := deploymentConfigs[dc.Namespace]; !exists {
					deploymentConfigs[dc.Namespace] = []osapps_v1.DeploymentConfig{}
				}
				deploymentConfigs[dc.Namespace] = append(deploymentConfigs[dc.Namespace], *dc)
			} else if proj, ok := o.(*osproject_v1.Project); ok {
				projects = append(projects, *proj)
			}
		}
	}

	kubeClient := kubefake.NewSimpleClientset(kubeObjects...)
	istioClient := istiofake.NewSimpleClientset(istioObjects...)
	gatewayAPIClient := gatewayapifake.NewSimpleClientset(gatewayapiObjects...)

	// These are created separately because the fake clientset guesses the resource name based on the Kind.
	for _, gw := range istioGateways {
		if _, err := istioClient.NetworkingV1beta1().Gateways(gw.Namespace).Create(context.TODO(), gw, metav1.CreateOptions{}); err != nil {
			panic(err)
		}
	}

	return &FakeK8sClient{
		ClientInterface:   kialikube.NewClient(kubeClient, istioClient, gatewayAPIClient),
		deploymentConfigs: deploymentConfigs,
		projects:          projects,
		KubeClientset:     kubeClient,
		IstioClientset:    istioClient,
		IstioAPIEnabled:   true,
	}
}

// FakeK8sClient is an implementation of the kiali Kubernetes client interface used for tests.
type FakeK8sClient struct {
	OpenShift         bool
	GatewayAPIEnabled bool
	IstioAPIEnabled   bool
	kialikube.ClientInterface
	// Keeping track of the openshift objects separately since we don't use the openshift client-go
	// and there's no underlying fake clientset.
	// This is a map of namespace: []objects e.g. DeploymentConfig: []DeploymentConfig.
	deploymentConfigs map[string][]osapps_v1.DeploymentConfig
	projects          []osproject_v1.Project
	// Underlying kubernetes clientset.
	KubeClientset kubernetes.Interface
	// Underlying istio clientset.
	IstioClientset istio.Interface
	// Underlying gateway api clientset.
	GatewayAPIClientset gatewayapi.Interface
	// Token is the kiali token this client uses.
	Token           string
	KubeClusterInfo kialikube.ClusterInfo
}

func (c *FakeK8sClient) IsOpenShift() bool                  { return c.OpenShift }
func (c *FakeK8sClient) IsExpGatewayAPI() bool              { return c.GatewayAPIEnabled }
func (c *FakeK8sClient) IsGatewayAPI() bool                 { return c.GatewayAPIEnabled }
func (c *FakeK8sClient) IsIstioAPI() bool                   { return c.IstioAPIEnabled }
func (c *FakeK8sClient) GetToken() string                   { return c.Token }
func (c *FakeK8sClient) ClusterInfo() kialikube.ClusterInfo { return c.KubeClusterInfo }

// The openshift resources are stubbed out because Kiali talks directly to the
// kube api for these instead of using the openshift client-go.
func (c *FakeK8sClient) GetProject(name string) (*osproject_v1.Project, error) {
	for _, p := range c.projects {
		if p.Name == name {
			return &p, nil
		}
	}
	return nil, kubeerrors.NewNotFound(osproject_v1.Resource("project"), name)
}

// The openshift resources are stubbed out because Kiali talks directly to the
// kube api for these instead of using the openshift client-go.
func (c *FakeK8sClient) GetProjects(labelSelector string) ([]osproject_v1.Project, error) {
	return c.projects, nil
}

func (c *FakeK8sClient) GetDeploymentConfig(namespace string, name string) (*osapps_v1.DeploymentConfig, error) {
	for _, dc := range c.deploymentConfigs[namespace] {
		if dc.Name == name {
			return &dc, nil
		}
	}
	return nil, kubeerrors.NewNotFound(osapps_v1.Resource("deploymentconfig"), name)
}

func (c *FakeK8sClient) GetDeploymentConfigs(namespace string) ([]osapps_v1.DeploymentConfig, error) {
	// No namespace specified means return all.
	if namespace == "" {
		var all []osapps_v1.DeploymentConfig
		for _, dcs := range c.deploymentConfigs {
			all = append(all, dcs...)
		}
		return all, nil
	}

	if dcs, ok := c.deploymentConfigs[namespace]; ok {
		return dcs, nil
	}

	return nil, nil
}

var _ kialikube.ClientInterface = &FakeK8sClient{}
