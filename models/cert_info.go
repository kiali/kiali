package models

import (
	"crypto/x509"
	"encoding/pem"
	"time"
)

// CertInfo contains the information for a given certificate
type CertInfo struct {
	ConfigMapName      string    `json:"configMapName"`
	ConfigMapNamespace string    `json:"configMapNamespace"`
	DNSNames           []string  `json:"dnsNames"`
	Issuer             string    `json:"issuer"`
	NotBefore          time.Time `json:"notBefore"`
	NotAfter           time.Time `json:"notAfter"`
	Error              string    `json:"error"`
	Accessible         bool      `json:"accessible"`
	ClusterName        string    `json:"cluster"`
}

func (ci *CertInfo) Parse(certificate []byte) {
	block, _ := pem.Decode(certificate)

	if block == nil {
		ci.Error = "unable to decode certificate"
		return
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		ci.Error = "unable to parse certificate"
		return
	}

	ci.Issuer = cert.Issuer.String()
	ci.NotBefore = cert.NotBefore
	ci.NotAfter = cert.NotAfter
	ci.Accessible = true
}
