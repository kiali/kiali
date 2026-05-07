package bookinfo

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog"
	"golang.org/x/sync/errgroup"
	applycorev1 "k8s.io/client-go/applyconfigurations/core/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"

	installclient "github.com/kiali/kiali/tools/cmd/installer/client"
	"github.com/kiali/kiali/tools/cmd/installer/command"
	pathutil "github.com/kiali/kiali/util/path"
)

const namespace = "bookinfo"

func kubectl(ctx string, args ...string) *command.Cmd {
	return command.Command("kubectl", append([]string{"--context", ctx}, args...)...)
}

func findIstioDir() (string, error) {
	outputDir := filepath.Join(pathutil.ProjectRoot, "_output")
	entries, err := os.ReadDir(outputDir)
	if err != nil {
		return "", fmt.Errorf("reading _output dir: %w", err)
	}
	// Walk in reverse to find the most recent istio-* directory (ReadDir returns sorted).
	for i := len(entries) - 1; i >= 0; i-- {
		e := entries[i]
		if e.IsDir() && strings.HasPrefix(e.Name(), "istio-") {
			return filepath.Join(outputDir, e.Name()), nil
		}
	}
	return "", fmt.Errorf("no istio-* directory found in %s; run hack/istio/download-istio.sh first", outputDir)
}

// Install deploys Bookinfo across east and west clusters for multi-primary testing.
// East runs productpage, details, reviews-v1; west runs reviews-v2, reviews-v3, ratings.
func Install(ctx context.Context, eastClient, westClient installclient.KubeContextClient, logger *zerolog.Logger) error {
	istioDir, err := findIstioDir()
	if err != nil {
		return err
	}
	logger.Info().Msgf("Using Istio samples from %s", istioDir)

	bookinfoYAML := filepath.Join(istioDir, "samples", "bookinfo", "platform", "kube", "bookinfo.yaml")
	gatewayYAML := filepath.Join(istioDir, "samples", "bookinfo", "networking", "bookinfo-gateway.yaml")

	// Deploy bookinfo to both clusters in parallel.
	var g errgroup.Group
	for _, cl := range []installclient.KubeContextClient{eastClient, westClient} {
		g.Go(func() error {
			return deployBookinfo(ctx, cl, bookinfoYAML, gatewayYAML, logger)
		})
	}
	if err := g.Wait(); err != nil {
		return err
	}

	// Scale down and apply traffic rules on both clusters in parallel.
	g = errgroup.Group{}
	g.Go(func() error {
		return configureEast(eastClient.KubeContext(), logger)
	})
	g.Go(func() error {
		return configureWest(westClient.KubeContext(), logger)
	})
	if err := g.Wait(); err != nil {
		return err
	}

	// Install traffic generator on east.
	return installTrafficGenerator(ctx, eastClient, logger)
}

func deployBookinfo(ctx context.Context, cl installclient.KubeContextClient, bookinfoYAML, gatewayYAML string, logger *zerolog.Logger) error {
	kubeContext := cl.KubeContext()
	logger.Info().Msgf("Deploying bookinfo on %s", kubeContext)

	fieldOwner := client.FieldOwner("kiali-installer")
	forceOwnership := client.ForceOwnership

	ns := applycorev1.Namespace(namespace).
		WithLabels(map[string]string{"istio-injection": "enabled"})
	if err := cl.Apply(ctx, ns, fieldOwner, forceOwnership); err != nil {
		return fmt.Errorf("applying bookinfo namespace on %s: %w", kubeContext, err)
	}

	if err := kubectl(kubeContext, "apply", "-n", namespace, "-f", bookinfoYAML).Run(); err != nil {
		return fmt.Errorf("applying bookinfo on %s: %w", kubeContext, err)
	}
	if err := kubectl(kubeContext, "apply", "-n", namespace, "-f", gatewayYAML).Run(); err != nil {
		return fmt.Errorf("applying gateway on %s: %w", kubeContext, err)
	}
	return nil
}

func configureEast(ctx string, logger *zerolog.Logger) error {
	logger.Info().Msg("Configuring east cluster bookinfo (scaling down reviews-v2, reviews-v3, ratings-v1)")

	for _, deploy := range []string{"reviews-v2", "reviews-v3", "ratings-v1"} {
		if err := kubectl(ctx, "scale", "deploy", "-n", namespace, deploy, "--replicas=0").Run(); err != nil {
			return fmt.Errorf("scaling %s on east: %w", deploy, err)
		}
	}
	return applyTrafficShiftingRules(ctx)
}

func configureWest(ctx string, logger *zerolog.Logger) error {
	logger.Info().Msg("Configuring west cluster bookinfo (scaling down productpage-v1, details-v1, reviews-v1)")

	for _, deploy := range []string{"productpage-v1", "details-v1", "reviews-v1"} {
		if err := kubectl(ctx, "scale", "deploy", "-n", namespace, deploy, "--replicas=0").Run(); err != nil {
			return fmt.Errorf("scaling %s on west: %w", deploy, err)
		}
	}
	return applyTrafficShiftingRules(ctx)
}

func applyTrafficShiftingRules(ctx string) error {
	rules := fmt.Sprintf(`apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: reviews
  namespace: %[1]s
spec:
  hosts:
    - reviews.%[1]s.svc.cluster.local
  http:
    - route:
        - destination:
            host: reviews.%[1]s.svc.cluster.local
            subset: v1
          weight: 33
        - destination:
            host: reviews.%[1]s.svc.cluster.local
            subset: v2
          weight: 33
        - destination:
            host: reviews.%[1]s.svc.cluster.local
            subset: v3
          weight: 34
---
kind: DestinationRule
apiVersion: networking.istio.io/v1
metadata:
  name: reviews
  namespace: %[1]s
spec:
  host: reviews.%[1]s.svc.cluster.local
  subsets:
    - name: v1
      labels:
        version: v1
    - name: v2
      labels:
        version: v2
    - name: v3
      labels:
        version: v3
`, namespace)

	return kubectl(ctx, "apply", "-f", "-").WithInput(strings.NewReader(rules)).Run()
}

func installTrafficGenerator(ctx context.Context, cl installclient.KubeContextClient, logger *zerolog.Logger) error {
	kubeContext := cl.KubeContext()
	logger.Info().Msg("Installing traffic generator on east cluster")

	// Wait for the istio-ingressgateway LoadBalancer to be assigned an IP.
	if err := kubectl(kubeContext, "wait", "--for=jsonpath={.status.loadBalancer.ingress}",
		"-n", "istio-system", "service/istio-ingressgateway", "--timeout=300s",
	).Run(); err != nil {
		return fmt.Errorf("waiting for ingressgateway LB IP: %w", err)
	}

	ip, err := command.Command("kubectl", "--context", kubeContext,
		"-n", "istio-system", "get", "svc", "istio-ingressgateway",
		"-o", "jsonpath={.status.loadBalancer.ingress[0].ip}",
	).Output()
	if err != nil {
		return fmt.Errorf("getting ingressgateway IP: %w", err)
	}
	ip = strings.TrimSpace(ip)

	route := fmt.Sprintf("http://%s:80/productpage", ip)
	logger.Info().Msgf("Traffic generator route: %s", route)

	fieldOwner := client.FieldOwner("kiali-installer")
	forceOwnership := client.ForceOwnership

	cm := applycorev1.ConfigMap("traffic-generator-config", namespace).
		WithData(map[string]string{
			"duration": "0s",
			"rate":     "1",
			"route":    route,
			"silent":   "true",
		})
	if err := cl.Apply(ctx, cm, fieldOwner, forceOwnership); err != nil {
		return fmt.Errorf("applying traffic generator configmap: %w", err)
	}

	trafficGenURL := "https://raw.githubusercontent.com/kiali/kiali-test-mesh/master/traffic-generator/openshift/traffic-generator.yaml"
	if err := kubectl(kubeContext, "apply", "--validate=false", "-n", namespace, "-f", trafficGenURL).Run(); err != nil {
		return fmt.Errorf("applying traffic generator: %w", err)
	}

	return nil
}
