package log

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

var funcUsed string

func errorf(msg string, args ...interface{}) {
	funcUsed = "error"
}

func warnf(msg string, args ...interface{}) {
	funcUsed = "warn"
}

func infof(msg string, args ...interface{}) {
	funcUsed = "info"
}

func tracef(msg string, args ...interface{}) {
	funcUsed = "trace"
}

func assertAndReset(t *testing.T, expected string) {
	assert.Equal(t, expected, funcUsed)
	funcUsed = ""
}

func TestNoLogger(t *testing.T) {
	logger := NewSafeAdapter(LogAdapter{})

	logger.Errorf("test")
	assertAndReset(t, "")
	logger.Warningf("test")
	assertAndReset(t, "")
	logger.Infof("test")
	assertAndReset(t, "")
	logger.Tracef("test")
	assertAndReset(t, "")
}

func TestFullLogger(t *testing.T) {
	logger := NewSafeAdapter(LogAdapter{
		Errorf:   errorf,
		Warningf: warnf,
		Infof:    infof,
		Tracef:   tracef,
	})

	logger.Errorf("test")
	assertAndReset(t, "error")
	logger.Warningf("test")
	assertAndReset(t, "warn")
	logger.Infof("test")
	assertAndReset(t, "info")
	logger.Tracef("test")
	assertAndReset(t, "trace")
}

func TestPartialLogger(t *testing.T) {
	logger := NewSafeAdapter(LogAdapter{
		Errorf: errorf,
		Infof:  infof,
	})

	logger.Errorf("test")
	assertAndReset(t, "error")
	logger.Warningf("test")
	assertAndReset(t, "info")
	logger.Infof("test")
	assertAndReset(t, "info")
	logger.Tracef("test")
	assertAndReset(t, "")
}
