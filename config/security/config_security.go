package security

import (
	"encoding/base64"
	"fmt"
)

// Identity security details about a client.
type Identity struct {
	CertFile       string `yaml:"cert_file"`
	PrivateKeyFile string `yaml:"private_key_file"`
}

// Credentials provides information when needing to authenticate to remote endpoints.
// Credentials are either a username/password or a bearer token, but not both.
type Credentials struct {
	Username   string `yaml:",omitempty"`
	Passphrase string `yaml:",omitempty"`
	Token      string `yaml:",omitempty"`
}

// TLS options - SkipCertificateValidation will disable server certificate verification - the client
// will accept any certificate presented by the server and any host name in that certificate.
type TLS struct {
	SkipCertificateValidation bool `yaml:"skip_certificate_validation,omitempty"`
}

// ValidateCredentials makes sure that if username is provided, so is passphrase (and vice versa)
// and also makes sure if username/passphrase is provided that token is not (and vice versa).
// It is valid to have nothing defined (no username, passphrase, nor token), but if nothing is
// defined, this usually means the person who
// installed Kiali most likely forgot to set credentials - therefore access should always be denied.
func (c *Credentials) ValidateCredentials() error {
	if c.Username != "" && c.Passphrase == "" {
		return fmt.Errorf("a passphrase must be provided if a username is set")
	}

	if c.Username == "" && c.Passphrase != "" {
		return fmt.Errorf("a username must be provided if a password is set")
	}

	if c.Username != "" && c.Token != "" {
		return fmt.Errorf("username/passphrase cannot be specified if a token is specified also. Only Username/Passphrase or Token can be set but not both")
	}

	return nil
}

// GetHTTPAuthHeader provides the authentication ehader name and value (can be empty), or an error
func (c *Credentials) GetHTTPAuthHeader() (headerName string, headerValue string, err error) {
	// if no credentials are provided, this is fine, we are just going to do an insecure request
	if c == nil {
		return "", "", nil
	}

	if err := c.ValidateCredentials(); err != nil {
		return "", "", err
	}

	if c.Token != "" {
		headerName = "Authorization"
		headerValue = fmt.Sprintf("Bearer %s", c.Token)
	} else if c.Username != "" {
		creds := base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", c.Username, c.Passphrase)))
		headerName = "Authorization"
		headerValue = fmt.Sprintf("Basic %s", creds)
	} else {
		headerName = ""
		headerValue = ""
	}

	return headerName, headerValue, nil
}
