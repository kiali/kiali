package httputil

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
)

func setupAndCreateRequest() *http.Request {
	conf := config.NewConfig()
	conf.Server.WebRoot = "/custom/kiali"
	conf.Server.Port = 700
	config.Set(conf)

	request, _ := http.NewRequest("GET", "https://kiali:2800/custom/kiali/path/", nil)
	return request
}

func TestGuessKialiURLParsesFromRequest(t *testing.T) {
	request := setupAndCreateRequest()
	guessedUrl := GuessKialiURL(request)

	assert.Equal(t, "https://kiali:2800/custom/kiali", guessedUrl)
}

func TestGuessKialiURLReadsForwardedSchema(t *testing.T) {
	// See reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-Proto

	request := setupAndCreateRequest()
	request.Header.Add("X-Forwarded-Proto", "http")
	guessedUrl := GuessKialiURL(request)

	assert.Equal(t, "http://kiali:2800/custom/kiali", guessedUrl)
}

func TestGuessKialiURLReadsForwardedHost(t *testing.T) {
	// See reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-Host

	request := setupAndCreateRequest()
	request.Header.Add("X-Forwarded-Host", "id42.example-cdn.com")
	guessedUrl := GuessKialiURL(request)

	assert.Equal(t, "https://id42.example-cdn.com:2800/custom/kiali", guessedUrl)
}

func TestGuessKialiURLReadsForwardedPort(t *testing.T) {
	// See reference: https://docs.aws.amazon.com/elasticloadbalancing/latest/classic/x-forwarded-headers.html#x-forwarded-port

	request := setupAndCreateRequest()
	request.Header.Add("X-Forwarded-Port", "123456")
	guessedUrl := GuessKialiURL(request)

	assert.Equal(t, "https://kiali:123456/custom/kiali", guessedUrl)
}

func TestGuessKialiURLWebFQDNPort(t *testing.T) {
	// See reference: https://docs.aws.amazon.com/elasticloadbalancing/latest/classic/x-forwarded-headers.html#x-forwarded-port

	conf := config.NewConfig()
	conf.Server.WebRoot = "/custom/kiali"
	conf.Server.WebPort = "1234"
	conf.Server.Port = 700
	config.Set(conf)

	request, _ := http.NewRequest("GET", "https://kiali:2800/custom/kiali/path/", nil)
	guessedUrl := GuessKialiURL(request)

	assert.Equal(t, "https://kiali:1234/custom/kiali", guessedUrl)
}

func TestGuessKialiURLReadsHostPortFromRequestUrlAttr(t *testing.T) {
	request := setupAndCreateRequest()
	request.URL.Host = "myHost:8000"
	guessedUrl := GuessKialiURL(request)

	assert.Equal(t, "https://myHost:8000/custom/kiali", guessedUrl)
}

func TestGuessKialiURLReadsHostPortFromHostAttr(t *testing.T) {
	request := setupAndCreateRequest()
	request.URL.Host = ""
	request.Host = "example.com:901"
	guessedUrl := GuessKialiURL(request)

	assert.Equal(t, "https://example.com:901/custom/kiali", guessedUrl)
}

func TestGuessKialiURLReadsHostPortFromHostAttrDefault(t *testing.T) {
	request := setupAndCreateRequest()
	request.URL.Host = "example.com"
	request.Host = "example.com"
	guessedUrl := GuessKialiURL(request)

	assert.Equal(t, "https://example.com/custom/kiali", guessedUrl)
}

func TestGuessKialiURLOmitsStandardPlainHttpPort(t *testing.T) {
	// See reference: https://docs.aws.amazon.com/elasticloadbalancing/latest/classic/x-forwarded-headers.html#x-forwarded-port

	request := setupAndCreateRequest()
	request.Header.Add("X-Forwarded-Port", "80")
	request.Header.Add("X-Forwarded-Proto", "http")
	guessedUrl := GuessKialiURL(request)

	assert.Equal(t, "http://kiali/custom/kiali", guessedUrl)
}

func TestGuessKialiURLOmitsStandardSecureHttpsPort(t *testing.T) {
	// See reference: https://docs.aws.amazon.com/elasticloadbalancing/latest/classic/x-forwarded-headers.html#x-forwarded-port

	request := setupAndCreateRequest()
	request.Header.Add("X-Forwarded-Port", "443")
	request.Header.Add("X-Forwarded-Proto", "https")
	guessedUrl := GuessKialiURL(request)

	assert.Equal(t, "https://kiali/custom/kiali", guessedUrl)
}

func TestGuessKialiURLPrioritizesConfig(t *testing.T) {
	request := setupAndCreateRequest()

	conf := config.NewConfig()
	conf.Server.WebFQDN = "subdomain.domain.dev"
	conf.Server.WebPort = "4321"
	conf.Server.WebRoot = "/foo/bar"
	conf.Server.WebSchema = "http"
	conf.Server.Port = 700
	config.Set(conf)

	request.Header.Add("X-Forwarded-Port", "443")
	request.Header.Add("X-Forwarded-Proto", "https")
	guessedUrl := GuessKialiURL(request)

	assert.Equal(t, "http://subdomain.domain.dev:4321/foo/bar", guessedUrl)
}
