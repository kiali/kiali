# Handlers

Handlers in Kiali are associated with a particular Route defined in [routes.go](../routing/routes.go). When a request matches the URL pattern for a Route, the associated Handler is called. For example, when the router receives a request at `/api/clusters/health` the `ClustersHealth` handler is then called.

Handlers must conform to the [net/http HandlerFunc](https://pkg.go.dev/net/http#HandlerFunc) signature. They typically create [business service(s)](../business/) _per request_ but they also need access to a number of objects that are initialized only once when the Kiali server first starts and then are reused across requests like the [config object](../config/config.go) or the [kiali cache](../kubernetes/cache/cache.go). In order to pass these cross request dependencies, handlers should be defined as closures, allowing the handler to be called once with the cross request dependencies when it is first defined in [routes.go](../routing/routes.go), and then invoked again repeatedly as a `HandlerFunc` when it is matched in the router.

Example:
```go
routing/routes.go

...
{
    "PizzaHandler",
    "GET",
    "/api/pizzas",
    handlers.PizzaHandler(conf, cache),
    true,
},
```

```go
handlers/pizza.go

func PizzaHandler(conf *config.Config, cache cache.KialiCache) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
        clusterName := conf.KubernetesConfig.ClusterName
        cache.GetPizzas(clusterName)
        ...
    }
}
```

When writing a unit test you should use the actual handler. Aside from a few helper functions that simply reduce the amount of boilerplate you need to write, there is no magic and there are no global variables being used to test your handler.
```go
handlers/pizza_test.go

func TestPizzaHandler(t *testing.T) {
    conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient()
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	
    pizzaHandler := WithFakeAuthInfo(conf, PizzaHandler(conf, cache))
	mr := mux.NewRouter()
	mr.HandleFunc("/api/pizzas", pizzaHandler)

	ts := httptest.NewServer(mr)
	url := ts.URL + "/api/pizzas"

	resp, err := http.Get(url)
	require.NoError(err)

	actual, _ := io.ReadAll(resp.Body)

	require.NotEmpty(actual)
	assert.Equal(200, resp.StatusCode, string(actual))
}
```