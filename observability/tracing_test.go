package observability_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/observability"
)

func TestInitTracer(t *testing.T) {
	assert := assert.New(t)
	cfg := config.Get()
	cfg.Server.Observability.Tracing.CollectorType = config.OTELCollectorType
	config.Set(cfg)

	defer func() {
		err := recover()
		assert.Nil(err)
	}()
	tp := observability.InitTracer("otelURL")
	assert.NotNil(tp)
}

func TestStop(t *testing.T) {
	cfg := config.Get()
	cfg.Server.Observability.Tracing.CollectorType = config.OTELCollectorType
	config.Set(cfg)

	tp := observability.InitTracer("otelURL")
	observability.StopTracer(tp)
}

func TestStopWithNil(t *testing.T) {
	assert := assert.New(t)
	cfg := config.Get()
	cfg.Server.Observability.Tracing.CollectorType = config.OTELCollectorType
	config.Set(cfg)

	defer func() {
		err := recover()
		assert.Nil(err)
	}()
	observability.StopTracer(nil)
}

type stringerImpl struct{}

func (i stringerImpl) String() string { return "" }

type nonStringer struct{}

func TestAttribute(t *testing.T) {
	cases := map[string]struct {
		input interface{}
		valid bool
	}{
		"int":          {input: 10, valid: true},
		"int64":        {input: int64(10), valid: true},
		"float64":      {input: float64(10), valid: true},
		"string":       {input: "val", valid: true},
		"bool":         {input: false, valid: true},
		"string_slice": {input: []string{"yes"}, valid: true},
		"int_slice":    {input: []int{10}, valid: true},
		"int64_slice":  {input: []int64{10}, valid: true},
		"bool_slice":   {input: []bool{true}, valid: true},
		"stringer":     {input: stringerImpl{}, valid: true},
		"no match":     {input: nonStringer{}, valid: false},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)
			kv := observability.Attribute("Key", tc.input)
			assert.Equal(tc.valid, kv.Valid())
		})
	}
}

func TestStartSpan(t *testing.T) {
	assert := assert.New(t)
	cfg := config.Get()
	cfg.Server.Observability.Tracing.Enabled = true
	cfg.Server.Observability.Tracing.CollectorType = config.OTELCollectorType
	config.Set(cfg)

	ctx := context.Background()
	newCTX, end := observability.StartSpan(ctx, "TestFunc", observability.Attribute("MyKey", "Val"))
	t.Cleanup(end)
	// Testing here that the two contexts are indeed different.
	assert.NotEqual(ctx, newCTX)

	cfg = config.Get()
	cfg.Server.Observability.Tracing.Enabled = false
	config.Set(cfg)

	ctx = context.Background()
	newCTX, end = observability.StartSpan(ctx, "TestFunc", observability.Attribute("MyKey", "Val"))
	t.Cleanup(end)
	// Testing here that the two contexts are the same i.e. the original context remains unchanged.
	assert.Equal(ctx, newCTX)
}
