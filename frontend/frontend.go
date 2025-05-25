package frontend

import (
	"embed"
)

//go:embed build/*
var FrontendBuildAssets embed.FS
