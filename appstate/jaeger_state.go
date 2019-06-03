package appstate

import "github.com/kiali/kiali/config"

// JaegerEnabled is a memo-flag to tell if Jaeger was configured or succesfully discovered
var JaegerEnabled = false

// JaegerConfig is a copy of config.TracingConfig from global config, that can be mutated (e.g. for URL discovery)
var JaegerConfig config.TracingConfig
