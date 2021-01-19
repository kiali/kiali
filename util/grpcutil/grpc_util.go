package grpcutil

import (
	"context"
	"encoding/base64"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util/httputil"
)

// Implements google.golang.org/grpc/credentials.PerRPCCredentials
type perRPCCredentials struct {
	auth string
}

func (c perRPCCredentials) GetRequestMetadata(ctx context.Context, in ...string) (map[string]string, error) {
	return map[string]string{"authorization": c.auth}, nil
}

func (perRPCCredentials) RequireTransportSecurity() bool {
	return true
}

func GetAuthDialOptions(tls bool, auth *config.Auth) ([]grpc.DialOption, error) {
	if auth == nil {
		return []grpc.DialOption{grpc.WithInsecure()}, nil
	}
	var opts []grpc.DialOption
	if tls {
		tlscfg, err := httputil.GetTLSConfig(auth)
		if err != nil {
			return nil, err
		}
		if tlscfg != nil {
			opts = append(opts, grpc.WithTransportCredentials(credentials.NewTLS(tlscfg)))
		}
	}
	if auth.Type == config.AuthTypeBasic {
		encoded := base64.StdEncoding.EncodeToString([]byte(auth.Username + ":" + auth.Password))
		opts = append(opts, grpc.WithPerRPCCredentials(perRPCCredentials{auth: "Basic " + encoded}))
	} else if auth.Type == config.AuthTypeBearer {
		opts = append(opts, grpc.WithPerRPCCredentials(perRPCCredentials{auth: "Bearer " + auth.Token}))
	}
	if len(opts) == 0 {
		opts = append(opts, grpc.WithInsecure())
	}
	return opts, nil
}
