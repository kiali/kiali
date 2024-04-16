module github.com/kiali/kiali

go 1.22

require (
	github.com/NYTimes/gziphandler v1.1.1
	github.com/go-jose/go-jose v2.6.3+incompatible
	github.com/gogo/protobuf v1.3.2
	github.com/golang/protobuf v1.5.4
	github.com/google/go-cmp v0.6.0
	github.com/gorilla/mux v1.8.1
	github.com/mitchellh/mapstructure v1.4.3
	github.com/nitishm/engarde v0.1.1
	github.com/openshift/api v0.0.0-20200221181648-8ce0047d664f
	github.com/prometheus/client_golang v1.17.0
	github.com/prometheus/common v0.45.0
	github.com/rs/zerolog v1.20.0
	github.com/stretchr/testify v1.8.4
	go.opentelemetry.io/contrib/instrumentation/github.com/gorilla/mux/otelmux v0.47.0
	go.opentelemetry.io/otel v1.22.0
	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.22.0
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.22.0
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.22.0
	go.opentelemetry.io/otel/sdk v1.22.0
	go.opentelemetry.io/otel/trace v1.22.0
	go.uber.org/automaxprocs v1.5.3
	golang.org/x/exp v0.0.0-20231006140011-7918f672742d
	golang.org/x/net v0.20.0
	golang.org/x/sync v0.4.0
	google.golang.org/genproto/googleapis/api v0.0.0-20240116215550-a9fa1716bcac
	google.golang.org/grpc v1.60.1
	google.golang.org/protobuf v1.33.0
	gopkg.in/yaml.v2 v2.4.0
	istio.io/api v1.21.1-0.20240404235206-c5bbf8925ab4
	istio.io/client-go v1.21.1
	k8s.io/api v0.29.0
	k8s.io/apimachinery v0.29.0
	k8s.io/client-go v0.29.0
	sigs.k8s.io/gateway-api v1.0.1-0.20231204134048-c7da42e6eafc
)

require (
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cenkalti/backoff/v4 v4.2.1 // indirect
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/emicklei/go-restful/v3 v3.11.0 // indirect
	github.com/evanphx/json-patch v5.7.0+incompatible // indirect
	github.com/felixge/httpsnoop v1.0.4 // indirect
	github.com/go-logr/logr v1.4.1 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/go-openapi/jsonpointer v0.20.0 // indirect
	github.com/go-openapi/jsonreference v0.20.2 // indirect
	github.com/go-openapi/swag v0.22.4 // indirect
	github.com/google/gnostic-models v0.6.8 // indirect
	github.com/google/gofuzz v1.2.0 // indirect
	github.com/google/uuid v1.3.1 // indirect
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.16.0 // indirect
	github.com/imdario/mergo v0.3.16 // indirect
	github.com/josharian/intern v1.0.0 // indirect
	github.com/json-iterator/go v1.1.12 // indirect
	github.com/mailru/easyjson v0.7.7 // indirect
	github.com/matttproud/golang_protobuf_extensions/v2 v2.0.0 // indirect
	github.com/moby/spdystream v0.2.0 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/modern-go/reflect2 v1.0.2 // indirect
	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
	github.com/mxk/go-flowrate v0.0.0-20140419014527-cca7078d478f // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/prometheus/client_model v0.5.0 // indirect
	github.com/prometheus/procfs v0.12.0 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	github.com/stretchr/objx v0.5.0 // indirect
	github.com/vjeantet/grok v1.0.0 // indirect
	go.opentelemetry.io/otel/metric v1.22.0 // indirect
	go.opentelemetry.io/proto/otlp v1.0.0 // indirect
	golang.org/x/crypto v0.18.0 // indirect
	golang.org/x/oauth2 v0.13.0 // indirect
	golang.org/x/sys v0.16.0 // indirect
	golang.org/x/term v0.16.0 // indirect
	golang.org/x/text v0.14.0 // indirect
	golang.org/x/time v0.3.0 // indirect
	google.golang.org/appengine v1.6.8 // indirect
	google.golang.org/genproto v0.0.0-20240116215550-a9fa1716bcac // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20240116215550-a9fa1716bcac // indirect
	gopkg.in/go-jose/go-jose.v2 v2.6.3 // indirect
	gopkg.in/inf.v0 v0.9.1 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
	k8s.io/klog/v2 v2.110.1 // indirect
	k8s.io/kube-openapi v0.0.0-20231010175941-2dd684a91f00 // indirect
	k8s.io/utils v0.0.0-20230726121419-3b25d923346b // indirect
	sigs.k8s.io/json v0.0.0-20221116044647-bc3834ca7abd // indirect
	sigs.k8s.io/structured-merge-diff/v4 v4.4.1 // indirect
	sigs.k8s.io/yaml v1.4.0 // indirect
)

replace gopkg.in/yaml.v3 => gopkg.in/yaml.v3 v3.0.1
