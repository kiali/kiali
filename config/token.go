package config

import (
	"errors"
	"fmt"
	"time"

	"github.com/dgrijalva/jwt-go"

	"github.com/kiali/kiali/log"
)

// Structured version of Claims Section, as referenced at
// https://tools.ietf.org/html/rfc7519#section-4.1
// See examples for how to use this with your own claim types
type TokenClaim struct {
	User string `json:"username"`
	jwt.StandardClaims
}

// TokenGenerated tokenGenerated
//
// This is used for returning the token
//
// swagger:model TokenGenerated
type TokenGenerated struct {
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
	ExpiredAt string `json:"expired_at"`
}

// GenerateToken generates a signed token with an expiration of <ExpirationSeconds> seconds
func GenerateToken(username string) (TokenGenerated, error) {
	timeExpire := time.Now().Add(time.Second * time.Duration(Get().LoginToken.ExpirationSeconds))
	claim := TokenClaim{
		username,
		jwt.StandardClaims{
			ExpiresAt: timeExpire.Unix(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claim)
	ss, err := token.SignedString(Get().LoginToken.SigningKey)
	if err != nil {
		return TokenGenerated{}, err
	}

	return TokenGenerated{Token: ss, ExpiredAt: timeExpire.String()}, nil
}

// ValidateToken checks if the input token is still valid
func ValidateToken(tokenString string) error {
	token, err := jwt.ParseWithClaims(tokenString, &jwt.StandardClaims{}, func(token *jwt.Token) (interface{}, error) {
		return Get().LoginToken.SigningKey, nil
	})
	if err != nil {
		return err
	}
	if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
		return fmt.Errorf("Unexpected signing method: %s", token.Header["alg"])
	}
	if token.Valid {
		return nil
	} else if ve, ok := err.(*jwt.ValidationError); ok {
		if ve.Errors&jwt.ValidationErrorMalformed != 0 {
			log.Debugf("That's not even a token")
			return errors.New("That's not even a token")
		} else if ve.Errors&(jwt.ValidationErrorExpired|jwt.ValidationErrorNotValidYet) != 0 {
			// Token is either expired or not active yet
			log.Debugf("Token expired ... Timing is everything")
			return errors.New("Token expired ... Timing is everything")
		} else {
			log.Debugf("Couldn't handle this token:", err)
			return err
		}
	} else {
		log.Debugf("Couldn't handle this token:", err)
		return err
	}
}
