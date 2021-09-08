package business

import (
	"fmt"
	"time"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

const (
	envoyAdminPort = 15000
)

type ProxyLoggingService struct {
	k8s kubernetes.ClientInterface
}

func (in *ProxyLoggingService) SetLogLevel(namespace, pod, level string) error {
	path := fmt.Sprintf("/logging?level=%s", level)

	localPort := httputil.Pool.GetFreePort()
	f, err := in.k8s.GetPodPortForwarder(namespace, pod, fmt.Sprintf("%d:%d", localPort, envoyAdminPort))
	if err != nil {
		return err
	}

	// Start the forwarding
	if err := (*f).Start(); err != nil {
		return err
	}

	// Defering the finish of the port-forwarding
	defer (*f).Stop()

	// Ready to create a request
	url := fmt.Sprintf("http://localhost:%d%s", localPort, path)
	body, code, err := httputil.HttpPost(url, nil, nil, time.Second*10)
	if code >= 400 {
		log.Errorf("Error whilst posting. Error: %s. Body: %s", err, string(body))
		return fmt.Errorf("error sending post request %s from %s/%s. Response code: %d", path, namespace, pod, code)
	}

	return err
}
