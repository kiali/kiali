package ldap

import (
	"fmt"
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

// GenerateToken generates JWT
func GenerateToken(user User, authConfig config.AuthConfig) (Token, error) {
	signingKey := config.GetSigningKey()

	// Create the token
	token := jwt.New(jwt.SigningMethodHS256)
	expirationTime := time.Now().Add(time.Second * time.Duration(config.Get().LoginToken.ExpirationSeconds))
	// Create a map to store our claims
	claims := token.Claims.(jwt.MapClaims)

	// Set token claims
	claims["username"] = user.Username
	claims["uid"] = user.UID
	claims["groups"] = user.Groups
	claims["exp"] = expirationTime.Unix()
	claims["iat"] = time.Now().Unix()
	claims["iss"] = config.AuthStrategyLDAPIssuer

	signedToken, err := token.SignedString([]byte(signingKey))
	if err != nil {
		log.Errorf("Cannot sign token  : %s", err)
		return Token{}, err
	}
	return Token{
		JWT:    signedToken,
		Expiry: expirationTime,
	}, nil
}

// ValidateToken validates JWT token provided by user and fills out the UserInfo structure from the data within
func ValidateToken(token string) (UserInfo, error) {
	return validate(token)
}

// validate does much of the work of ValidateToken
func validate(bearerToken string) (UserInfo, error) {

	signingKey := config.GetSigningKey()

	auth := false
	var claims JWTClaimsJSON // special struct for decoding the json
	u := UserInfo{           // user we'll return, initially in error state
		APIVersion: "authentication.k8s.io/v1beta1",
		Kind:       "TokenReview",
		Status: &Status{
			Authenticated: &auth,
			User:          nil,
		},
	}

	token, err := jwt.ParseWithClaims(bearerToken, &claims, func(token *jwt.Token) (interface{}, error) {
		if !strings.HasPrefix(token.Method.Alg(), "HS") { // HMAC are the only allowed signing methods
			log.Errorf("Unexpected signing method: %s", token.Method.Alg())
			return nil, fmt.Errorf("Unexpected signing method: %s", token.Method.Alg())
		}
		return []byte(signingKey), nil
	})

	if token == nil || !token.Valid {
		log.Debugf("Token not valid: %v", err)
		return u, err
	}

	// Token is valid so fill in the rest of u with happy state and return it
	auth = true
	u.Status.Authenticated = &auth
	u.Status.User = &User{Username: claims.Username, UID: claims.UID, Groups: claims.Groups}

	return u, nil
}
