package istio

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"slices"
	"strings"

	corev1 "k8s.io/api/core/v1"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

var (
	// Example OpenShift Service Mesh 1.1 product version is:
	//   OSSM_1.1.0-291c5419cf19d2b015e7e5dee970c458fb8f1982-Clean
	// Example Istio snapshot version is:
	//   root@f72e3d3ef3c2-docker.io/istio-release-1.0-20180927-21-10-cbe9c05c470ec1924f7bcf02334b183e7e6175cb-Clean
	// Example Istio alpha RC version is:
	//   1.7.0-alpha.1-cd46a166947eac363380c3aa3523b26a8c391f98-dirty-Modified
	// Example Istio dev version is:
	//   1.5-alpha.dbd2aca8887fb42c2bb358417621a78de372f906-dbd2aca8887fb42c2bb358417621a78de372f906-Clean
	//   1.10-dev-65a124dc2ab69f91331298fbf6d9b4335abcf0fd-Clean
	ossmVersionExpr          = regexp.MustCompile(`(?:OSSM_|openshift-service-mesh-)([0-9]+\.[0-9]+\.[0-9]+(?:-tp\.[0-9]+)?)`)
	istioDevVersionExpr      = regexp.MustCompile(`(\d+\.\d+)-alpha\.([[:alnum:]]+)-.*|(\d+\.\d+)-dev-([[:alnum:]]+)-.*`)
	istioRCVersionExpr       = regexp.MustCompile(`(\d+\.\d+.\d+)-((?:alpha|beta|rc|RC)\.\d+)`)
	istioSnapshotVersionExpr = regexp.MustCompile(`istio-release-([0-9]+\.[0-9]+)(-[0-9]{8})`)
	istioVersionExpr         = regexp.MustCompile(`([0-9]+\.[0-9]+\.[0-9]+)`)
)

const (
	istioProductNameOSSM             = "OpenShift Service Mesh"
	istioProductNameUpstream         = "Istio"
	istioProductNameUpstreamSnapshot = "Istio Snapshot"
	istioProductNameUpstreamRC       = "Istio RC"
	istioProductNameUpstreamDev      = "Istio Dev"
	istioProductNameUnknown          = "Unknown Istio Implementation"
)

func parseRawIstioVersion(rawVersion string) *models.ExternalServiceInfo {
	product := models.ExternalServiceInfo{Name: "Unknown", Version: "Unknown"}

	// First see if it is upstream Istio (either a release or snapshot).
	// If it is not then it is some unknown Istio implementation that we do not support.

	// OpenShift Service Mesh
	ossmStringArr := ossmVersionExpr.FindStringSubmatch(rawVersion)
	if ossmStringArr != nil {
		log.Debugf("Detected OpenShift Service Mesh version [%v]", rawVersion)
		if len(ossmStringArr) > 1 {
			product.Name = istioProductNameOSSM
			product.Version = ossmStringArr[1] // get regex group #1 ,which is the "#.#.#" version string

			// we know this is OpenShift Service Mesh - either a supported or unsupported version - return now
			return &product
		}
	}

	// see if it is a snapshot version of Istio
	istioVersionStringArr := istioSnapshotVersionExpr.FindStringSubmatch(rawVersion)
	if istioVersionStringArr != nil {
		log.Debugf("Detected Istio snapshot version [%v]", rawVersion)
		if len(istioVersionStringArr) > 2 {
			product.Name = istioProductNameUpstreamSnapshot
			majorMinor := istioVersionStringArr[1]  // regex group #1 is the "#.#" version numbers
			snapshotStr := istioVersionStringArr[2] // regex group #2 is the date/time stamp
			product.Version = majorMinor + snapshotStr

			// we know this is Istio upstream - either a supported or unsupported version - return now
			return &product
		}
	}

	// see if it is an RC version of Istio
	istioVersionStringArr = istioRCVersionExpr.FindStringSubmatch(rawVersion)
	if istioVersionStringArr != nil {
		log.Debugf("Detected Istio RC version [%v]", rawVersion)
		if len(istioVersionStringArr) > 2 {
			product.Name = istioProductNameUpstreamRC
			majorMinor := istioVersionStringArr[1] // regex group #1 is the "#.#.#" version numbers
			rc := istioVersionStringArr[2]         // regex group #2 is the alpha or beta version
			product.Version = fmt.Sprintf("%s (%s)", majorMinor, rc)

			// we know this is Istio upstream - either a supported or unsupported version - return now
			return &product
		}
	}

	// see if it is a dev version of Istio
	istioVersionStringArr = istioDevVersionExpr.FindStringSubmatch(rawVersion)
	if istioVersionStringArr != nil {
		log.Debugf("Detected Istio dev version [%v]", rawVersion)
		if strings.Contains(istioVersionStringArr[0], "alpha") && len(istioVersionStringArr) > 2 {
			product.Name = istioProductNameUpstreamDev
			majorMinor := istioVersionStringArr[1] // regex group #1 is the "#.#" version numbers
			buildHash := istioVersionStringArr[2]  // regex group #2 is the build hash
			product.Version = fmt.Sprintf("%s (dev %s)", majorMinor, buildHash)

			// we know this is Istio upstream - either a supported or unsupported version - return now
			return &product
		} else if strings.Contains(istioVersionStringArr[0], "dev") && len(istioVersionStringArr) > 4 {
			product.Name = istioProductNameUpstreamDev
			majorMinor := istioVersionStringArr[3] // regex group #3 is the "#.#" version numbers
			buildHash := istioVersionStringArr[4]  // regex group #4 is the build hash
			product.Version = fmt.Sprintf("%s (dev %s)", majorMinor, buildHash)

			// we know this is Istio upstream - either a supported or unsupported version - return now
			return &product
		}
	}

	// see if it is a released version of Istio
	istioVersionStringArr = istioVersionExpr.FindStringSubmatch(rawVersion)
	if istioVersionStringArr != nil {
		log.Debugf("Detected Istio version [%v]", rawVersion)
		if len(istioVersionStringArr) > 1 {
			product.Name = istioProductNameUpstream
			product.Version = istioVersionStringArr[1] // get regex group #1 ,which is the "#.#.#" version string

			// we know this is Istio upstream - either a supported or unsupported version - return now
			return &product
		}
	}

	log.Debugf("Detected unknown Istio implementation version [%v]", rawVersion)
	product.Name = istioProductNameUnknown
	product.Version = rawVersion
	return &product
}

// GetVersion returns the latest version of the Istio control plane.
// If there are multiple healthy istiod pods, the latest one by
// creation timestamp is returned.
func GetVersion(ctx context.Context, conf *config.Config, client kubernetes.ClientInterface, kubeCache ctrlclient.Reader, revision string, namespace string) (*models.ExternalServiceInfo, error) {
	istioConfig := conf.ExternalServices.Istio
	// If kiali is running on the same cluster as the istio control plane, use the URL instead
	// of port forwarding. For remote clusters we need to port forward to get the version since the
	// http monitoring port (15014) is not exposed publicly.
	if client.ClusterInfo().Name == conf.KubernetesConfig.ClusterName {
		url := ""
		// If the config has a URL for the service version, use that until the config option is removed.
		if istioConfig.UrlServiceVersion != "" {
			url = istioConfig.UrlServiceVersion
		} else {
			// Look for an istio service with the rev label in the control plane namespace.
			revLabelSelector := map[string]string{
				config.IstioAppLabel:      istiodAppLabelValue,
				config.IstioRevisionLabel: revision,
			}

			serviceList := &corev1.ServiceList{}
			err := kubeCache.List(ctx, serviceList, ctrlclient.InNamespace(namespace), ctrlclient.MatchingLabels(revLabelSelector))
			if err != nil {
				return nil, err
			}
			services := serviceList.Items
			if len(services) == 0 {
				return nil, fmt.Errorf("no istio service found for revision [%s]", revision)
			}

			url = fmt.Sprintf("http://%s.%s:%d/version", services[0].Name, services[0].Namespace, 15014)
		}

		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return nil, err
		}

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, err := io.ReadAll(resp.Body)
			// Try and read the body here in case the error message is useful.
			if err != nil {
				return nil, fmt.Errorf("getting istio version returned error code: [%d]", resp.StatusCode)
			}
			return nil, fmt.Errorf("getting istio version returned error code: [%d]. body: %s", resp.StatusCode, body)
		}

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("invalid response from istio getting version: %s", body)
		}

		rawVersion := string(body)
		return parseRawIstioVersion(rawVersion), nil
	}

	istiods, err := GetHealthyIstiodPods(kubeCache, revision, namespace)
	if err != nil {
		return nil, err
	}

	if len(istiods) == 0 {
		return nil, fmt.Errorf("no healthy istiod pods found for revision [%s]", revision)
	}

	// Assuming that all pods are running the same version, we only need to get the version from one healthy istiod pod.
	// Sort by creation time stamp to return the "latest" pod.
	slices.SortFunc(istiods, func(a, b *corev1.Pod) int {
		return a.CreationTimestamp.Time.Compare(b.CreationTimestamp.Time)
	})
	istiod := GetLatestPod(istiods)

	resp, err := client.ForwardGetRequest(istiod.Namespace, istiod.Name, conf.ExternalServices.Istio.IstiodPodMonitoringPort, "/version")
	if err != nil {
		return nil, fmt.Errorf("failed to get mesh version: %s", err)
	}

	return parseRawIstioVersion(string(resp)), nil
}
