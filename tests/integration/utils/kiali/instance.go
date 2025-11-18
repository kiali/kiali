package kiali

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/go-cmp/cmp"
	kubeerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/util/retry"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tests/integration/utils/kube"
)

var kialiGroupVersionResource = schema.GroupVersionResource{Group: "kiali.io", Version: "v1alpha1", Resource: "kialis"}

// NewInstance finds the kiali instance deployed in the cluster and creates an Instance out of it.
// Assumes there's only a single Kiali deployed to the cluster.
func NewInstance(ctx context.Context, kubeClient kubernetes.Interface, dynamicClient dynamic.Interface) (*Instance, error) {
	log.Debug("Finding Kiali Instance")

	var kialiCRDExists bool
	if _, err := kubeClient.Discovery().RESTClient().Get().AbsPath("/apis/kiali.io").DoRaw(ctx); err != nil {
		// If it's an error other than NotFound then we should return it since we can't determine if the CRD exists.
		if !kubeerrors.IsNotFound(err) {
			return nil, err
		}
		// Otherwise we know the CRD doesn't exist because it's a not found error so keep the default of false.
		log.Debug("Kiali CRD does not exist. Kiali must be deployed with helm.")
	} else {
		log.Debug("Kiali CRD exists. Kiali must be deployed with the operator.")
		kialiCRDExists = true
	}

	instance := &Instance{
		kubeClient:    kubeClient,
		dynamicClient: dynamicClient,
		useKialiCR:    kialiCRDExists,
	}

	if kialiCRDExists {
		kialiCRs, err := dynamicClient.Resource(kialiGroupVersionResource).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}

		if len(kialiCRs.Items) > 1 {
			return nil, fmt.Errorf("expecting only one Kiali CR but found %d", len(kialiCRs.Items))
		}

		kialiCR := kialiCRs.Items[0]
		instance.Name = kialiCR.GetName()
		instance.Namespace = kialiCR.GetNamespace()
		instance.ResourceNamespace = instance.Namespace

		// If the CR has a spec.deployment.namespace then all the kiali resources will be deployed
		// in that namespace rather than the namespace of the CR.
		if spec, ok := kialiCR.Object["spec"].(map[string]interface{}); ok {
			if deployment, ok := spec["deployment"].(map[string]interface{}); ok {
				if namespace, ok := deployment["namespace"].(string); ok {
					instance.ResourceNamespace = namespace
				}
			}
		}
		log.Debugf("Found Kiali CR: [%s] in namespace: [%s]. All Kiali CR resources are in namespace: [%s].", instance.Name, instance.Namespace, instance.ResourceNamespace)
	} else {
		kialiDeployments, err := kubeClient.AppsV1().Deployments(metav1.NamespaceAll).List(ctx, metav1.ListOptions{LabelSelector: "app=kiali"})
		if err != nil {
			return nil, err
		}

		if len(kialiDeployments.Items) > 1 {
			return nil, fmt.Errorf("expecting only one Kiali deployment but found %d", len(kialiDeployments.Items))
		}

		kialiDeployment := kialiDeployments.Items[0]
		instance.Name = kialiDeployment.Name
		instance.Namespace = kialiDeployment.Namespace
		instance.ResourceNamespace = instance.Namespace

		log.Debugf("Found Kiali deployment: [%s] in namespace: [%s]. All Kiali resources are in namespace: [%s].", instance.Name, instance.Namespace, instance.ResourceNamespace)
	}

	return instance, nil
}

// Instance is a single deployment of Kiali. It abstracts away the differences between
// Kiali deployed with the operator and Kiali deployed with helm and provides an interface
// for interacting with the Kiali instance for actions like updating the Kiali config.
type Instance struct {
	dynamicClient dynamic.Interface
	kubeClient    kubernetes.Interface

	// Name of the kiali instance. Either the name of the CR or the name of the deployment.
	Name string

	// Namespace of the kiali instance. Either the namespace of the CR or the namespace of the deployment.
	Namespace string

	// ResourceNamespace is the namespace where the Kiali resources are deployed aka spec.deployment.namespace.
	ResourceNamespace string

	useKialiCR bool
}

// GetConfig fetches the kiali configuration from the kiali configmap.
func (in *Instance) GetConfig(ctx context.Context) (*config.Config, error) {
	cm, err := in.kubeClient.CoreV1().ConfigMaps(in.ResourceNamespace).Get(ctx, in.Name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	currentConfig, err := config.Unmarshal(cm.Data["config.yaml"])
	currentConfig.ExternalServices.Tracing.Enabled = true
	if err != nil {
		return nil, err
	}

	return currentConfig, nil
}

// sanitizeConfigForCR removes fields from the config that are not valid in the Kiali CR spec.
// This only removes fields that NEVER existed in the CRD schema or are runtime-only.
// It does NOT remove deprecated fields since they may still be valid in older versions.
func sanitizeConfigForCR(configYAML string) (string, error) {
	// Convert YAML to JSON to work with unstructured data
	jsonData, err := yaml.ToJSON([]byte(configYAML))
	if err != nil {
		return "", err
	}

	var data map[string]any
	if err := json.Unmarshal(jsonData, &data); err != nil {
		return "", err
	}

	// Remove fields that NEVER existed in the Kiali CR schema
	// These are truly unknown/invalid fields that cause warnings

	// Remove unknown fields from auth
	if auth, ok := data["auth"].(map[string]any); ok {
		if openshift, ok := auth["openshift"].(map[string]any); ok {
			delete(openshift, "server_prefix") // Not in current CRD schema
		}
	}

	// Remove unknown fields from deployment (never in CRD schema)
	if deployment, ok := data["deployment"].(map[string]any); ok {
		delete(deployment, "remote_secret_path")   // Never in CRD schema
		delete(deployment, "accessiblenamespaces") // Deprecated but still used internally; it should not be in the config
		// Note: accessible_namespaces IS in CRD schema (even if deprecated in later versions), so keep it
	}

	// Remove unknown fields from external_services
	if externalServices, ok := data["external_services"].(map[string]any); ok {
		if istio, ok := externalServices["istio"].(map[string]any); ok {
			delete(istio, "registry") // Never in CRD schema
		}
		// Remove token field from perses.auth (not in CRD schema)
		if perses, ok := externalServices["perses"].(map[string]any); ok {
			if auth, ok := perses["auth"].(map[string]any); ok {
				delete(auth, "token") // Not in CRD schema
			}
		}
	}

	// Remove unknown fields from istio_labels (never in CRD schema)
	if istioLabels, ok := data["istio_labels"].(map[string]any); ok {
		// These ambient fields were never in any CRD version
		delete(istioLabels, "ambient_namespace_label")
		delete(istioLabels, "ambient_namespace_label_value")
		delete(istioLabels, "ambient_waypoint_label")
		delete(istioLabels, "ambient_waypoint_label_value")
		delete(istioLabels, "ambient_waypoint_use_label")
		delete(istioLabels, "ambient_waypoint_gateway_label")
		delete(istioLabels, "injection_label")            // Not in current CRD schema
		delete(istioLabels, "service_canonical_name")     // Not in current CRD schema
		delete(istioLabels, "service_canonical_revision") // Not in current CRD schema
	}

	// Fix invalid enum values in kiali_feature_flags
	if kialiFeatureFlags, ok := data["kiali_feature_flags"].(map[string]any); ok {
		if uiDefaults, ok := kialiFeatureFlags["ui_defaults"].(map[string]any); ok {
			// Fix refresh_interval: "60s" should be "1m"
			if refreshInterval, ok := uiDefaults["refresh_interval"].(string); ok && refreshInterval == "60s" {
				uiDefaults["refresh_interval"] = "1m"
			}
			// Remove invalid graph fields (never in CRD schema)
			if graph, ok := uiDefaults["graph"].(map[string]any); ok {
				delete(graph, "impl")
				if settings, ok := graph["settings"].(map[string]any); ok {
					delete(settings, "font_label")
					delete(settings, "min_font_badge")
					delete(settings, "min_font_label")
				}
			}
		}
	}

	// Remove unknown server fields (never in CRD schema)
	if server, ok := data["server"].(map[string]any); ok {
		delete(server, "static_content_root_directory")
		if observability, ok := server["observability"].(map[string]any); ok {
			if tracing, ok := observability["tracing"].(map[string]any); ok {
				// Remove collector_type if it's "jaeger" (only "otel" is valid)
				if collectorType, ok := tracing["collector_type"].(string); ok && collectorType == "jaeger" {
					delete(tracing, "collector_type")
				}
			}
		}
	}

	// Remove runtime-only fields that were never in any CRD schema version
	// These fields are server runtime state, not configuration
	delete(data, "in_cluster") // Never in CRD schema (deprecated/internal field)
	delete(data, "runConfig")  // Runtime-only field for offline mode
	delete(data, "runMode")    // Runtime-only field (app/local/offline)

	// Convert back to JSON
	cleanedJSON, err := json.Marshal(data)
	if err != nil {
		return "", err
	}

	return string(cleanedJSON), nil
}

// UpdateConfig will update the Kiali instance with the new config. It will ensure
// that the underlying configmap is actually updated before returning.
func (in *Instance) UpdateConfig(ctx context.Context, conf *config.Config) error {
	log.Debug("Updating Kiali config")
	// Update the configmap directly by getting the configmap and patching it.
	if in.useKialiCR {
		// Before we patch the Kiali CR, get the current configmap so that later we can ensure the configmap is updated.
		cm, err := in.kubeClient.CoreV1().ConfigMaps(in.ResourceNamespace).Get(ctx, in.Name, metav1.GetOptions{})
		if err != nil {
			return err
		}

		// Fetch the Kiali CR and update the config on it.
		// Update the Kiali CR
		newConfig, err := config.Marshal(conf)
		if err != nil {
			return err
		}

		log.Debugf("Diff between old config and new config: %s\n", cmp.Diff(cm.Data["config.yaml"], newConfig))

		// Sanitize the config to remove fields that are not valid in the Kiali CR spec
		sanitizedConfig, err := sanitizeConfigForCR(newConfig)
		if err != nil {
			return fmt.Errorf("failed to sanitize config for CR: %w", err)
		}

		mergePatch := []byte(fmt.Sprintf(`{"spec": %s}`, sanitizedConfig))
		_, err = in.dynamicClient.Resource(kialiGroupVersionResource).Namespace(in.Namespace).Patch(ctx, in.Name, types.MergePatchType, mergePatch, metav1.PatchOptions{})
		if err != nil {
			return err
		}

		// Need to know when the kiali operator has seen the CR change and finished updating
		// the configmap. There's no ObservedGeneration on the Kiali CR so just checking the configmap itself.
		timeout := 5 * time.Minute
		pollInterval := 10 * time.Second

		return wait.PollUntilContextTimeout(ctx, pollInterval, timeout, true, func(ctx context.Context) (bool, error) {
			log.Debug("Waiting for kiali configmap to update")
			currentConfigMap, err := in.kubeClient.CoreV1().ConfigMaps(in.ResourceNamespace).Get(ctx, in.Name, metav1.GetOptions{})
			if err != nil {
				return false, err
			}

			return currentConfigMap.ResourceVersion != cm.ResourceVersion, nil
		})
	} else {

		// Update the configmap directly. It's important to use yaml.Marshal because the config struct
		// doesn't have json tags.
		newConfig, err := config.Marshal(conf)
		if err != nil {
			return err
		}

		cm, err := in.kubeClient.CoreV1().ConfigMaps(in.ResourceNamespace).Get(ctx, in.Name, metav1.GetOptions{})
		if err != nil {
			return err
		}

		log.Debugf("Diff between old config and new config: %s\n", cmp.Diff(cm.Data["config.yaml"], newConfig))

		cm.Data["config.yaml"] = newConfig

		_, err = in.kubeClient.CoreV1().ConfigMaps(in.ResourceNamespace).Update(ctx, cm, metav1.UpdateOptions{})
		if err != nil {
			return err
		}
	}

	return nil
}

func restartDeployment(ctx context.Context, clientset kubernetes.Interface, namespace, deploymentName string) error {
	retryErr := retry.RetryOnConflict(retry.DefaultRetry, func() error {
		deployment, err := clientset.AppsV1().Deployments(namespace).Get(ctx, deploymentName, metav1.GetOptions{})
		if err != nil {
			return err
		}

		// Update the pod template annotation to trigger a rolling restart
		if deployment.Spec.Template.Annotations == nil {
			deployment.Spec.Template.Annotations = make(map[string]string)
		}
		deployment.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = time.Now().Format(time.RFC3339)

		_, err = clientset.AppsV1().Deployments(namespace).Update(ctx, deployment, metav1.UpdateOptions{})
		return err
	})

	return retryErr
}

// Restart will recreate the Kiali pod and wait for it to be ready.
func (in *Instance) Restart(ctx context.Context) error {
	log.Debug("Restarting Kiali deployment")
	if err := restartDeployment(ctx, in.kubeClient, in.ResourceNamespace, in.Name); err != nil {
		return err
	}

	log.Debug("Waiting for Kiali deployment to be ready")
	if err := kube.WaitForDeploymentReady(ctx, in.kubeClient, in.ResourceNamespace, in.Name); err != nil {
		return err
	}

	log.Debug("Kiali is ready")

	return nil
}
