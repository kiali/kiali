package ldap

import (
	"fmt"
	"time"
)

// UserInfo holds authenticatoin information
type UserInfo struct {
	APIVersion string  `json:"apiVersion,omitempty"`
	Kind       string  `json:"kind,omitempty"`
	Status     *Status `json:"status,omitempty"`
}

// User holds user information from AD
type User struct {
	Username string   `json:"username,omitempty"`
	UID      string   `json:"uid,omitempty"`
	Groups   []string `json:"groups,omitempty"`
}

// JWTClaimsJSON is used for decoding an incoming JSON JWT payload to the /authenticate API
type JWTClaimsJSON struct {
	Iat      int      `json:"iat"`
	UID      string   `json:"uid"`
	Username string   `json:"username"`
	Expiry   int      `json:"exp"`
	Groups   []string `json:"groups"`
}

// Valid so that JWTClaimsJSON satisfies the jwt.Claims interface
func (c *JWTClaimsJSON) Valid() error {
	if c.UID == "" {
		return fmt.Errorf("UID must be present in token claims")
	}
	if c.Expiry == 0 {
		return fmt.Errorf("Token has no expiry")
	}
	if c.Expiry < int(time.Now().Unix()) {
		return fmt.Errorf("Token has expired")
	}
	if c.Iat > int(time.Now().Unix()+int64(time.Second)) {
		return fmt.Errorf("Token is from the future")
	}
	return nil
}

// Status indicates if user is authenticated or not
type Status struct {
	Authenticated *bool `json:"authenticated,omitempty"`
	User          *User `json:"user,omitempty"`
}

// UserCredentials holds user creds
type UserCredentials struct {
	UserName string `json:"userName,omitempty"`
	Password string `json:"password,omitempty"`
}

// Token return JWT with its expiry time
type Token struct {
	JWT    string    `json:"token,omitempty"`
	Expiry time.Time `json:"expiry,omitempty"`
}

// Request maps the incoming auth request from api-server
type Request struct {
	APIVersion string `json:"apiVersion,omitempty"`
	Kind       string `json:"kind,omitempty"`
	Spec       *Spec  `json:"spec,omitempty"`
}

// Spec maps to the bearer token send by api-server
type Spec struct {
	Token string `json:"token,omitempty"`
}
