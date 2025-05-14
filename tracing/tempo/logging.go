package tempo

import (
	"context"

	"github.com/rs/zerolog"

	"github.com/kiali/kiali/log"
)

// getLoggerFromContextGRPCTempo returns the logger found in the context and adds the type key to refer to this as the gRPC Tempo logger
func getLoggerFromContextGRPCTempo(ctx context.Context) *zerolog.Logger {
	zl := log.FromContext(ctx).With().Str("client-type", "gRPC Tempo").Logger()
	return &zl
}

// getLoggerFromContextHTTPTempo returns the logger found in the context and adds the type key to refer to this as the HTTP Tempo logger
func getLoggerFromContextHTTPTempo(ctx context.Context) *zerolog.Logger {
	zl := log.FromContext(ctx).With().Str("client-type", "HTTP Tempo").Logger()
	return &zl
}
