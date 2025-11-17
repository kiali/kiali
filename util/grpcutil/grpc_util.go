package grpcutil

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util/httputil"
)

// Implements google.golang.org/grpc/credentials.PerRPCCredentials
type perRPCCredentials struct {
	auth *config.Auth
}

func (c perRPCCredentials) GetRequestMetadata(ctx context.Context, in ...string) (map[string]string, error) {
	if c.auth == nil {
		return nil, nil
	}
	switch c.auth.Type {
	case config.AuthTypeBasic:
		username, err := c.auth.GetUsername()
		if err != nil {
			return nil, fmt.Errorf("failed to read username for basic auth: %w", err)
		}
		password, err := c.auth.GetPassword()
		if err != nil {
			return nil, fmt.Errorf("failed to read password for basic auth: %w", err)
		}
		encoded := base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
		return map[string]string{"authorization": "Basic " + encoded}, nil
	case config.AuthTypeBearer:
		token, err := c.auth.GetToken()
		if err != nil {
			return nil, fmt.Errorf("failed to read token for bearer auth: %w", err)
		}
		return map[string]string{"authorization": "Bearer " + token}, nil
	default:
		return nil, nil
	}
}

func (c perRPCCredentials) RequireTransportSecurity() bool {
	// Always require a secure transport. Certificate verification policy is
	// controlled via the TLS config (e.g., InsecureSkipVerify), not by
	// allowing plaintext connections.
	return true
}

func GetAuthDialOptions(conf *config.Config, _ bool, auth *config.Auth) ([]grpc.DialOption, error) {
	var opts []grpc.DialOption

	// Always enable TLS transport. If GetTLSConfig returns nil, fall back to a
	// default tls.Config to ensure we still negotiate TLS.
	tlscfg, err := httputil.GetTLSConfig(conf, auth)
	if err != nil {
		return nil, err
	}
	if tlscfg == nil {
		tlscfg = &tls.Config{}
	}
	opts = append(opts, grpc.WithTransportCredentials(credentials.NewTLS(tlscfg)))

	switch auth.Type {
	case config.AuthTypeBasic:
		opts = append(opts, grpc.WithPerRPCCredentials(perRPCCredentials{auth: auth}))
	case config.AuthTypeBearer:
		opts = append(opts, grpc.WithPerRPCCredentials(perRPCCredentials{auth: auth}))
	}
	return opts, nil
}
