package routing

import (
	"testing"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/config"
)

func TestDrawPathProperly(t *testing.T) {
	conf := new(config.Config)
	config.Set(conf)
	router := NewRouter()
	testRoute(router, "Root", "GET", t)
}

func testRoute(router *mux.Router, name string, method string, t *testing.T) {
	var path = router.Get(name)

	if path == nil {
		t.Error("path is not registered into router")
	}

	var methods, err = path.GetMethods()
	if err != nil {
		t.Error(err)
	}

	if len(methods) != 1 && methods[0] != method {
		t.Error("Root path is not registered with method")
	}
}
