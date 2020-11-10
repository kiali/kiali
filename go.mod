module github.com/kiali/kiali

go 1.14

require (
	github.com/NYTimes/gziphandler v1.1.1
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/dgrijalva/jwt-go v3.2.0+incompatible
	github.com/golang/glog v0.0.0-20160126235308-23def4e6c14b // indirect
	github.com/golang/groupcache v0.0.0-20200121045136-8c9f03a8e57e // indirect
	github.com/googleapis/gnostic v0.4.0 // indirect
	github.com/gorilla/mux v1.7.4
	github.com/hashicorp/go-version v1.2.0
	github.com/hashicorp/golang-lru v0.5.4 // indirect
	github.com/jaegertracing/jaeger v1.15.1
	github.com/kiali/k-charted v0.6.3
	github.com/matttproud/golang_protobuf_extensions v1.0.2-0.20181231171920-c182affec369 // indirect
	github.com/openshift/api v0.0.0-20200221181648-8ce0047d664f
	github.com/prometheus/client_golang v1.8.0
	github.com/prometheus/client_model v0.2.0 // indirect
	github.com/prometheus/common v0.14.0
	github.com/prometheus/procfs v0.2.0 // indirect
	github.com/rs/zerolog v1.20.0
	github.com/stretchr/testify v1.4.0
	golang.org/x/sync v0.0.0-20190911185100-cd5d95a43a6e
	golang.org/x/text v0.3.3 // indirect
	google.golang.org/appengine v1.6.6 // indirect
	gopkg.in/asn1-ber.v1 v1.0.0-20181015200546-f715ec2f112d // indirect
	gopkg.in/square/go-jose.v2 v2.5.1
	gopkg.in/yaml.v2 v2.3.0
	k8s.io/api v0.0.0-20190313235455-40a48860b5ab
	k8s.io/apimachinery v0.0.0-20190816221834-a9f1d8a9c101
	k8s.io/client-go v11.0.1-0.20190820062731-7e43eff7c80a+incompatible
)

replace github.com/kiali/k-charted => github.com/zackzhangkai/k-charted v0.6.4-0.20201110064236-a29a9ac82292
