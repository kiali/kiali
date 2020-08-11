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

	if err := ValidateSigningKey(signKey, cfg.Auth.Strategy); err != nil {
		panic(err)
	}

	return signKey
}

func ValidateSigningKey(signingKey string, authStrategy string) error {
	if authStrategy != AuthStrategyAnonymous && (len(signingKey) == 0 || signingKey == "kiali") {
		// "kiali" is a well-known signing key reported in a CVE. We ban it's usage.
		// An empty key is also just not allowed.
		return errors.New("signing key for login tokens is invalid")
	}

	return nil
}

// GenerateToken generates a signed token with an expiration of <ExpirationSeconds> seconds
func GenerateToken(username string) (TokenGenerated, error) {
	timeExpire := util.Clock.Now().Add(time.Second * time.Duration(Get().LoginToken.ExpirationSeconds))
	claim := IanaClaims{
		StandardClaims: jwt.StandardClaims{
			Subject:   username,
			ExpiresAt: timeExpire.Unix(),
			Issuer:    AuthStrategyTokenIssuer,
		},
	}

	ss, err := GetSignedTokenString(claim)
	if err != nil {
		return TokenGenerated{}, err
	}

	return TokenGenerated{Token: ss, ExpiresOn: timeExpire, Username: username}, nil
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

		if claims.Issuer != AuthStrategyOpenshiftIssuer && claims.Issuer != AuthStrategyTokenIssuer && claims.Issuer != AuthStrategyOpenIdIssuer {
			return nil, errors.New("token has invalid issuer (auth strategy)")
		}
		if claims.Issuer == AuthStrategyOpenshiftIssuer && cfg.Auth.Strategy != AuthStrategyOpenshift {
			return nil, errors.New("token is invalid because of openshift authentication strategy mismatch")
		}
		if claims.Issuer == AuthStrategyTokenIssuer && cfg.Auth.Strategy != AuthStrategyToken {
			return nil, errors.New("token is invalid because of token authentication strategy mismatch")
		}
		if claims.Issuer == AuthStrategyOpenIdIssuer && cfg.Auth.Strategy != AuthStrategyOpenId {
			return nil, errors.New("token is invalid because of openid authentication strategy mismatch")
		}

		// A token with no expiration claim is invalid for Kiali
		if claims.ExpiresAt == 0 {
			return nil, errors.New("token is invalid because expiration claim is missing")
		}

		return token.Claims.(*IanaClaims), nil
	}

	return nil, errors.New("invalid token")
}
