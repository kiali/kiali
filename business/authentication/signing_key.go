package authentication

import (
	"github.com/kiali/kiali/config"
)

func getSigningKey(conf *config.Config) string {
	signKey := conf.LoginToken.SigningKey

	if err := config.ValidateSigningKey(signKey, conf.Auth.Strategy); err != nil {
		panic(err)
	}

	return signKey
}
