package security

import (
	"encoding/base64"
	"fmt"
)

// Identity security details about a client.
// USED FOR YAML
type Identity struct {
	Cert_File        string
	Private_Key_File string
}

// Credentials provides information when needing to authenticate to remote endpoints.
// Credentials are either a username/password or a bearer token, but not both.
// USED FOR YAML
type Credentials struct {
	Username string ",omitempty"
	Password string ",omitempty"
	Token    string ",omitempty"
}

// Skip_Certificate_Validation will disable server certificate verification - the client
// will accept any certificate presented by the server and any host name in that certificate.
// USED FOR YAML
type TLS struct {
	Skip_Certificate_Validation bool ",omitempty"
}

// ValidateCredentials makes sure that if username is provided, so is password (and vice versa)
// and also makes sure if username/password is provided that token is not (and vice versa).
// It is valid to have nothing defined (no username, password, nor token).
func (c *Credentials) ValidateCredentials() error {
	if c.Username != "" && c.Password == "" {
		return fmt.Errorf("A password must be provided if a username is set.")
	}

	if c.Username == "" && c.Password != "" {
		return fmt.Errorf("A username must be provided if a password is set.")
	}

	if c.Username != "" && c.Token != "" {
		return fmt.Errorf("Username/password cannot be specified if a token is specified also. Only Username/Password or Token can be set but not both.")
	}

	return nil
}

func (c *Credentials) GetHttpAuthHeader() (headerName string, headerValue string, err error) {
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
		creds := base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", c.Username, c.Password)))
		headerName = "Authorization"
		headerValue = fmt.Sprintf("Basic %s", creds)
	} else {
		headerName = ""
		headerValue = ""
	}

	return headerName, headerValue, nil
}
