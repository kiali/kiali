package config

import (
	"errors"
	"fmt"

	"github.com/dgrijalva/jwt-go"
)

// Structured version of Claims Section, as referenced at
// https://tools.ietf.org/html/rfc7519#section-4.1
// See examples for how to use this with your own claim types
type IanaClaims struct {
	SessionId string `json:"sid,omitempty"`
	jwt.StandardClaims
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
	if authStrategy != AuthStrategyAnonymous {
		if len(signingKey) != 16 && len(signingKey) != 24 && len(signingKey) != 32 {
			return errors.New("signing key for sessions must be 16, 24 or 32 bytes length")
		}
	}

	return nil
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
