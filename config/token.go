package config

import (
	"errors"
	"fmt"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/kiali/kiali/util"
)

// Structured version of Claims Section, as referenced at
// https://tools.ietf.org/html/rfc7519#section-4.1
// See examples for how to use this with your own claim types
type IanaClaims struct {
	SessionId string `json:"sid,omitempty"`
	jwt.StandardClaims
}

type TokenGenerated struct {
	Username  string    `json:"username"`
	Token     string    `json:"token"`
	ExpiresOn time.Time `json:"expiresOn"`
}

func GetSignedTokenString(claims jwt.Claims) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	ss, err := token.SignedString([]byte(GetSigningKey()))

	if err != nil {
		return "", err
	}

	return ss, nil
}

func GetSigningKey() string {
	cfg := Get()
	signKey := cfg.LoginToken.SigningKey

	if len(signKey) == 0 || signKey == "kiali" {
		// "kiali" is a well-known signing key reported in a CVE. We ban it's usage.
		// An empty key is also just not allowed.
		panic("signing key for login tokens is invalid")
	}

	if cfg.Auth.Strategy == AuthStrategyLogin {
		// If we are using "login" strategy, let's combine the login passphrase
		// and the token signing key to form a new signing key. This way, if
		// either the login passphrase or the signing key is changed, active
		// sessions will be invalidated.
		signKey = fmt.Sprintf("%s+%s", signKey, cfg.Server.Credentials.Passphrase)
	}

	return signKey
}

// GenerateToken generates a signed token with an expiration of <ExpirationSeconds> seconds
func GenerateToken(username string) (TokenGenerated, error) {
	timeExpire := util.Clock.Now().Add(time.Second * time.Duration(Get().LoginToken.ExpirationSeconds))
	claim := IanaClaims{
		StandardClaims: jwt.StandardClaims{
			Subject:   username,
			ExpiresAt: timeExpire.Unix(),
			Issuer:    AuthStrategyLoginIssuer,
		},
	}

	ss, err := GetSignedTokenString(claim)
	if err != nil {
		return TokenGenerated{}, err
	}

	return TokenGenerated{Token: ss, ExpiresOn: timeExpire, Username: username}, nil
}

// ValidateToken checks if the input token is still valid
func ValidateToken(tokenString string) (string, error) {
	claims, err := GetTokenClaimsIfValid(tokenString)
	if err != nil {
		return "", err
	}

	return claims.Subject, nil
}

func GetTokenClaimsIfValid(tokenString string) (*IanaClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &IanaClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(GetSigningKey()), nil
	})
	if err != nil {
		return nil, err
	}

	if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
		return nil, fmt.Errorf("unexpected signing method: %s", token.Header["alg"])
	}

	if token.Valid {
		cfg := Get()
		claims := token.Claims.(*IanaClaims)

		if claims.Issuer != AuthStrategyLoginIssuer && claims.Issuer != AuthStrategyOpenshiftIssuer && claims.Issuer != AuthStrategyTokenIssuer {
			return nil, errors.New("token has invalid issuer (auth strategy)")
		}
		if claims.Issuer == AuthStrategyLoginIssuer && cfg.Auth.Strategy != AuthStrategyLogin {
			return nil, errors.New("token is invalid because of authentication strategy mismatch")
		}
		if claims.Issuer == AuthStrategyOpenshiftIssuer && cfg.Auth.Strategy != AuthStrategyOpenshift {
			return nil, errors.New("token is invalid because of authentication strategy mismatch")
		}
		if claims.Issuer == AuthStrategyTokenIssuer && cfg.Auth.Strategy != AuthStrategyToken {
			return nil, errors.New("token is invalid because of authentication strategy mismatch")
		}

		// A token with no expiration claim is invalid for Kiali
		if claims.ExpiresAt == 0 {
			return nil, errors.New("token is invalid because expiration claim is missing")
		}

		// If auth strategy is login and the subject claim does not match the username in the Kiali secret,
		// the token is invalid.
		if cfg.Auth.Strategy == AuthStrategyLogin && claims.Subject != cfg.Server.Credentials.Username {
			return nil, errors.New("username has changed")
		}

		return token.Claims.(*IanaClaims), nil
	}

	return nil, errors.New("invalid token")
}
