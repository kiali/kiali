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
	ss, err := token.SignedString([]byte(Get().LoginToken.SigningKey))

	if err != nil {
		return "", err
	}

	return ss, nil
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
		return []byte(Get().LoginToken.SigningKey), nil
	})
	if err != nil {
		return nil, err
	}

	if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
		return nil, fmt.Errorf("Unexpected signing method: %s", token.Header["alg"])
	}

	if token.Valid {
		cfg := Get()
		claims := token.Claims.(*IanaClaims)

		if claims.Issuer != AuthStrategyLoginIssuer && claims.Issuer != AuthStrategyOpenshiftIssuer {
			return nil, errors.New("token has invalid issuer (auth strategy)")
		}
		if claims.Issuer == AuthStrategyLoginIssuer && cfg.Auth.Strategy != AuthStrategyLogin {
			return nil, errors.New("token is invalid because of authentication strategy mismatch")
		}
		if claims.Issuer == AuthStrategyOpenshiftIssuer && cfg.Auth.Strategy != AuthStrategyOpenshift {
			return nil, errors.New("token is invalid because of authentication strategy mismatch")
		}

		return token.Claims.(*IanaClaims), nil
	}

	return nil, errors.New("Invalid token")
}
