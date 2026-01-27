package manage_istio_config

import (
	"net/http"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

func audit(r *http.Request, operation, namespace, gvk, message string) {
	if config.Get().Server.AuditLog {
		user := r.Header.Get("Kiali-User")
		log.FromRequest(r).
			Info().
			Str("operation", operation).
			Str("namespace", namespace).
			Str("gvk", gvk).
			Str("user", user).
			Msgf("AUDIT: %s", message)
	}
}
