package config

import (
	"errors"
)

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
