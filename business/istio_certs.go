package business

import (
	"crypto/x509"
	"encoding/pem"
	"errors"
	"log"
	"sync"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"gopkg.in/yaml.v2"
)

type IstioCertsService struct {
	k8s           kubernetes.ClientInterface
	businessLayer *Layer
}

type IstioConfig struct {
	Certificates []struct {
		SecretName string   `yaml:"secretName"`
		DNSNames   []string `yaml:"dnsNames"`
	} `yaml:"certificates"`
}

type CertInfo struct {
	SecretName string    `json:"secretName"`
	DNSNames   []string  `json:"dnsNames"`
	Issuer     string    `json:"issuer"`
	Subject    string    `json:"subject"`
	NotBefore  time.Time `json:"notBefore"`
	NotAfter   time.Time `json:"notAfter"`
	Error      error     `json:"error"`
}

func (ics *IstioCertsService) GetCertsInfo() ([]CertInfo, error) {
	if certs, err := ics.getChironCertificates(); err == nil {
		return certs, nil
	} else if cert, err := ics.getCertificateFromSecret("cacerts"); err == nil {
		return []CertInfo{cert}, nil
	} else {
		cert, err := ics.getCertificateFromSecret("istio-ca-secret")
		if err != nil {
			return nil, err
		}
		return []CertInfo{cert}, nil
	}
}

func (ics *IstioCertsService) getCertificateFromSecret(secretName string) (CertInfo, error) {
	cfg := config.Get()

	secret, err := ics.k8s.GetSecret(cfg.IstioNamespace, secretName)

	if err != nil {
		return CertInfo{}, err
	}
	log.Println(string(secret.Data["ca-cert.pem"]))
	block, _ := pem.Decode(secret.Data["ca-cert.pem"])
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return CertInfo{SecretName: secretName, Error: err}, nil
	}
	log.Println(cert.NotBefore)
	log.Println(cert.NotAfter)
	return CertInfo{
		Issuer:     cert.Issuer.String(),
		Subject:    cert.Subject.String(),
		NotBefore:  cert.NotBefore,
		NotAfter:   cert.NotAfter,
		SecretName: secretName,
	}, nil
}

func (ics *IstioCertsService) getChironCertificates() ([]CertInfo, error) {
	cfg := config.Get()

	istioConfigMap, _ := ics.k8s.GetConfigMap(cfg.IstioNamespace, "istio")

	istioConfig := IstioConfig{}
	err := yaml.Unmarshal([]byte(istioConfigMap.Data["mesh"]), &istioConfig)
	if err != nil {
		return nil, err
	}

	if istioConfig.Certificates == nil {
		return nil, errors.New("no certificates configured in istio configmap")
	}

	wg := sync.WaitGroup{}
	certChan := make(chan CertInfo, len(istioConfig.Certificates))

	for _, certConfig := range istioConfig.Certificates {
		wg.Add(1)
		go func(secretName string, dnsNames []string) {
			defer wg.Done()
			certSecret, err := ics.k8s.GetSecret(cfg.IstioNamespace, secretName)
			if err != nil {
				certChan <- CertInfo{SecretName: secretName, Error: err}
			} else {
				block, _ := pem.Decode(certSecret.Data["root-cert.pem"])
				cert, err := x509.ParseCertificate(block.Bytes)
				if err != nil {
					certChan <- CertInfo{SecretName: secretName, Error: err}
					return
				}
				certChan <- CertInfo{
					Issuer:     cert.Issuer.CommonName,
					Subject:    cert.Subject.CommonName,
					NotBefore:  cert.NotBefore,
					NotAfter:   cert.NotAfter,
					SecretName: secretName,
					DNSNames:   dnsNames,
				}
			}
		}(certConfig.SecretName, certConfig.DNSNames)
	}

	wg.Wait()
	close(certChan)

	certs := make([]CertInfo, len(istioConfig.Certificates))
	for cert := range certChan {
		certs = append(certs, cert)
	}

	return certs, nil
}
