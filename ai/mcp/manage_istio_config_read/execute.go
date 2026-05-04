package manage_istio_config_read

import (
	"github.com/kiali/kiali/ai/mcp/manage_istio_config"
	"github.com/kiali/kiali/ai/mcputil"
)

// Execute runs read-only Istio config actions (list, get). For create, patch, or delete use manage_istio_config.
func Execute(kialiInterface *mcputil.KialiInterface, args map[string]interface{}) (interface{}, int) {
	return manage_istio_config.ExecuteReadOnly(kialiInterface, args)
}
