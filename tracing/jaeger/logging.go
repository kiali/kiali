package jaeger

import (
	"context"

	"github.com/rs/zerolog"

	"github.com/kiali/kiali/log"
)

// getLoggerFromContextGRPCJaeger returns the logger found in the context and adds the type key to refer to this as the gRPC Jaeger logger
func getLoggerFromContextGRPCJaeger(ctx context.Context) *zerolog.Logger {
	zl := log.FromContext(ctx).With().Str("impl", "gRPC Jaeger").Logger()
	return &zl
}

// getLoggerFromContextHTTPJaeger returns the logger found in the context and adds the type key to refer to this as the HTTP Jaeger logger
func getLoggerFromContextHTTPJaeger(ctx context.Context) *zerolog.Logger {
	zl := log.FromContext(ctx).With().Str("impl", "HTTP Jaeger").Logger()
	return &zl
}
