package authentication

import (
	"context"
)

type contextKey string

var ContextKeyAuthInfo contextKey = "authInfo"
var ContextKeySessionID contextKey = "sessionID"

func SetAuthInfoContext(ctx context.Context, value interface{}) context.Context {
	return context.WithValue(ctx, ContextKeyAuthInfo, value)
}

func GetAuthInfoContext(ctx context.Context) interface{} {
	return ctx.Value(ContextKeyAuthInfo)
}

func SetSessionIDContext(ctx context.Context, sessionID string) context.Context {
	return context.WithValue(ctx, ContextKeySessionID, sessionID)
}

func GetSessionIDContext(ctx context.Context) string {
	if value := ctx.Value(ContextKeySessionID); value != nil {
		if sessionID, ok := value.(string); ok {
			return sessionID
		}
	}
	return ""
}
