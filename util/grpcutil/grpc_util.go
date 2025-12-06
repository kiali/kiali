package grpcutil

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util/httputil"
)

// Implements google.golang.org/grpc/credentials.PerRPCCredentials
type perRPCCredentials struct {
	auth            *config.Auth
	conf            *config.Config
	requireSecurity bool
}

func (c perRPCCredentials) GetRequestMetadata(ctx context.Context, in ...string) (map[string]string, error) {
	if c.auth == nil {
		return nil, nil
	}
	switch c.auth.Type {
	case config.AuthTypeBasic:
		username, err := c.conf.GetCredential(c.auth.Username)
		if err != nil {
			return nil, fmt.Errorf("failed to read username for basic auth: %w", err)
		}
		password, err := c.conf.GetCredential(c.auth.Password)
		if err != nil {
			return nil, fmt.Errorf("failed to read password for basic auth: %w", err)
		}
		encoded := base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
		return map[string]string{"authorization": "Basic " + encoded}, nil
	case config.AuthTypeBearer:
		token, err := c.conf.GetCredential(c.auth.Token)
		if err != nil {
			return nil, fmt.Errorf("failed to read token for bearer auth: %w", err)
		}
		return map[string]string{"authorization": "Bearer " + token}, nil
	default:
		return nil, nil
	}
}

func (c perRPCCredentials) RequireTransportSecurity() bool {
	// Return whether transport security (TLS) is required based on connection type.
	// This allows credentials to be sent over insecure connections when needed (e.g., test environments).
	return c.requireSecurity
}

// GetAuthDialOptions builds secure dial options that keep credentials fresh and enforce
// SAN validation for the provided serverName (host or IP) on every gRPC call.
func GetAuthDialOptions(conf *config.Config, serverName string, useTLS bool, auth *config.Auth) ([]grpc.DialOption, error) {
	var opts []grpc.DialOption

	// Configure TLS transport if requested
	if useTLS {
		tlscfg, err := httputil.GetTLSConfigForServer(conf, auth, serverName)
		if err != nil {
			return nil, err
		}
		if tlscfg == nil {
			// If no specific TLS config, use default TLS settings
			tlscfg = &tls.Config{}
		}
		opts = append(opts, grpc.WithTransportCredentials(credentials.NewTLS(tlscfg)))
	} else {
		// Use insecure credentials for non-TLS connections (e.g., test environments)
		opts = append(opts, grpc.WithTransportCredentials(insecure.NewCredentials()))
	}

	// Add per-RPC credentials for authentication
	if auth != nil {
		switch auth.Type {
		case config.AuthTypeBasic:
			opts = append(opts, grpc.WithPerRPCCredentials(perRPCCredentials{auth: auth, conf: conf, requireSecurity: useTLS}))
		case config.AuthTypeBearer:
			opts = append(opts, grpc.WithPerRPCCredentials(perRPCCredentials{auth: auth, conf: conf, requireSecurity: useTLS}))
		}
	}
	return opts, nil
}
