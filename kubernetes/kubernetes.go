package kubernetes

import (
	"context"
	"encoding/json"
	goerrors "errors"
	"fmt"
	"io"
	"os"
	"path"
	"reflect"
	"strconv"
	"strings"
	"time"

	osapps_v1 "github.com/openshift/api/apps/v1"
	osoauth_v1 "github.com/openshift/api/oauth/v1"
	osroutes_v1 "github.com/openshift/api/route/v1"
	osuser_v1 "github.com/openshift/api/user/v1"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	apps_v1 "k8s.io/api/apps/v1"
	v1 "k8s.io/api/authentication/v1"
	auth_v1 "k8s.io/api/authorization/v1"
	batch_v1 "k8s.io/api/batch/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/apimachinery/pkg/version"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/clientcmd/api"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/apiutil"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/util/httputil"
)

type K8SClientInterface interface {
	// Kube returns the underlying kubernetes client.
	Kube() kubernetes.Interface

	GetConfigMap(namespace, name string) (*core_v1.ConfigMap, error)
	GetCronJobs(namespace string) ([]batch_v1.CronJob, error)
	GetDeployment(namespace string, name string) (*apps_v1.Deployment, error)
	GetDeployments(namespace string, opts meta_v1.ListOptions) ([]apps_v1.Deployment, error)
	GetJobs(namespace string) ([]batch_v1.Job, error)
	GetNamespace(ctx context.Context, namespace string) (*core_v1.Namespace, error)
	GetNamespaces(ctx context.Context, labelSelector string) ([]core_v1.Namespace, error)
	GetPod(namespace, name string) (*core_v1.Pod, error)
	GetReplicationControllers(namespace string) ([]core_v1.ReplicationController, error)
	GetSecret(namespace, name string) (*core_v1.Secret, error)
	GetAccessSweepReview(ctx context.Context, namespace, api, resourceType string, verbs []string) ([]*auth_v1.SelfSubjectAccessReview, error)
	GetSelfSubjectAccessReview(ctx context.Context, namespace, api, resourceType string, verbs []string) ([]*auth_v1.SelfSubjectAccessReview, error)
	GetTokenSubject(authInfo *api.AuthInfo) (string, error)
	ForwardGetRequest(namespace, podName string, destinationPort int, path string) ([]byte, error)
	StreamPodLogs(ctx context.Context, namespace, name string, opts *core_v1.PodLogOptions) (io.ReadCloser, error)
}

type K8SUserClientInterface interface {
	K8SClientInterface
	UpdateNamespace(namespace string, jsonPatch string) (*core_v1.Namespace, error)
	UpdateService(namespace string, name string, jsonPatch string, patchType string) (*core_v1.Service, error)
	UpdateWorkload(namespace string, workloadName string, workloadObj runtime.Object, jsonPatch string, patchType string) (runtime.Object, error)
}

type OSClientInterface interface {
	DeleteOAuthToken(ctx context.Context, token string) error
	GetDeploymentConfig(ctx context.Context, namespace string, name string) (*osapps_v1.DeploymentConfig, error)
	GetDeploymentConfigs(ctx context.Context, namespace string) ([]osapps_v1.DeploymentConfig, error)
	GetOAuthClient(ctx context.Context, name string) (*osoauth_v1.OAuthClient, error)
	GetRoute(ctx context.Context, namespace string, name string) (*osroutes_v1.Route, error)
	GetUser(ctx context.Context, name string) (*osuser_v1.User, error)
}

type OSUserClientInterface interface {
	OSClientInterface
}

func (in *K8SClient) ForwardGetRequest(namespace, podName string, destinationPort int, path string) ([]byte, error) {
	localPort := httputil.Pool.GetFreePort()
	defer httputil.Pool.FreePort(localPort)

	f, err := in.getPodPortForwarder(namespace, podName, fmt.Sprintf("%d:%d", localPort, destinationPort))
	if err != nil {
		return nil, err
	}

	// Start the forwarding
	if err := f.Start(); err != nil {
		return nil, err
	}

	// Defering the finish of the port-forwarding
	defer f.Stop()

	// Ready to create a request
	resp, code, _, err := httputil.HttpGet(fmt.Sprintf("http://localhost:%d%s", localPort, path), nil, 10*time.Second, nil, nil, in.conf)
	if code >= 400 {
		return resp, fmt.Errorf("error fetching %s from %s/%s. Response code: %d", path, namespace, podName, code)
	}

	return resp, err
}

func (in *K8SClient) Kube() kubernetes.Interface {
	return in.k8s
}

// GetClusterServicesByLabels fetches and returns all services in the whole cluster
// that match the optional labelSelector. This is using the cluster-wide call
// to fetch the services. The client will need to be created with an account that
// has cluster-wide privileges to list services.
func (in *K8SClient) GetClusterServicesByLabels(labelsSelector string) ([]core_v1.Service, error) {
	selector := meta_v1.ListOptions{LabelSelector: labelsSelector}
	if allServicesList, err := in.k8s.CoreV1().Services("").List(in.ctx, selector); err == nil {
		return allServicesList.Items, nil
	} else {
		return []core_v1.Service{}, err
	}
}

// GetConfigMap fetches and returns the specified ConfigMap definition
// from the cluster
func (in *K8SClient) GetConfigMap(namespace, name string) (*core_v1.ConfigMap, error) {
	configMap, err := in.k8s.CoreV1().ConfigMaps(namespace).Get(in.ctx, name, emptyGetOptions)
	if err != nil {
		return &core_v1.ConfigMap{}, err
	}

	return configMap, nil
}

// GetNamespace fetches and returns the specified namespace definition
// from the cluster
func (in *K8SClient) GetNamespace(ctx context.Context, namespace string) (*core_v1.Namespace, error) {
	ns, err := in.k8s.CoreV1().Namespaces().Get(ctx, namespace, emptyGetOptions)
	if err != nil {
		return &core_v1.Namespace{}, err
	}

	return ns, nil
}

// GetServerVersion fetches and returns information about the version Kubernetes that is running
func (in *K8SClient) GetServerVersion() (*version.Info, error) {
	return in.k8s.Discovery().ServerVersion()
}

// GetNamespaces returns a list of all namespaces of the cluster.
// It returns a list of all namespaces of the cluster.
// It returns an error on any problem.
func (in *K8SClient) GetNamespaces(ctx context.Context, labelSelector string) ([]core_v1.Namespace, error) {
	var listOptions meta_v1.ListOptions

	// Apply labelSelector filtering if specified
	if labelSelector != "" {
		listOptions = meta_v1.ListOptions{LabelSelector: labelSelector}
	} else {
		listOptions = emptyListOptions
	}

	namespaces, err := in.k8s.CoreV1().Namespaces().List(ctx, listOptions)
	if err != nil {
		return nil, err
	}

	return namespaces.Items, nil
}

func (in *K8SClient) GetDeploymentConfig(ctx context.Context, namespace string, name string) (*osapps_v1.DeploymentConfig, error) {
	return in.osAppsClient.AppsV1().DeploymentConfigs(namespace).Get(ctx, name, emptyGetOptions)
}

func (in *K8SClient) GetDeploymentConfigs(ctx context.Context, namespace string) ([]osapps_v1.DeploymentConfig, error) {
	deploymentConfigs, err := in.osAppsClient.AppsV1().DeploymentConfigs(namespace).List(ctx, emptyListOptions)
	if err != nil {
		return nil, err
	}

	return deploymentConfigs.Items, nil
}

func (in *K8SClient) GetOAuthClient(ctx context.Context, name string) (*osoauth_v1.OAuthClient, error) {
	return in.oAuthClient.OauthV1().OAuthClients().Get(ctx, name, emptyGetOptions)
}

func (in *K8SClient) GetUser(ctx context.Context, name string) (*osuser_v1.User, error) {
	return in.userClient.UserV1().Users().Get(ctx, name, emptyGetOptions)
}

func (in *K8SClient) DeleteOAuthToken(ctx context.Context, token string) error {
	return in.oAuthClient.OauthV1().OAuthAccessTokens().Delete(ctx, token, meta_v1.DeleteOptions{})
}

func (in *K8SClient) GetRoute(ctx context.Context, namespace string, name string) (*osroutes_v1.Route, error) {
	return in.routeClient.RouteV1().Routes(namespace).Get(ctx, name, emptyGetOptions)
}

// capabilityProbeBackoff is how long a capability probe (IsOpenShift, IsGatewayAPI, ...)
// waits before retrying after a transient failure. Without it, a remote that stalls would be
// re-probed on every call - /api/config alone runs several of these sequentially, and with
// each failed attempt can cost the full request timeout. It stays hardcoded rather than
// configurable because no healthy environment needs a different value: it only shapes
// Kiali's own retry cadence, and lowering it reintroduces the per-request re-probing it
// exists to prevent.
const capabilityProbeBackoff = 30 * time.Second

// Coalesce probes for the same capability while allowing other capabilities and
// callers with shorter deadlines to proceed independently.
func (in *K8SClient) capabilityProbe(ctx context.Context, name string, memo **bool, run func() (present, transient bool)) bool {
	in.rwMutex.Lock()
	if *memo != nil {
		answer := **memo
		in.rwMutex.Unlock()
		return answer
	}
	if time.Since(in.probeFailures[name]) < capabilityProbeBackoff || ctx.Err() != nil {
		in.rwMutex.Unlock()
		return false
	}
	if done := in.probesInFlight[name]; done != nil {
		in.rwMutex.Unlock()
		select {
		case <-ctx.Done():
			return false
		case <-done:
			in.rwMutex.RLock()
			defer in.rwMutex.RUnlock()
			return *memo != nil && **memo
		}
	}
	if in.probesInFlight == nil {
		in.probesInFlight = map[string]chan struct{}{}
	}
	done := make(chan struct{})
	in.probesInFlight[name] = done
	in.rwMutex.Unlock()

	answer, transient := run()
	in.rwMutex.Lock()
	defer in.rwMutex.Unlock()
	if transient {
		if in.probeFailures == nil {
			in.probeFailures = map[string]time.Time{}
		}
		in.probeFailures[name] = time.Now()
	} else {
		*memo = &answer
	}
	delete(in.probesInFlight, name)
	close(done)
	return answer
}

func (in *K8SClient) IsOpenShift() bool {
	return in.capabilityProbe(in.ctx, "openShift", &in.isOpenShift, func() (bool, bool) {
		_, err := in.k8s.Discovery().RESTClient().Get().AbsPath("/apis/project.openshift.io").Do(in.ctx).Raw()
		return err == nil, err != nil && !errors.IsNotFound(err)
	})
}

func (in *K8SClient) IsGatewayAPI() bool {
	return in.checkIsGatewayAPI(in.ctx)
}

// IsGatewayAPIContext is IsGatewayAPI under a caller-supplied deadline: a probe stalled on
// an unreachable cluster is abandoned when ctx is done, so one stalled remote cannot hold a
// caller that shares its discovery budget across clusters. The answer is then false for
// this call and retried on the next one (the transient-failure backoff still applies).
func (in *K8SClient) IsGatewayAPIContext(ctx context.Context) bool {
	return in.checkIsGatewayAPI(ctx)
}

func (in *K8SClient) checkIsGatewayAPI(ctx context.Context) bool {
	if in.GatewayAPI() == nil {
		return false
	}
	return in.capabilityProbe(ctx, "gatewayAPI", &in.isGatewayAPI, func() (bool, bool) {
		v1Types := map[string]string{
			K8sGatewayType:      PluralNames[K8sGatewayType],
			K8sGatewayClassType: PluralNames[K8sGatewayClassType],
			K8sHTTPRouteType:    PluralNames[K8sHTTPRouteType],
			K8sGRPCRouteType:    PluralNames[K8sGRPCRouteType],
		}
		v1beta1Types := map[string]string{
			K8sReferenceGrantType: PluralNames[K8sReferenceGrantType],
		}
		present, transient := checkGatewayAPIs(ctx, in, K8sNetworkingGroupVersionV1.String(), v1Types, false)
		if !present {
			return false, transient
		}
		return checkGatewayAPIs(ctx, in, K8sNetworkingGroupVersionV1Beta1.String(), v1beta1Types, false)
	})
}

func (in *K8SClient) HasTCPRouteInV1() bool {
	if in.GatewayAPI() == nil {
		return false
	}
	return in.capabilityProbe(in.ctx, "tcpRouteV1", &in.hasTCPRouteInV1, func() (bool, bool) {
		return checkGatewayAPIs(in.ctx, in, K8sNetworkingGroupVersionV1.String(), map[string]string{K8sTCPRouteType: PluralNames[K8sTCPRouteType]}, true)
	})
}
func (in *K8SClient) HasUDPRouteInV1() bool {
	if in.GatewayAPI() == nil {
		return false
	}
	return in.capabilityProbe(in.ctx, "udpRouteV1", &in.hasUDPRouteInV1, func() (bool, bool) {
		return checkGatewayAPIs(in.ctx, in, K8sNetworkingGroupVersionV1.String(), map[string]string{K8sUDPRouteType: PluralNames[K8sUDPRouteType]}, true)
	})
}
func (in *K8SClient) HasTLSRouteInV1() bool {
	if in.GatewayAPI() == nil {
		return false
	}
	return in.capabilityProbe(in.ctx, "tlsRouteV1", &in.hasTLSRouteInV1, func() (bool, bool) {
		return checkGatewayAPIs(in.ctx, in, K8sNetworkingGroupVersionV1.String(), map[string]string{K8sTLSRouteType: PluralNames[K8sTLSRouteType]}, true)
	})
}
func (in *K8SClient) IsInferenceAPI() bool {
	if in.InferenceAPI() == nil {
		return false
	}
	return in.capabilityProbe(in.ctx, "inferenceAPI", &in.isInferenceAPI, func() (bool, bool) {
		return checkInferenceAPIs(in.ctx, in, K8sInferenceGroupVersionV1.String(), map[string]string{K8sInferencePoolsType: PluralNames[K8sInferencePoolsType]})
	})
}

func (in *K8SClient) IsIstioGateway() bool {
	return in.checkIsIstioGateway(in.ctx)
}

// IsIstioGatewayContext is IsIstioGateway under a caller-supplied deadline; see
// IsGatewayAPIContext.
func (in *K8SClient) IsIstioGatewayContext(ctx context.Context) bool {
	return in.checkIsIstioGateway(ctx)
}

func (in *K8SClient) checkIsIstioGateway(ctx context.Context) bool {
	if in.Istio() == nil {
		return false
	}
	return in.capabilityProbe(ctx, "istioGateway", &in.isIstioGateway, func() (bool, bool) {
		res, err := serverResourcesForGroupVersion(ctx, in, NetworkingGroupVersionV1.String())
		if err != nil {
			return false, true
		}
		for _, r := range res.APIResources {
			if r.Kind == GatewayType && r.Name == PluralNames[GatewayType] {
				return true, false
			}
		}
		return false, false
	})
}

// serverResourcesForGroupVersion fetches a group-version's resource list through the
// discovery REST client under the caller's deadline. Discovery's own
// ServerResourcesForGroupVersion takes no context, so a stalled peer would otherwise hold
// the probe (and the client mutex) until the request timeout. The fake discovery client
// used in tests has no REST client; its (context-free) resource lists are used there.
func serverResourcesForGroupVersion(ctx context.Context, in *K8SClient, groupVersion string) (*meta_v1.APIResourceList, error) {
	if rc := in.k8s.Discovery().RESTClient(); rc != nil {
		body, err := rc.Get().AbsPath("/apis/" + groupVersion).Do(ctx).Raw()
		if err != nil {
			return nil, err
		}
		list := &meta_v1.APIResourceList{}
		if err := json.Unmarshal(body, list); err != nil {
			return nil, err
		}
		return list, nil
	}
	return in.k8s.Discovery().ServerResourcesForGroupVersion(groupVersion)
}

// checkGatewayAPIs reports whether the types are present in the group version, and whether
// the answer is transient (the discovery call failed in a way that is not a definitive
// "not installed", e.g. a timeout).
func checkGatewayAPIs(ctx context.Context, in *K8SClient, version string, types map[string]string, isExperimental bool) (present, transient bool) {
	found := 0
	res, err := serverResourcesForGroupVersion(ctx, in, version)
	if err != nil {
		if !errors.IsNotFound(err) {
			// Could not tell (timeout, unreachable): not a definitive absence.
			return false, true
		}
		if !isExperimental {
			log.Debugf("K8s Gateway API CRDs are not installed. Required K8s Gateway API version: %s. Gateway API will not be used.", version)
		}
		return false, false
	}
	for _, r := range res.APIResources {
		if name, foundKind := types[r.Kind]; foundKind && r.Name == name {
			found++
		}
	}
	if found > 0 && found < len(types) {
		keys := make([]string, 0, len(types))
		for key := range types {
			keys = append(keys, key)
		}
		log.Warningf("Not all required K8s Gateway API CRDs are installed for version: %s, expected: %s", version, strings.Join(keys, ", "))
	}
	return found == len(types), false
}

// checkInferenceAPIs reports whether the types are present in the group version, and whether
// the answer is transient. See checkGatewayAPIs.
func checkInferenceAPIs(ctx context.Context, in *K8SClient, version string, types map[string]string) (present, transient bool) {
	found := 0
	res, err := serverResourcesForGroupVersion(ctx, in, version)
	if err != nil {
		if !errors.IsNotFound(err) {
			return false, true
		}
		log.Debugf("K8s Gateway API Inference Extension CRDs are not installed. Required K8s Gateway API Inference Extension version: %s. Gateway API Inference Extension will not be used.", version)
		return false, false
	}
	for _, r := range res.APIResources {
		if name, foundKind := types[r.Kind]; foundKind && r.Name == name {
			found++
		}
	}
	return found == len(types), false
}

// Is IstioAPI checks whether Istio API is installed or not
func (in *K8SClient) IsIstioAPI() bool {
	return in.checkIsIstioAPI(in.ctx)
}

// IsIstioAPIContext is IsIstioAPI under a caller-supplied deadline; see IsGatewayAPIContext.
func (in *K8SClient) IsIstioAPIContext(ctx context.Context) bool {
	return in.checkIsIstioAPI(ctx)
}

func (in *K8SClient) checkIsIstioAPI(ctx context.Context) bool {
	if in.Istio() == nil {
		return false
	}
	return in.capabilityProbe(ctx, "istioAPI", &in.isIstioAPI, func() (bool, bool) {
		_, err := in.k8s.Discovery().RESTClient().Get().AbsPath("/apis/networking.istio.io").Do(ctx).Raw()
		return err == nil, err != nil
	})
}

// GetDeployment returns the definition of a specific deployment.
// It returns an error on any problem.
func (in *K8SClient) GetDeployment(namespace, name string) (*apps_v1.Deployment, error) {
	return in.k8s.AppsV1().Deployments(namespace).Get(in.ctx, name, emptyGetOptions)
}

// GetDeployments returns an array of deployments for a given namespace.
// It returns an error on any problem.
func (in *K8SClient) GetDeployments(namespace string, opts meta_v1.ListOptions) ([]apps_v1.Deployment, error) {
	depList, err := in.k8s.AppsV1().Deployments(namespace).List(in.ctx, opts)
	if err != nil {
		return []apps_v1.Deployment{}, err
	}

	return depList.Items, nil
}

func (in *K8SClient) GetReplicationControllers(namespace string) ([]core_v1.ReplicationController, error) {
	if rcList, err := in.k8s.CoreV1().ReplicationControllers(namespace).List(in.ctx, emptyListOptions); err == nil {
		return rcList.Items, nil
	} else {
		return []core_v1.ReplicationController{}, err
	}
}

// getPodPortForwarder returns a port-forwarder struct which represents an open server forwarding request to the
// requested pod and port
// namespace: name of the namespace where the pod lives in.
// name: name of the pod living in the namespace
// portMap: ports open by the forwarder. Local port and destination port. Format: "80:8080" (local:destination)
// It returns both a portforwarder and an error (if present)
func (in *K8SClient) getPodPortForwarder(namespace, name, portMap string) (httputil.PortForwarder, error) {
	// This branch is just used for testing.
	if in.getPodPortForwarderFunc != nil {
		return in.getPodPortForwarderFunc(namespace, name, portMap)
	}

	// First try whether the pod exist or not
	pod, err := in.GetPod(namespace, name)
	if err != nil {
		log.Errorf("Couldn't fetch the Pod: %v", err)
		return nil, err
	}

	// Prevent the forward if the pod is not running
	if pod.Status.Phase != core_v1.PodRunning {
		return nil, fmt.Errorf("error creating a pod forwarder for a non-running pod: %s/%s", namespace, name)
	}

	// Create a Port Forwarder
	restInterface := in.k8s.CoreV1().RESTClient()
	// io.Discard avoids a data race: client-go's portforward library writes to the
	// output writer from multiple goroutines without synchronization.
	return httputil.NewPortForwarder(restInterface, in.restConfig,
		namespace, name, "localhost", portMap, io.Discard,
		in.conf.KialiInternal.KubernetesClient.PortForwardEstablishTimeout)
}

// GetPod returns the pod definitions for a given pod name.
// It returns an error on any problem.
func (in *K8SClient) GetPod(namespace, name string) (*core_v1.Pod, error) {
	if pod, err := in.k8s.CoreV1().Pods(namespace).Get(in.ctx, name, emptyGetOptions); err != nil {
		return nil, err
	} else {
		return pod, nil
	}
}

// StreamPodLogs opens a connection to progressively fetch the logs of a pod. Callers must make sure to properly close the returned io.ReadCloser.
// It returns an error on any problem. The stream is served by the timeout-free client (a
// request timeout would cap the body read and cut logs short); its establishment is
// bounded by podLogHeaderTimeout (kiali_internal.kubernetes_client.pod_log_header_timeout),
// and the caller's context still cancels an established stream when the client disconnects.
func (in *K8SClient) StreamPodLogs(ctx context.Context, namespace, name string, opts *core_v1.PodLogOptions) (io.ReadCloser, error) {
	client, err := in.podLogsClient()
	if err != nil {
		return nil, err
	}
	req := client.CoreV1().RESTClient().Get().Namespace(namespace).Name(name).Resource("pods").SubResource("log").VersionedParams(opts, scheme.ParameterCodec)

	// Only the stream's establishment is bounded. A plain context.WithTimeout around the
	// whole call (or the request timeout on the client) would also cap the body read and
	// cut logs short, so the timer is stopped as soon as the headers arrive. The child
	// context must then stay alive for the body - client-go ties the response body to the
	// request context - and is released when the caller closes the stream. The parent
	// context still cancels an established stream when the caller goes away. A zero or
	// negative timeout disables the bound (the stream waits for the kernel).
	podLogHeaderTimeout := in.conf.KialiInternal.KubernetesClient.PodLogHeaderTimeout
	childCtx, cancel := context.WithCancel(ctx)
	var timer *time.Timer
	if podLogHeaderTimeout > 0 {
		timer = time.AfterFunc(podLogHeaderTimeout, cancel)
	}
	body, err := req.Stream(childCtx)
	if timer != nil {
		timer.Stop()
	}
	if err != nil {
		cancel()
		if ctx.Err() == nil && childCtx.Err() != nil {
			return nil, fmt.Errorf("timed out after %s waiting for the pod log stream to be established: %w", podLogHeaderTimeout, err)
		}
		return nil, err
	}
	if childCtx.Err() != nil {
		// The deadline fired concurrently with the headers arriving: the body is already
		// tied to a cancelled context and would fail on first read; report the timeout.
		body.Close()
		cancel()
		return nil, fmt.Errorf("timed out after %s waiting for the pod log stream to be established", podLogHeaderTimeout)
	}
	return &podLogStream{ReadCloser: body, cancel: cancel}, nil
}

// podLogStream releases the stream's child context when the caller closes the body: the
// HTTP connection stays tied to that context, so dropping it would leak the connection.
type podLogStream struct {
	io.ReadCloser
	cancel context.CancelFunc
}

func (s *podLogStream) Close() error {
	err := s.ReadCloser.Close()
	s.cancel()
	return err
}

// authzClientSet lazily builds the rate-limit-free clientset used for SelfSubjectAccess
// Reviews (see the authzConfig field comment). Identities that never issue an SSAR never
// pay for the second clientset; concurrent first uses share one build.
func (in *K8SClient) authzClientSet() (kubernetes.Interface, error) {
	in.rwMutex.Lock()
	defer in.rwMutex.Unlock()
	if in.authzClient != nil {
		return in.authzClient, nil
	}
	if in.authzConfig == nil {
		// A K8SClient built directly (tests) has no authz config: fall back to the main
		// clientset and its rate limiter.
		in.authzClient = in.k8s
		return in.authzClient, nil
	}
	client, err := kubernetes.NewForConfigAndClient(in.authzConfig, in.httpClient)
	if err != nil {
		return nil, err
	}
	in.authzClient = client
	return client, nil
}

// podLogsClient lazily builds the timeout-free clientset used for pod log streams. Most
// identities never request logs, so the second clientset (and its rate limiter) is only
// paid for on first use; concurrent first uses share one build.
func (in *K8SClient) podLogsClient() (kubernetes.Interface, error) {
	in.rwMutex.Lock()
	defer in.rwMutex.Unlock()
	if in.logsClient != nil {
		return in.logsClient, nil
	}
	if in.logsConfig == nil {
		// A K8SClient built directly (tests) has no logs config: fall back to the main
		// clientset, whose timeout is whatever the caller's config carried.
		in.logsClient = in.k8s
		return in.logsClient, nil
	}
	httpClient := *in.httpClient
	httpClient.Timeout = 0
	client, err := kubernetes.NewForConfigAndClient(in.logsConfig, &httpClient)
	if err != nil {
		return nil, err
	}
	in.logsClient = client
	return client, nil
}

func (in *K8SClient) GetCronJobs(namespace string) ([]batch_v1.CronJob, error) {
	if cjList, err := in.k8s.BatchV1().CronJobs(namespace).List(in.ctx, emptyListOptions); err == nil {
		return cjList.Items, nil
	} else {
		return []batch_v1.CronJob{}, err
	}
}

func (in *K8SClient) GetJobs(namespace string) ([]batch_v1.Job, error) {
	if jList, err := in.k8s.BatchV1().Jobs(namespace).List(in.ctx, emptyListOptions); err == nil {
		return jList.Items, nil
	} else {
		return []batch_v1.Job{}, err
	}
}

// NewNotFound is a helper method to create a NotFound error similar as used by the kubernetes client.
// This method helps upper layers to send a explicit NotFound error without querying the backend.
func NewNotFound(name, group, resource string) error {
	return errors.NewNotFound(schema.GroupResource{Group: group, Resource: resource}, name)
}

// GetSelfSubjectAccessReview provides information on Kiali permissions
func (in *K8SClient) GetSelfSubjectAccessReview(ctx context.Context, namespace, api, resourceType string, verbs []string) ([]*auth_v1.SelfSubjectAccessReview, error) {
	return selfSubjectAccessReview(ctx, in.k8s, namespace, api, resourceType, verbs)
}

// GetAccessSweepReview uses the service account sweep's independent concurrency budget.
func (in *K8SClient) GetAccessSweepReview(ctx context.Context, namespace, api, resourceType string, verbs []string) ([]*auth_v1.SelfSubjectAccessReview, error) {
	client, err := in.authzClientSet()
	if err != nil {
		return nil, err
	}
	return selfSubjectAccessReview(ctx, client, namespace, api, resourceType, verbs)
}

func selfSubjectAccessReview(ctx context.Context, authz kubernetes.Interface, namespace, api, resourceType string, verbs []string) ([]*auth_v1.SelfSubjectAccessReview, error) {
	if config.IsTracingEnabled() {
		var span trace.Span
		ctx, span = otel.Tracer(observability.TracerName()).Start(ctx, "GetSelfSubjectAccessReview",
			trace.WithAttributes(
				attribute.String("package", "kubernetes"),
				attribute.String("namespace", namespace),
				attribute.String("api", api),
				attribute.String("resourceType", resourceType),
				attribute.StringSlice("verbs", verbs),
			),
		)
		defer span.End()
	}

	calls := len(verbs)
	ch := make(chan *auth_v1.SelfSubjectAccessReview, calls)
	errChan := make(chan error)
	for _, v := range verbs {
		go func(ctx context.Context, verb string) {
			res, err := authz.AuthorizationV1().SelfSubjectAccessReviews().Create(ctx, &auth_v1.SelfSubjectAccessReview{
				Spec: auth_v1.SelfSubjectAccessReviewSpec{
					ResourceAttributes: &auth_v1.ResourceAttributes{
						Namespace: namespace,
						Verb:      verb,
						Group:     api,
						Resource:  resourceType,
					},
				},
			}, meta_v1.CreateOptions{})
			if err != nil {
				errChan <- err
			} else {
				ch <- res
			}
		}(ctx, v)
	}

	var err error
	result := []*auth_v1.SelfSubjectAccessReview{}
	for count := 0; count < calls; count++ {
		select {
		case res := <-ch:
			result = append(result, res)
		case err = <-errChan:
			// No op
		}
	}
	return result, err
}

func (in *K8SClient) UpdateWorkload(namespace string, workloadName string, workloadObj runtime.Object, jsonPatch string, patchType string) (runtime.Object, error) {
	emptyPatchOptions := meta_v1.PatchOptions{}
	bytePatch := []byte(jsonPatch)

	elem := reflect.ValueOf(&workloadObj).Elem()
	// Make sure workloadObj is a pointer we can set.
	if !elem.CanSet() {
		return nil, fmt.Errorf("workloadObj is invalid. Should be a pointer. Got: %T", workloadObj)
	}

	var err error
	var obj runtime.Object
	switch workloadObj.(type) {
	case *apps_v1.Deployment:
		obj, err = in.k8s.AppsV1().Deployments(namespace).Patch(in.ctx, workloadName, GetPatchType(patchType), bytePatch, emptyPatchOptions)
	case *apps_v1.ReplicaSet:
		obj, err = in.k8s.AppsV1().ReplicaSets(namespace).Patch(in.ctx, workloadName, GetPatchType(patchType), bytePatch, emptyPatchOptions)
	case *core_v1.ReplicationController:
		obj, err = in.k8s.CoreV1().ReplicationControllers(namespace).Patch(in.ctx, workloadName, GetPatchType(patchType), bytePatch, emptyPatchOptions)
	case *osapps_v1.DeploymentConfig:
		if in.IsOpenShift() {
			result := &osapps_v1.DeploymentConfig{}
			err = in.k8s.Discovery().RESTClient().Patch(GetPatchType(patchType)).Prefix("apis", "apps.openshift.io", "v1").Namespace(namespace).Resource("deploymentconfigs").SubResource(workloadName).Body(bytePatch).Do(in.ctx).Into(result)
			obj = result
		} else {
			err = NewNotFound(workloadName, "kubernetes", "DeploymentConfig")
		}
	case *apps_v1.StatefulSet:
		obj, err = in.k8s.AppsV1().StatefulSets(namespace).Patch(in.ctx, workloadName, GetPatchType(patchType), bytePatch, emptyPatchOptions)
	case *batch_v1.Job:
		obj, err = in.k8s.BatchV1().Jobs(namespace).Patch(in.ctx, workloadName, GetPatchType(patchType), bytePatch, emptyPatchOptions)
	case *batch_v1.CronJob:
		obj, err = in.k8s.BatchV1().CronJobs(namespace).Patch(in.ctx, workloadName, GetPatchType(patchType), bytePatch, emptyPatchOptions)
	case *core_v1.Pod:
		obj, err = in.k8s.CoreV1().Pods(namespace).Patch(in.ctx, workloadName, GetPatchType(patchType), bytePatch, emptyPatchOptions)
	case *apps_v1.DaemonSet:
		obj, err = in.k8s.AppsV1().DaemonSets(namespace).Patch(in.ctx, workloadName, GetPatchType(patchType), bytePatch, emptyPatchOptions)
	default:
		err = fmt.Errorf("Workload type %T not found", workloadObj)
	}
	if err != nil {
		return nil, err
	}

	elem.Set(reflect.ValueOf(obj))
	return obj, nil
}

func (in *K8SClient) UpdateService(namespace string, name string, jsonPatch string, patchType string) (*core_v1.Service, error) {
	emptyPatchOptions := meta_v1.PatchOptions{}
	bytePatch := []byte(jsonPatch)
	svc, err := in.k8s.CoreV1().Services(namespace).Patch(in.ctx, name, GetPatchType(patchType), bytePatch, emptyPatchOptions)
	if err != nil {
		return nil, err
	}
	return svc, nil
}

func (in *K8SClient) UpdateNamespace(namespace string, jsonPatch string) (*core_v1.Namespace, error) {
	emptyPatchOptions := meta_v1.PatchOptions{}
	bytePatch := []byte(jsonPatch)
	ns, err := in.k8s.CoreV1().Namespaces().Patch(in.ctx, namespace, types.MergePatchType, bytePatch, emptyPatchOptions)
	if err != nil {
		return &core_v1.Namespace{}, err
	}

	return ns, nil
}

// GetTokenSubject returns the subject of the authInfo using
// the TokenReview api
func (in *K8SClient) GetTokenSubject(authInfo *api.AuthInfo) (string, error) {
	tokenReview := &v1.TokenReview{}
	tokenReview.Spec.Token = authInfo.Token

	result, err := in.k8s.AuthenticationV1().TokenReviews().Create(in.ctx, tokenReview, meta_v1.CreateOptions{})

	if err != nil {
		return "", err
	} else if result.Status.Error != "" {
		return "", goerrors.New(result.Status.Error)
	} else {
		return result.Status.User.Username, nil
	}
}

// EnvVarIsTrue tests if both the key is set and the value is true.
// Only use this when env.Value is a boolean string e.g. "true" or "false".
func EnvVarIsTrue(key string, env core_v1.EnvVar) bool {
	return env.Name == key && env.Value == "true"
}

// CacheWaitTimeout is how long the WaitForObject*InCache helpers poll before
// giving up. Tests can lower this to avoid a 5-second per-call penalty when
// the fake kubeCache never reflects writes from a separate fake clientset.
var CacheWaitTimeout = 5 * time.Second

// WaitForObjectUpdateInCache waits for the update to propagate to the cached object. Modifies obj passed
// so don't use it afterward.
func WaitForObjectUpdateInCache(ctx context.Context, kubeCache client.Reader, obj client.Object) error {
	// Copy the resource version then reuse the obj so we have something to copy into.
	currentResourceVersion, err := strconv.Atoi(obj.GetResourceVersion())
	if err != nil {
		return fmt.Errorf("unable to convert currentResourceVersion for obj: %s/%s", obj.GetName(), obj.GetNamespace())
	}

	return wait.PollUntilContextTimeout(ctx, 100*time.Millisecond, CacheWaitTimeout, true, func(ctx context.Context) (bool, error) {
		if err := kubeCache.Get(ctx, client.ObjectKeyFromObject(obj), obj); err != nil {
			return false, err
		}

		// By convention, you are not supposed to convert this and do int comparisons.
		// The API definition wants you to treat the ResourceVersion as an opaque string
		// but in this case we want to if our update was picked up by the cache and there
		// may have been other updates before or after that change the RV so simply
		// compare a.RV != b.RV.
		// Generation only gets incremented when modifying the spec so that won't work either.
		cachedResourceVersion, err := strconv.Atoi(obj.GetResourceVersion())
		if err != nil {
			return false, fmt.Errorf("unable to convert cachedResourceVersion for obj: %s/%s", obj.GetName(), obj.GetNamespace())
		}

		// Our change has been propagated to the cache if the newRV from the object in the cache is >= the RV
		// of the object when we submitted the change. It may be greater than because something else may have
		// changed it but the cache only saw the last change.
		if cachedResourceVersion < currentResourceVersion {
			return false, nil
		}

		return true, nil
	})
}

// WaitForObjectDeleteInCache waits for the object to be deleted from the cache.
func WaitForObjectDeleteInCache(ctx context.Context, kubeCache client.Reader, obj client.Object) error {
	currentUID := obj.GetUID()
	return wait.PollUntilContextTimeout(ctx, 100*time.Millisecond, CacheWaitTimeout, true, func(ctx context.Context) (bool, error) {
		if err := kubeCache.Get(ctx, client.ObjectKeyFromObject(obj), obj); err != nil {
			if errors.IsNotFound(err) {
				return true, nil
			}
			return false, err
		}

		// It's possible that something else recreated the object by the time we see the change.
		// The UID will change if this happened so if the UID has changed then the original object
		// was actually deleted.
		return currentUID != obj.GetUID(), nil
	})
}

// WaitForObjectCreateInCache waits for the object to be exist in the cache.
// This probably isn't 100% reliable since something could delete the object
// after it is created and before we have a chance to see it.
func WaitForObjectCreateInCache(ctx context.Context, kubeCache client.Reader, obj client.Object) error {
	return wait.PollUntilContextTimeout(ctx, 100*time.Millisecond, CacheWaitTimeout, true, func(ctx context.Context) (bool, error) {
		if err := kubeCache.Get(ctx, client.ObjectKeyFromObject(obj), obj); err != nil {
			if errors.IsNotFound(err) {
				return false, nil
			}
			return false, err
		}

		return true, nil
	})
}

// KubeConfigDir tries to find the location of your kubeconfig.
func KubeConfigDir() string {
	if kubeEnv, ok := os.LookupEnv("KUBECONFIG"); ok {
		return kubeEnv
	}
	if homedir, err := os.UserHomeDir(); err == nil {
		return path.Join(homedir, ".kube/config")
	}
	return ""
}

// EnsureTypeMeta ensures that the TypeMeta (APIVersion and Kind) is set on the object.
// If the object is a list, it sets TypeMeta for each item in the list that doesn't already have it.
// This is useful when objects are retrieved from the cache which may not have TypeMeta populated.
func EnsureTypeMeta(obj runtime.Object) error {
	if meta.IsListType(obj) {
		return meta.EachListItem(obj, func(item runtime.Object) error {
			return setTypeMetaIfMissing(item)
		})
	}

	return setTypeMetaIfMissing(obj)
}

// setTypeMetaIfMissing sets the TypeMeta on an object if it's not already set.
func setTypeMetaIfMissing(obj runtime.Object) error {
	accessor, err := meta.TypeAccessor(obj)
	if err != nil {
		return fmt.Errorf("failed to get type accessor: %w", err)
	}

	if accessor.GetAPIVersion() != "" && accessor.GetKind() != "" {
		return nil
	}

	gvk, err := apiutil.GVKForObject(obj, Scheme)
	if err != nil {
		return fmt.Errorf("failed to get GVK for object: %w", err)
	}

	accessor.SetAPIVersion(gvk.GroupVersion().String())
	accessor.SetKind(gvk.Kind)

	return nil
}
