package authentication

import (
	"context"
)

type contextKey string

var ContextKeyAuthInfo contextKey = "authInfo"

func SetAuthInfoContext(ctx context.Context, value interface{}) context.Context {
	return context.WithValue(ctx, ContextKeyAuthInfo, value)
}

func GetAuthInfoContext(ctx context.Context) interface{} {
	return ctx.Value(ContextKeyAuthInfo)
}
