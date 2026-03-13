package manage_istio_config_read

import (
	"net/http"

	"github.com/kiali/kiali/ai/mcp/manage_istio_config"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
)

// Execute runs read-only Istio config actions (list, get). For create, patch, or delete use manage_istio_config.
func Execute(r *http.Request, args map[string]interface{}, businessLayer *business.Layer, conf *config.Config) (interface{}, int) {
	return manage_istio_config.ExecuteReadOnly(r, args, businessLayer, conf)
}
