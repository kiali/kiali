package handlers

import (
	"fmt"
	"net/http"

	"github.com/kiali/kiali/config"
	"k8s.io/client-go/rest"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	kube "k8s.io/client-go/kubernetes"
)

// PublicConfig is a subset of Kiali configuration that can be exposed to clients to
// help them interact with the system.
type PublicConfig struct {
	AuthStrategy            string             `json:"authStrategy,omitempty"`
	OauthUserHasPermissions bool               `json:"oauthUserHasPermissions"`
	IstioNamespace          string             `json:"istioNamespace,omitempty"`
	IstioLabels             config.IstioLabels `json:"istioLabels,omitempty"`
}

// GraphNamespace is a REST http.HandlerFunc handling namespace-wide graph
// config generation.
func Config(w http.ResponseWriter, r *http.Request) {
	defer handlePanic(w)

	config := config.Get()

	publicConfig := PublicConfig{
		AuthStrategy:            config.AuthStrategy,
		IstioNamespace:          config.IstioNamespace,
		IstioLabels:             config.IstioLabels,
		OauthUserHasPermissions: checkOauthPermissions(r.Header.Get("X-Forwarded-Access-Token")),
	}

	RespondWithJSONIndent(w, http.StatusOK, publicConfig)
}

// Check if an user has permissions to use Kiali.
// It is the naivest implementation possible, to check if the user can at least
// list the services on istio-system.
func checkOauthPermissions(token string) bool {
	if token == "" {
		return false
	}

	config, err := rest.InClusterConfig()

	if err != nil {
		fmt.Println("Failed on in cluster config")
		return false
	}

	config.BearerToken = token

	client, err := kube.NewForConfig(config)

	if err != nil {
		fmt.Println("Failed on in creating kube client")
		return false
	}

	services, err := client.CoreV1().Services("istio-system").Get("kiali", metav1.GetOptions{})

	fmt.Printf("%+v\n", services)

	if err != nil {
		fmt.Println("failed on getting kiali service")
		fmt.Printf("%+v\n", err)
		return false
	}

	return true
}
