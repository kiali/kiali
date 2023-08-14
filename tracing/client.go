package tracing

import (
	"context"
	"errors"
	"fmt"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/grpcutil"
	"github.com/kiali/kiali/util/httputil"
	"google.golang.org/grpc"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"time"

	jaegerModel "github.com/kiali/kiali/jaeger/model"
)

// Client for OTel API.
type Client struct {
	grpcClient jaegerModel.QueryServiceClient
	httpClient http.Client
	baseURL    *url.URL
	ctx        context.Context
}

func NewClient(token string) (*Client, error) {
	cfg := config.Get()
	cfgTracing := cfg.ExternalServices.Tracing

	if !cfgTracing.Enabled {
		return nil, errors.New("tracing is not enabled")
	} else {
		auth := cfgTracing.Auth
		if auth.UseKialiToken {
			auth.Token = token
		}
		ctx := context.Background()

		u, errParse := url.Parse(cfgTracing.InClusterURL)
		if !cfg.InCluster {
			u, errParse = url.Parse(cfgTracing.URL)
		}
		if errParse != nil {
			log.Errorf("Error parsing Tracing URL: %s", errParse)
			return nil, errParse
		}

		if cfgTracing.UseGRPC {
			// GRPC client

			port := u.Port()
			if port == "" {
				p, _ := net.LookupPort("tcp", u.Scheme)
				port = strconv.Itoa(p)
			}
			opts, err := grpcutil.GetAuthDialOptions(u.Scheme == "https", &auth)
			if err != nil {
				log.Errorf("Error while building GRPC dial options: %v", err)
				return nil, err
			}
			address := fmt.Sprintf("%s:%s", u.Hostname(), port)
			log.Tracef("Tracing GRPC client info: address=%s, auth.type=%s", address, auth.Type)
			conn, err := grpc.Dial(address, opts...)
			if err != nil {
				log.Errorf("Error while establishing GRPC connection: %v", err)
				return nil, err
			}
			client := jaegerModel.NewQueryServiceClient(conn)
			log.Infof("Create Jaeger GRPC client %s", address)
			return &Client{grpcClient: client, ctx: ctx}, nil
		} else {
			// Legacy HTTP client
			log.Tracef("Using legacy HTTP client for Jaeger: url=%v, auth.type=%s", u, auth.Type)
			timeout := time.Duration(config.Get().ExternalServices.Tracing.QueryTimeout) * time.Second
			transport, err := httputil.CreateTransport(&auth, &http.Transport{}, timeout, nil)
			if err != nil {
				return nil, err
			}
			client := http.Client{Transport: transport, Timeout: timeout}
			log.Infof("Create Jaeger HTTP client %s", u)
			return &Client{httpClient: client, baseURL: u, ctx: ctx}, nil
		}
	}

}
