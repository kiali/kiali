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

type TokenGenerated struct {
	Token     string `json:"token"`
	ExpiredAt string `json:"expired_at"`
}

/*
Generate the token with a Expiraton of <ExpiresAt> seconds
*/
func GenerateToken(username string) (TokenGenerated, error) {
	timeExpire := time.Now().Add(time.Second * time.Duration(Get().Token.ExpirationAt))
	claim := TokenClaim{
		username,
		jwt.StandardClaims{
			ExpiresAt: timeExpire.Unix(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claim)
	ss, err := token.SignedString(Get().Token.Secret)
	if err != nil {
		return TokenGenerated{}, err
	}

	return TokenGenerated{Token: ss, ExpiredAt: timeExpire.String()}, nil
}

func ValidateToken(tokenString string) error {
	token, err := jwt.ParseWithClaims(tokenString, &jwt.StandardClaims{}, func(token *jwt.Token) (interface{}, error) {
		return Get().Token.Secret, nil
	})
	if err != nil {
		return err
	}
	if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
		return errors.New(fmt.Sprintf("Unexpected signing method: ", token.Header["alg"]))
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
	return nil
}
