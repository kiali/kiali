package models_test

import (
	"testing"

	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

func TestNamespaceRevision(t *testing.T) {
	config.Set(config.NewConfig())
	cases := map[string]struct {
		expectedRevision string
		labels           map[string]string
	}{
		"namespace has istio-injection enabled": {
			expectedRevision: "default",
			labels:           map[string]string{"istio-injection": "enabled"},
		},
		"namespace has istio-injection disabled": {
			expectedRevision: "",
			labels:           map[string]string{"istio-injection": "disabled"},
		},
		"namespace has both istio-injection enabled and istio.io/rev labels": {
			expectedRevision: "default",
			labels: map[string]string{
				"istio-injection": "enabled",
				"istio.io/rev":    "1-23-0",
			},
		},
		"namespace has both istio-injection disabled and istio.io/rev labels": {
			expectedRevision: "default",
			labels: map[string]string{
				"istio-injection": "enabled",
				"istio.io/rev":    "1-23-0",
			},
		},
		"namespace has istio.io/rev label": {
			expectedRevision: "1-23-0",
			labels: map[string]string{
				"istio.io/rev": "1-23-0",
			},
		},
		"namespace has no labels": {
			expectedRevision: "",
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)

			kubeNamespace := corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Labels: tc.labels,
				},
			}
			namespace := models.CastNamespace(kubeNamespace, "")

			require.Equal(tc.expectedRevision, namespace.Revision)
		})
	}
}
