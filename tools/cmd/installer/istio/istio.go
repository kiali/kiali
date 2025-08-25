package istio

import (
	"context"
	"fmt"
	"strings"

	sailv1 "github.com/istio-ecosystem/sail-operator/api/v1"
	"github.com/rs/zerolog"

	"google.golang.org/protobuf/types/known/wrapperspb"
	telemetryv1alpha1 "istio.io/api/telemetry/v1alpha1"
	istiotelemetryv1 "istio.io/client-go/pkg/apis/telemetry/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	applycorev1 "k8s.io/client-go/applyconfigurations/core/v1"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/utils/ptr"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/tools/cmd/installer/command"
)

func newScheme() *runtime.Scheme {
	s := runtime.NewScheme()
	_ = sailv1.AddToScheme(s)
	_ = corev1.AddToScheme(s)
	_ = istiotelemetryv1.AddToScheme(s)
	return s
}

func clientForContext(kubeContext string) (client.Client, error) {
	rules := clientcmd.NewDefaultClientConfigLoadingRules()
	config, err := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		rules,
		&clientcmd.ConfigOverrides{CurrentContext: kubeContext},
	).ClientConfig()
	if err != nil {
		return nil, fmt.Errorf("building rest config for %s: %w", kubeContext, err)
	}

	return client.New(config, client.Options{Scheme: newScheme()})
}

const istioVersion = "v1.29-latest"

// Install installs the Sail Operator via helm, creates the Istio CR,
// installs addons, and enables otel tracing on the given cluster.
// It returns the created Istio resource. The caller should wait for it
// to be ready before proceeding with steps that depend on Istio.
func Install(ctx context.Context, kubeContext, clusterName, meshID, network string, logger *zerolog.Logger) (*sailv1.Istio, error) {
	logger.Info().Msgf("Installing Sail Operator on %s", kubeContext)

	if err := command.Command("helm", "upgrade", "sail-operator", "sail-operator",
		"--install",
		"--create-namespace",
		"--namespace", "sail-operator",
		"--wait",
		"--kube-context", kubeContext,
		"--repo", "https://istio-ecosystem.github.io/sail-operator",
	).Run(); err != nil {
		return nil, err
	}

	istio, err := createIstioResource(ctx, kubeContext, clusterName, meshID, network, logger)
	if err != nil {
		return nil, err
	}

	if err := installAddons(kubeContext, istioVersion, []string{"prometheus", "grafana", "jaeger"}, logger); err != nil {
		return nil, err
	}

	if err := enableOtelTracing(ctx, kubeContext); err != nil {
		return nil, err
	}

	return istio, nil
}

// WaitReady blocks until the Istio resource is ready.
func WaitReady(kubeContext string, logger *zerolog.Logger) error {
	logger.Info().Msgf("Waiting for Istio to be ready on %s", kubeContext)
	return command.Command("kubectl", "--context", kubeContext,
		"wait", "--for=condition=Ready", "istios", "-l", "kiali.io/testing", "--timeout=300s").Run()
}

func createIstioResource(ctx context.Context, kubeContext, clusterName, meshID, network string, logger *zerolog.Logger) (*sailv1.Istio, error) {
	logger.Info().Msgf("Creating Istio resource on %s (cluster=%s, mesh=%s, network=%s)", kubeContext, clusterName, meshID, network)

	cl, err := clientForContext(kubeContext)
	if err != nil {
		return nil, err
	}

	fieldOwner := client.FieldOwner("kiali-installer")
	forceOwnership := client.ForceOwnership

	ns := applycorev1.Namespace("istio-system")
	if err := cl.Apply(ctx, ns, fieldOwner, forceOwnership); err != nil {
		return nil, fmt.Errorf("applying istio-system namespace on %s: %w", kubeContext, err)
	}

	otelService := "jaeger-collector.istio-system.svc.cluster.local"
	otelPort := uint32(4317)
	smallReq := corev1.ResourceList{
		corev1.ResourceCPU:    resource.MustParse("1m"),
		corev1.ResourceMemory: resource.MustParse("1Mi"),
	}

	istio := &sailv1.Istio{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "sailoperator.io/v1",
			Kind:       "Istio",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name: "default",
			Labels: map[string]string{
				"kiali.io/testing": "",
			},
		},
		Spec: sailv1.IstioSpec{
			Version:   istioVersion,
			Namespace: "istio-system",
			UpdateStrategy: &sailv1.IstioUpdateStrategy{
				Type: sailv1.UpdateStrategyTypeInPlace,
			},
			Values: &sailv1.Values{
				MeshConfig: &sailv1.MeshConfig{
					EnableTracing: ptr.To(true),
					ExtensionProviders: []*sailv1.MeshConfigExtensionProvider{
						{
							Name: ptr.To("otel-tracing"),
							Opentelemetry: &sailv1.MeshConfigExtensionProviderOpenTelemetryTracingProvider{
								Service: &otelService,
								Port:    &otelPort,
							},
						},
					},
				},
				Global: &sailv1.GlobalConfig{
					MeshID:  ptr.To(meshID),
					Network: ptr.To(network),
					MultiCluster: &sailv1.MultiClusterConfig{
						ClusterName: ptr.To(clusterName),
					},
					Proxy: &sailv1.ProxyConfig{
						Resources: &corev1.ResourceRequirements{
							Requests: smallReq,
						},
					},
					ProxyInit: &sailv1.ProxyInitConfig{
						Resources: &corev1.ResourceRequirements{
							Requests: smallReq,
						},
					},
				},
				Pilot: &sailv1.PilotConfig{
					Resources: &corev1.ResourceRequirements{
						Requests: smallReq,
					},
				},
			},
		},
	}

	if err := cl.Patch(ctx, istio, client.Apply, fieldOwner, forceOwnership); err != nil { //nolint:staticcheck
		return nil, fmt.Errorf("applying Istio resource on %s: %w", kubeContext, err)
	}

	return istio, nil
}

// istioMinor extracts the minor version from a sail version string.
// "v1.29-latest" -> "1.29", "v1.29.2" -> "1.29".
func istioMinor(version string) string {
	v := strings.TrimPrefix(version, "v")
	parts := strings.SplitN(v, ".", 3)
	if len(parts) >= 2 {
		// Handle "1.29-latest" by stripping anything after a hyphen in the minor.
		minor := strings.SplitN(parts[1], "-", 2)[0]
		return parts[0] + "." + minor
	}
	return v
}

func installAddons(kubeContext, version string, addons []string, logger *zerolog.Logger) error {
	minor := istioMinor(version)

	for _, addon := range addons {
		logger.Info().Msgf("Installing addon %s on %s", addon, kubeContext)
		url := fmt.Sprintf("https://raw.githubusercontent.com/istio/istio/refs/heads/release-%s/samples/addons/%s.yaml", minor, addon)

		if err := command.Command("bash", "-c",
			fmt.Sprintf(`curl -s "%s" | yq 'select(.metadata) | .metadata.namespace = "istio-system"' - | kubectl --context %s apply -n istio-system -f -`,
				url, kubeContext)).Run(); err != nil {
			return err
		}
	}

	return nil
}

func enableOtelTracing(ctx context.Context, kubeContext string) error {
	cl, err := clientForContext(kubeContext)
	if err != nil {
		return err
	}

	telemetry := &istiotelemetryv1.Telemetry{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "telemetry.istio.io/v1",
			Kind:       "Telemetry",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      "otel-tracing",
			Namespace: "istio-system",
		},
		Spec: telemetryv1alpha1.Telemetry{
			Tracing: []*telemetryv1alpha1.Tracing{
				{
					Providers: []*telemetryv1alpha1.ProviderRef{
						{Name: "otel-tracing"},
					},
					RandomSamplingPercentage: &wrapperspb.DoubleValue{Value: 100},
				},
			},
		},
	}

	// The istio client-go apply configurations don't implement
	// runtime.ApplyConfiguration yet, so use the deprecated Patch-based SSA.
	if err := cl.Patch(ctx, telemetry, client.Apply, client.FieldOwner("kiali-installer"), client.ForceOwnership); err != nil { //nolint:staticcheck
		return fmt.Errorf("applying Telemetry resource on %s: %w", kubeContext, err)
	}

	return nil
}
