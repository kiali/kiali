//go:build !exclude_frontend

package frontend

import (
	"embed"
)

//go:embed all:build
var FrontendBuildAssets embed.FS
