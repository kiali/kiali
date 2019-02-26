package config

import (
	"errors"
	"fmt"
	"time"

	"github.com/dgrijalva/jwt-go"
)

// Structured version of Claims Section, as referenced at
// https://tools.ietf.org/html/rfc7519#section-4.1
// See examples for how to use this with your own claim types
type IanaClaims struct {
	SessionId string `json:"sid,omitempty"`
	jwt.StandardClaims
}

// TokenGenerated tokenGenerated
//
// This is used for returning the token
//
// swagger:model TokenGenerated
type TokenGenerated struct {
	// The username for the token
	// A string with the user's username
	//
	// example: admin
	// required: true
	Username string `json:"username"`
	// The authentication token
	// A string with the authentication token for the user
	//
	// example: zI1NiIsIsR5cCI6IkpXVCJ9.ezJ1c2VybmFtZSI6ImFkbWluIiwiZXhwIjoxNTI5NTIzNjU0fQ.PPZvRGnR6VA4v7FmgSfQcGQr-VD
	// required: true
	Token string `json:"token"`
	// The expired time for the token
	// A string with the Datetime when the token will be expired
	//
	// example: 2018-06-20 19:40:54.116369887 +0000 UTC m=+43224.838320603
	// required: true
	ExpiresOn time.Time `json:"expiresOn"`
}

func GetSignedTokenString(claims jwt.Claims) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	ss, err := token.SignedString(Get().LoginToken.SigningKey)

	if err != nil {
		return "", err
	}

	return ss, nil
}

// GenerateToken generates a signed token with an expiration of <ExpirationSeconds> seconds
func GenerateToken(username string) (TokenGenerated, error) {
	timeExpire := time.Now().Add(time.Second * time.Duration(Get().LoginToken.ExpirationSeconds))
	claim := IanaClaims{
		StandardClaims: jwt.StandardClaims{
			Subject:   username,
			ExpiresAt: timeExpire.Unix(),
			Issuer:    StrategyLoginIssuer,
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
		return Get().LoginToken.SigningKey, nil
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

		if claims.Issuer != StrategyLoginIssuer && claims.Issuer != StrategyOpenshiftIssuer {
			return nil, errors.New("token has invalid issuer (auth strategy)")
		}
		if claims.Issuer == StrategyLoginIssuer && cfg.Auth.Strategy != StrategyLogin {
			return nil, errors.New("token is invalid because of authentication strategy mismatch")
		}
		if claims.Issuer == StrategyOpenshiftIssuer && cfg.Auth.Strategy != StrategyOpenshift {
			return nil, errors.New("token is invalid because of authentication strategy mismatch")
		}

		return token.Claims.(*IanaClaims), nil
	}

	return nil, errors.New("Invalid token")
}
