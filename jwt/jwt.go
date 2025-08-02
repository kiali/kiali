package jwt

import (
	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
)

// AllowedSignatureAlgorithms contains all JOSE asymmetric signing algorithm values as defined by RFC 7518
//
// see: https://tools.ietf.org/html/rfc7518#section-3.1
var AllowedSignatureAlgorithms = []jose.SignatureAlgorithm{
	jose.ES256,
	jose.ES384,
	jose.ES512,
	jose.EdDSA,
	jose.HS256,
	jose.HS384,
	jose.HS512,
	jose.PS256,
	jose.PS384,
	jose.PS512,
	jose.RS256,
	jose.RS384,
	jose.RS512,
}

func ParseSignedCompact(token string) (*jose.JSONWebSignature, error) {
	return jose.ParseSignedCompact(token, AllowedSignatureAlgorithms)
}

func ParseSigned(token string) (*jwt.JSONWebToken, error) {
	return jwt.ParseSigned(token, AllowedSignatureAlgorithms)
}
