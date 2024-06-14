package business

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

type fakeMeshDiscovery struct {
	mesh models.Mesh
}

func (fmd *fakeMeshDiscovery) Mesh(ctx context.Context) (*models.Mesh, error) {
	return &fmd.mesh, nil
}

func TestCertificatesInformationIndicatorsDisabled(t *testing.T) {
	k8s := kubetest.NewFakeK8sClient()
	discovery := &fakeMeshDiscovery{}

	conf := config.NewConfig()
	conf.KialiFeatureFlags.CertificatesInformationIndicators.Enabled = false

	ics := NewIstioCertsService(conf, discovery, k8s)
	certs, _ := ics.GetCertsInfo(context.TODO())

	assert.Len(t, certs, 0)
}

func TestIstioCASecret(t *testing.T) {
	conf := config.NewConfig()

	discovery := &fakeMeshDiscovery{}
	secret := &core_v1.Secret{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio-ca-secret",
			Namespace: "istio-system",
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
	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		secret,
	)

	ics := NewIstioCertsService(conf, discovery, k8s)

	certs, _ := ics.GetCertsInfo(context.TODO())

	assert.Len(t, certs, 1)
	assert.Equal(t, "O=cluster.local", certs[0].Issuer)
	assert.Equal(t, "2021-07-27 14:37:00 +0000 UTC", certs[0].NotBefore.String())
	assert.Equal(t, "2031-07-25 14:37:00 +0000 UTC", certs[0].NotAfter.String())
	assert.Equal(t, "istio-ca-secret", certs[0].SecretName)
	assert.Equal(t, "istio-system", certs[0].SecretNamespace)
	assert.True(t, certs[0].Accessible)
	assert.Nil(t, certs[0].DNSNames)
	assert.Empty(t, certs[0].Error)
}

type forbiddenSecretClient struct {
	kubernetes.ClientInterface
}

func (fsc *forbiddenSecretClient) GetSecret(namespace, name string) (*core_v1.Secret, error) {
	if name == "cacerts" {
		return nil, kubernetes.NewNotFound(name, "Secret", "secrets")
	}

	return nil, errors.NewForbidden(schema.GroupResource{Group: "", Resource: "Secret"}, "istio-ca-secret", nil)
}

func TestIstioCASecretForbiddenError(t *testing.T) {
	conf := config.NewConfig()

	secret := &core_v1.Secret{
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
	k8s := &forbiddenSecretClient{kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		secret,
	)}

	ics := NewIstioCertsService(conf, &fakeMeshDiscovery{}, k8s)

	certs, _ := ics.GetCertsInfo(context.TODO())

	assert.Len(t, certs, 1)
	assert.False(t, certs[0].Accessible)
	assert.Empty(t, certs[0].Error)
}

func TestIstioCACertsSecret(t *testing.T) {
	conf := config.NewConfig()

	secret := &core_v1.Secret{
		ObjectMeta: v1.ObjectMeta{
			Name:      "cacerts",
			Namespace: "istio-system",
		},
		Data: map[string][]byte{
			"ca-cert.pem": []byte(`-----BEGIN CERTIFICATE-----
MIIFVjCCAz6gAwIBAgIUST1YLJxmdQO8Z7GP9YVvqJWNJ0wwDQYJKoZIhvcNAQEL
BQAwIjEOMAwGA1UECgwFSXN0aW8xEDAOBgNVBAMMB1Jvb3QgQ0EwHhcNMjEwNzI3
MTgzMDA2WhcNMjMwNzI3MTgzMDA2WjA9MQ4wDAYDVQQKDAVJc3RpbzEYMBYGA1UE
AwwPSW50ZXJtZWRpYXRlIENBMREwDwYDVQQHDAhjbHVzdGVyMTCCAiIwDQYJKoZI
hvcNAQEBBQADggIPADCCAgoCggIBALmtR634rmGrpHC0YLtzzWyN0JbqGFB4x9Um
iPZASj1jGF+FWX/99EUJpDtW/RdQluXiz6pjPqOUEOdv4tKcR+SjnItNFuyzdmGB
ZjQc1Hniipv2ZmekmhrUKvCV+0MlbS9DVb9FiGFr7a/cQmIiId9T7UcJ3an+sI9d
S6yPppsnlGASjD6X7QE3D9gTGYxjYPkq5ttR+TYIER2enHqfxPHly7zyhYDCHPNk
ZUZeGKP7tOHVLmFApPb1Z8Sp5kQCxwQWn5pMiCSQ+aLO8W+sd24EDVLAayKsEors
C/ADAvTblzRBMr0g99S5u8B/m3nPbt2gE6sLLk447BZlmh94Kfs8t2+RTJVLYtsN
jwlNhB9renWzwyBtF/4NXiC6YKtJaMu5Ris1t+wlntMVfFYcRC9nJhqI0n4kAgIv
VsVSRkDK4xlaGrmXFvHs+9gAds6PKEpXspqRSlsfOB3b3o71PJ7Y1SbTCWxU00h7
1BJ2mK2gK2ZXW4cTNjQGib1m8+kafVLjM3H0zHTRw98yGaPcaPc4IHhQaf7mL9kx
tgrHhhkqEY+gTaG3oI1d1AvjYy+lwbD6DZAvpXJyEuNIlr4cN7Yp+9K6oChMxXSN
jjmDOA23NuLGXzrpOzBHHT4FfV0syUICOVZ1vcGZ6h1xhsQL94v3nJmidSvoteKe
pFl682vZAgMBAAGjaTBnMB0GA1UdDgQWBBQ91iMOpMCM0lJx1/VRqoJZ5tq6BDAS
BgNVHRMBAf8ECDAGAQH/AgEAMA4GA1UdDwEB/wQEAwIC5DAiBgNVHREEGzAZghdp
c3Rpb2QuaXN0aW8tc3lzdGVtLnN2YzANBgkqhkiG9w0BAQsFAAOCAgEAdIY+v5Al
2+58epPv5gRQ4osExW4FUl95SibEEOe5WqurPfU86OjI9aySrtMcvCmrTvzf8omm
GHykYlmOZf2GHc8i03sWVcnPuwa4EthERZtoF4GwXiM/JYChy+ams6oPi0K+/OoG
XOr/tfcJlkjV7v01Fmqi7jOMaj6csBnWvFX2pmK8BFCLdU7CgskPyFZFuh39xsD0
w4Zoc3bEjAsGt44qhmmt+0vykLv0rGac2hUzcG0R6cRn/SXMcyEaA4xmK6ooZnAJ
yL6rJrFvHFCVNFZjFPyC81hoLw8lg8ED2S2PctCpqftbay9oBPik/3+6QMF+Stvp
aAKS0IlRrPkRHyZiwwYZd+i7AhJdgXVkqzkywQVOueobGk7SNoEOq2P8v71+1Moi
r9TGnoh7JNPAX4IbdKv1itpKdtKhiy9ICF7dg3r2qXsibui/uI0sVSS8ygCriF/r
8KdqfFtQ3kOz7QBC8AqAS1upE61YmCLRZj7ynsfHD0HSAgrcpLUJKP6HLpyV1q6E
JzQkHXAoigPWPkaw5wY0uvs3F+fRq/wlr1XkfcfoJgHYiXD2fbhdCt/186GTw5mI
7G7CVrTrw+iPuyFnxXrFdxD7RAkkpHJ3KA/KNyZTtsaD12Ce5x/odtmtEqVB5BMU
cdLzuNyDoeWOHU7mx52TuTwj3eObtQM+hlI=
-----END CERTIFICATE-----`),
		},
	}

	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		secret,
	)

	ics := NewIstioCertsService(conf, &fakeMeshDiscovery{}, k8s)

	certs, _ := ics.GetCertsInfo(context.TODO())

	assert.Len(t, certs, 1)
	assert.Equal(t, "CN=Root CA,O=Istio", certs[0].Issuer)
	assert.Equal(t, "2021-07-27 18:30:06 +0000 UTC", certs[0].NotBefore.String())
	assert.Equal(t, "2023-07-27 18:30:06 +0000 UTC", certs[0].NotAfter.String())
	assert.Equal(t, "cacerts", certs[0].SecretName)
	assert.Equal(t, "istio-system", certs[0].SecretNamespace)
	assert.True(t, certs[0].Accessible)
	assert.Nil(t, certs[0].DNSNames)
	assert.Empty(t, certs[0].Error)
}

func TestChironSecrets(t *testing.T) {
	conf := config.NewConfig()

	discovery := &fakeMeshDiscovery{
		mesh: models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				Cluster: &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName, IsKialiHome: true},
				Config: models.ControlPlaneConfiguration{
					IstioMeshConfig: models.IstioMeshConfig{
						Certificates: []models.Certificate{
							{
								SecretName: "dns.example1-service-account",
								DNSNames:   []string{"example1.istio-system.svc", "example1.istio-system"},
							},
							{
								SecretName: "dns.example2-service-account",
								DNSNames:   []string{"example2.istio-system.svc", "example2.istio-system"},
							},
						},
					},
				},
			}},
		},
	}

	example1secret := core_v1.Secret{
		ObjectMeta: v1.ObjectMeta{
			Name:      "dns.example1-service-account",
			Namespace: "istio-system",
		},
		Data: map[string][]byte{
			"cert-chain.pem": []byte(`-----BEGIN CERTIFICATE-----
MIIDSjCCAjKgAwIBAgIRANM202oDuJ3+5rtcjkSsY34wDQYJKoZIhvcNAQELBQAw
FTETMBEGA1UEAxMKbWluaWt1YmVDQTAeFw0yMTA3MjcxODM3NTJaFw0yMjA3Mjcx
ODM3NTJaMAsxCTAHBgNVBAoTADCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC
ggEBALw6IMv9OHp8LkEHnBRVEqDhDoA+gDNEuFNt+gsA3nLH+64mqQG5ronIPxIN
5hXefMd68bayo/Q2Wvy5oNx9DnwqvN4CSZF2xuWfvnAAcbEOaEm7YiQ3X5zLoq/9
qpDKXOQ8LS1p70AYQ47bs4Plg0Dyhytpd4VmK175n4HC6KCPaPlfFTpYm5E9LVUb
nWjwAXLI/Df7iWgmgs9Tub6N2dNg1CR/JF8JkI8G8k8IxLkupdwe8fKiN0SGchUJ
PqMC1/ZxgZPDxHPqpJWhmmFJ7eDVRBhxTxXrzo7vlqRcFUA9XZm1QfPPLe61JkiM
KLzeLoPEINElnSBtQDxwX+pM29ECAwEAAaOBnjCBmzAOBgNVHQ8BAf8EBAMCBaAw
HQYDVR0lBBYwFAYIKwYBBQUHAwEGCCsGAQUFBwMCMAwGA1UdEwEB/wQCMAAwHwYD
VR0jBBgwFoAUQZxWbCpiU9oasp60hvk1RFOB1Z8wOwYDVR0RBDQwMoIZZXhhbXBs
ZTEuaXN0aW8tc3lzdGVtLnN2Y4IVZXhhbXBsZTEuaXN0aW8tc3lzdGVtMA0GCSqG
SIb3DQEBCwUAA4IBAQCNdYEZOT6zhupbKYly5uG5BJpTYCvzTJjK6Ulvgm5wp798
TDGY3IIa8oNLQa+IkPR1sGnax+w7wNY39/f1orkLF/WbXFDsJJMeZguUQo3cIz7W
4k20/UxYAo2vHMn3gKQ2wC+Og01N1fI12Gh0/TRbg3xDY0Orrz/eryMqIje3u3i4
4ytJvZ8wRQl2+UrqI1ifvJTcxu3974lshdaThhhbt3sPPxvVRMJAvdyBRivgaNIn
JwZAJq8YIy5IhlYYyoeVHPJpH3Fch9pRy3TLK4vdO00+ZeiTGj4feuaf353I4xMp
0E9lzpH/nLW4M/TySDAYyJcikxxVcl24RpZw/hpk
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIDBjCCAe6gAwIBAgIBATANBgkqhkiG9w0BAQsFADAVMRMwEQYDVQQDEwptaW5p
a3ViZUNBMB4XDTIxMDcyMjE1MDU0NVoXDTMxMDcyMTE1MDU0NVowFTETMBEGA1UE
AxMKbWluaWt1YmVDQTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKkf
KllQ+/DouP7pflOfnrlpHwsfQvPXHYnmSrxY0rpCxjgdG6cU0DVR0rMKNl1v/ddk
toC56EaPzrVrFrT08jVSyoeIoSbd2KYxv1ZQG65lKeSOy/Kqun0DL6N7rstF2mAo
kHa1tXKE+uDC8AUMRyd85UpNF2cVd8UiaY6DqAChN1gpx0EIzcMI7SfHW6mRlLXl
G5PpKmoB4fW0e2qH51hUILNBP3FPReJ/Q2BJSJWxc7YmueXkpL+s/SCXBf5OLpSi
btGtwpk24Ar4tEPPE/sEg0CvoGvFbbVmnur17NnWapd7HJ+wnSzXACEKkyu6n55T
K3XG+XrsaAYzKdYkq2UCAwEAAaNhMF8wDgYDVR0PAQH/BAQDAgKkMB0GA1UdJQQW
MBQGCCsGAQUFBwMCBggrBgEFBQcDATAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQW
BBRBnFZsKmJT2hqynrSG+TVEU4HVnzANBgkqhkiG9w0BAQsFAAOCAQEASh4nZgCA
akFDfS/zEHJppg2M0U24lG5Uz6PGi2XFTiEKZZze5je2tOv5Zccedtearob+Emfi
AbKD+qNGD+jJnONxwApx0zFIQPt1AhcNUduOb/GTX++9V4cpp2N3kfu0yupgVDQA
m1NSsJuoyxHTiRjI9xPkwmbIYfFjXU0mQOZrt7CTrsX4whW2CzS9Sax4CipQEZ2X
T4t/ASuhWl1i8tqWIYLVkpd93GVflfZE5L1U0kcfP3fq3vJP7rMBofUA/th01EHw
Ws8kBubm6NXTG1sk8nqpmLPQvWaSPK/Wa6/mmF4Tjhix0vRiJrVf0bBSRVNpBWla
iMXzPzS/OeYyKQ==
-----END CERTIFICATE-----`),
		},
	}

	example2secret := core_v1.Secret{
		ObjectMeta: v1.ObjectMeta{
			Name:      "dns.example2-service-account",
			Namespace: "istio-system",
		},
		Data: map[string][]byte{
			"cert-chain.pem": []byte(`-----BEGIN CERTIFICATE-----
MIIDSTCCAjGgAwIBAgIQSu7ThM4A45g4N3tErLt3LzANBgkqhkiG9w0BAQsFADAV
MRMwEQYDVQQDEwptaW5pa3ViZUNBMB4XDTIxMDcyNzE4Mzc1MloXDTIyMDcyNzE4
Mzc1MlowCzEJMAcGA1UEChMAMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKC
AQEAs1a2vjw1kOAUm/xFeHbk4LJCHv8WIZP/hmx8sWj4ehNeq2GDSlIptZdiIUUE
V66SO0nLC6qYpQfqMiVXtgd699gHB0RIDyFoco9rhCKdklKN4HAUBkwgW1/QqhxE
Ovb3ZEdLMKs59zECwFXeWHCeua7K5OdswJ8zCz9b9eF+4nDFIf5kvKcp4CV1KLmV
N44+lSLlXE6+zks7Mhly84gfeGAPCesBdJrYPedQNvzoz37rhmqa/aQidn7ZX0Ll
gSODyA7vmLWzdd2q5EWjv2PMw3yvGfVUZdFaRwKDUwVS3TA2HOka4xNOudwpqO7m
0aTQ5aVvGClcnAhsx1hA4sM6NwIDAQABo4GeMIGbMA4GA1UdDwEB/wQEAwIFoDAd
BgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwDAYDVR0TAQH/BAIwADAfBgNV
HSMEGDAWgBRBnFZsKmJT2hqynrSG+TVEU4HVnzA7BgNVHREENDAyghlleGFtcGxl
Mi5pc3Rpby1zeXN0ZW0uc3ZjghVleGFtcGxlMi5pc3Rpby1zeXN0ZW0wDQYJKoZI
hvcNAQELBQADggEBABmwgVxKVIQa2QAVVDjSfQ5DM952tBmr/0zDb/7QE+TG91M/
ny6GFgUsdcaGJ9wNgJ+JYa7HnOCBMFQwWSYgSaLQFuY1tYbgkmtccrrXuXewpFs4
N2WO4+atDNaDoNtieIokB7B9x0zykdPO/fR5JSeo8IjlTze9WMHb2K5CPAfQVX/m
T3U1XD9zh9mbwPDbHKMe+/XYDsGZOKJx7EsqAcCFovsBmXjGMnZWdVBVlK2dJlTO
bJnuwO+bfKwU4REvpLBtrgNnvrumF79AXUWQ+16yBN9Sz7QEWxLO4ihgOwJDeb84
bSJIakXRK6eMEvSMEmdKLCOaTdUDQWToOxAhrs8=
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIDBjCCAe6gAwIBAgIBATANBgkqhkiG9w0BAQsFADAVMRMwEQYDVQQDEwptaW5p
a3ViZUNBMB4XDTIxMDcyMjE1MDU0NVoXDTMxMDcyMTE1MDU0NVowFTETMBEGA1UE
AxMKbWluaWt1YmVDQTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKkf
KllQ+/DouP7pflOfnrlpHwsfQvPXHYnmSrxY0rpCxjgdG6cU0DVR0rMKNl1v/ddk
toC56EaPzrVrFrT08jVSyoeIoSbd2KYxv1ZQG65lKeSOy/Kqun0DL6N7rstF2mAo
kHa1tXKE+uDC8AUMRyd85UpNF2cVd8UiaY6DqAChN1gpx0EIzcMI7SfHW6mRlLXl
G5PpKmoB4fW0e2qH51hUILNBP3FPReJ/Q2BJSJWxc7YmueXkpL+s/SCXBf5OLpSi
btGtwpk24Ar4tEPPE/sEg0CvoGvFbbVmnur17NnWapd7HJ+wnSzXACEKkyu6n55T
K3XG+XrsaAYzKdYkq2UCAwEAAaNhMF8wDgYDVR0PAQH/BAQDAgKkMB0GA1UdJQQW
MBQGCCsGAQUFBwMCBggrBgEFBQcDATAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQW
BBRBnFZsKmJT2hqynrSG+TVEU4HVnzANBgkqhkiG9w0BAQsFAAOCAQEASh4nZgCA
akFDfS/zEHJppg2M0U24lG5Uz6PGi2XFTiEKZZze5je2tOv5Zccedtearob+Emfi
AbKD+qNGD+jJnONxwApx0zFIQPt1AhcNUduOb/GTX++9V4cpp2N3kfu0yupgVDQA
m1NSsJuoyxHTiRjI9xPkwmbIYfFjXU0mQOZrt7CTrsX4whW2CzS9Sax4CipQEZ2X
T4t/ASuhWl1i8tqWIYLVkpd93GVflfZE5L1U0kcfP3fq3vJP7rMBofUA/th01EHw
Ws8kBubm6NXTG1sk8nqpmLPQvWaSPK/Wa6/mmF4Tjhix0vRiJrVf0bBSRVNpBWla
iMXzPzS/OeYyKQ==
-----END CERTIFICATE-----`),
		},
	}

	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		&example1secret,
		&example2secret,
	)

	ics := NewIstioCertsService(conf, discovery, k8s)

	certs, _ := ics.GetCertsInfo(context.TODO())

	assert.Len(t, certs, 2)
	assert.Equal(t, certs[0].SecretName, "dns.example1-service-account")
	assert.Equal(t, certs[1].SecretName, "dns.example2-service-account")
}

func TestChironSecretsError(t *testing.T) {
	conf := config.NewConfig()

	discovery := &fakeMeshDiscovery{
		mesh: models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				Cluster: &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName, IsKialiHome: true},
				Config: models.ControlPlaneConfiguration{
					IstioMeshConfig: models.IstioMeshConfig{
						Certificates: []models.Certificate{
							{
								SecretName: "dns.example1-service-account",
								DNSNames:   []string{"example1.istio-system.svc", "example1.istio-system"},
							},
							{
								SecretName: "dns.example2-service-account",
								DNSNames:   []string{"example2.istio-system.svc", "example2.istio-system"},
							},
						},
					},
				},
			}},
		},
	}

	example1secret := core_v1.Secret{
		ObjectMeta: v1.ObjectMeta{
			Name:      "dns.example1-service-account",
			Namespace: "istio-system",
		},
		Data: map[string][]byte{
			"cert-chain.pem": []byte(`-----BEGIN CERTIFICATE-----
MIIDSjCCAjKgAwIBAgIRANM202oDuJ3+5rtcjkSsY34wDQYJKoZIhvcNAQELBQAw
FTETMBEGA1UEAxMKbWluaWt1YmVDQTAeFw0yMTA3MjcxODM3NTJaFw0yMjA3Mjcx
ODM3NTJaMAsxCTAHBgNVBAoTADCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC
ggEBALw6IMv9OHp8LkEHnBRVEqDhDoA+gDNEuFNt+gsA3nLH+64mqQG5ronIPxIN
5hXefMd68bayo/Q2Wvy5oNx9DnwqvN4CSZF2xuWfvnAAcbEOaEm7YiQ3X5zLoq/9
qpDKXOQ8LS1p70AYQ47bs4Plg0Dyhytpd4VmK175n4HC6KCPaPlfFTpYm5E9LVUb
nWjwAXLI/Df7iWgmgs9Tub6N2dNg1CR/JF8JkI8G8k8IxLkupdwe8fKiN0SGchUJ
PqMC1/ZxgZPDxHPqpJWhmmFJ7eDVRBhxTxXrzo7vlqRcFUA9XZm1QfPPLe61JkiM
KLzeLoPEINElnSBtQDxwX+pM29ECAwEAAaOBnjCBmzAOBgNVHQ8BAf8EBAMCBaAw
HQYDVR0lBBYwFAYIKwYBBQUHAwEGCCsGAQUFBwMCMAwGA1UdEwEB/wQCMAAwHwYD
VR0jBBgwFoAUQZxWbCpiU9oasp60hvk1RFOB1Z8wOwYDVR0RBDQwMoIZZXhhbXBs
ZTEuaXN0aW8tc3lzdGVtLnN2Y4IVZXhhbXBsZTEuaXN0aW8tc3lzdGVtMA0GCSqG
SIb3DQEBCwUAA4IBAQCNdYEZOT6zhupbKYly5uG5BJpTYCvzTJjK6Ulvgm5wp798
TDGY3IIa8oNLQa+IkPR1sGnax+w7wNY39/f1orkLF/WbXFDsJJMeZguUQo3cIz7W
4k20/UxYAo2vHMn3gKQ2wC+Og01N1fI12Gh0/TRbg3xDY0Orrz/eryMqIje3u3i4
4ytJvZ8wRQl2+UrqI1ifvJTcxu3974lshdaThhhbt3sPPxvVRMJAvdyBRivgaNIn
JwZAJq8YIy5IhlYYyoeVHPJpH3Fch9pRy3TLK4vdO00+ZeiTGj4feuaf353I4xMp
0E9lzpH/nLW4M/TySDAYyJcikxxVcl24RpZw/hpk
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIDBjCCAe6gAwIBAgIBATANBgkqhkiG9w0BAQsFADAVMRMwEQYDVQQDEwptaW5p
a3ViZUNBMB4XDTIxMDcyMjE1MDU0NVoXDTMxMDcyMTE1MDU0NVowFTETMBEGA1UE
AxMKbWluaWt1YmVDQTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKkf
KllQ+/DouP7pflOfnrlpHwsfQvPXHYnmSrxY0rpCxjgdG6cU0DVR0rMKNl1v/ddk
toC56EaPzrVrFrT08jVSyoeIoSbd2KYxv1ZQG65lKeSOy/Kqun0DL6N7rstF2mAo
kHa1tXKE+uDC8AUMRyd85UpNF2cVd8UiaY6DqAChN1gpx0EIzcMI7SfHW6mRlLXl
G5PpKmoB4fW0e2qH51hUILNBP3FPReJ/Q2BJSJWxc7YmueXkpL+s/SCXBf5OLpSi
btGtwpk24Ar4tEPPE/sEg0CvoGvFbbVmnur17NnWapd7HJ+wnSzXACEKkyu6n55T
K3XG+XrsaAYzKdYkq2UCAwEAAaNhMF8wDgYDVR0PAQH/BAQDAgKkMB0GA1UdJQQW
MBQGCCsGAQUFBwMCBggrBgEFBQcDATAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQW
BBRBnFZsKmJT2hqynrSG+TVEU4HVnzANBgkqhkiG9w0BAQsFAAOCAQEASh4nZgCA
akFDfS/zEHJppg2M0U24lG5Uz6PGi2XFTiEKZZze5je2tOv5Zccedtearob+Emfi
AbKD+qNGD+jJnONxwApx0zFIQPt1AhcNUduOb/GTX++9V4cpp2N3kfu0yupgVDQA
m1NSsJuoyxHTiRjI9xPkwmbIYfFjXU0mQOZrt7CTrsX4whW2CzS9Sax4CipQEZ2X
T4t/ASuhWl1i8tqWIYLVkpd93GVflfZE5L1U0kcfP3fq3vJP7rMBofUA/th01EHw
Ws8kBubm6NXTG1sk8nqpmLPQvWaSPK/Wa6/mmF4Tjhix0vRiJrVf0bBSRVNpBWla
iMXzPzS/OeYyKQ==
-----END CERTIFICATE-----`),
		},
	}

	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		&example1secret,
	)

	ics := NewIstioCertsService(conf, discovery, k8s)

	_, err := ics.GetCertsInfo(context.TODO())

	assert.Error(t, err)
}
