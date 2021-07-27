package business

import (
	"errors"
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/stretchr/testify/assert"
	core_v1 "k8s.io/api/core/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestIstioCASecret(t *testing.T) {
	config.Set(config.NewConfig())
	k8s := new(kubetest.K8SClientMock)
	conf := config.NewConfig()
	secret := core_v1.Secret{
		ObjectMeta: v1.ObjectMeta{
			Name: "istio-ca-secret",
		},
		Data: map[string][]byte{
			"ca-cert.pem": []byte(`-----BEGIN CERTIFICATE-----
MIIC/DCCAeSgAwIBAgIQVv6mINjF1kQJS2O98zkkNzANBgkqhkiG9w0BAQsFADAY
MRYwFAYDVQQKEw1jbHVzdGVyLmxvY2FsMB4XDTIxMDcyNzE0MzcwMFoXDTMxMDcy
NTE0MzcwMFowGDEWMBQGA1UEChMNY2x1c3Rlci5sb2NhbDCCASIwDQYJKoZIhvcN
AQEBBQADggEPADCCAQoCggEBAMwHN+LAkWbC9qyAlXQ4Zwn+Yhgc4eCPuw9LQVjW
b9al44H5sV/1QIog8wOjDHx32k2lTXvdxRgOJd+ENXMQ9DmU6C9oeWhMZAmAvp4M
NBaYnY4BRcWAPqIhEb/26zRA9pXjPVJX+aN45R1EJWsJxP6ZPkmZZKILnYY6VwqU
wbbB3lp34HQruvkpePUo4Bux+N+DfQsu1g/C6UMbQlY/kl1d1KaTS4bYQAP1d4eT
sPxw5Rf9WRSQcGaAWiPbUxVBtA0LYCbHzOacAAwvYhJgvbinr73RiqKUMR5BV/p3
lyKyVDyrVXXbVNsQhsT/lM5e55DaQEJKyldgklSGseVYHy0CAwEAAaNCMEAwDgYD
VR0PAQH/BAQDAgIEMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFK7ZOPXlxd78
xUpOGYDaqgC/sdevMA0GCSqGSIb3DQEBCwUAA4IBAQACLa2gNuIxQWf4qiCxsbIj
qddqbjHBGOWVAcyFRk/k7ydmellkI5BcMJEhlPT7TBUutcjvX8lCsup+xGy47NpH
hRp4hxUYodGXLXQ2HfI+3CgAARBEIBXjh/73UDFcMtH/G6EtGfFEw8ZgbyaDQ9Ft
c10h5QnbMUBFWdmvwSFvbJwZoTlFM+skogwv+d55sujZS83jbZHs7lZlDy0hDYIm
tMAWt4FEJnLPrfFtCFJgddiXDYGtX/Apvqac2riSAFg8mQB5WRtxKH7TK9Qhvca7
V/InYncUvcXt0M4JJSUJi/u6VBKSYYDIHt3mk9Le2qlMQuHkOQ1ZcuEOM2CU/KtO
-----END CERTIFICATE-----`),
		},
	}

	k8s.On("GetConfigMap", conf.IstioNamespace, "istio").Return(&core_v1.ConfigMap{}, nil)
	k8s.On("IsOpenShift").Return(false)
	k8s.On("GetSecret", conf.IstioNamespace, "cacerts").Return(&core_v1.Secret{}, errors.New("error"))
	k8s.On("GetSecret", conf.IstioNamespace, "istio-ca-secret").Return(&secret, nil)

	layer := NewWithBackends(k8s, nil, nil)
	ics := layer.IstioCerts

	certs, _ := ics.GetCertsInfo()

	assert.Len(t, certs, 1)
	assert.Equal(t, "O=cluster.local", certs[0].Issuer)
	assert.Equal(t, "O=cluster.local", certs[0].Subject)
	assert.Equal(t, "2021-07-27 14:37:00 +0000 UTC", certs[0].NotBefore.String())
	assert.Equal(t, "2031-07-25 14:37:00 +0000 UTC", certs[0].NotAfter.String())
	assert.Equal(t, "istio-ca-secret", certs[0].SecretName)
	assert.Nil(t, certs[0].DNSNames)
	assert.Nil(t, certs[0].Error)
}
