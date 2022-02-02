package httputil

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestGetFreePort(t *testing.T) {
	assert := assert.New(t)

	testPool := newPool(14100, 100)

	port := testPool.GetFreePort()
	assert.Equal(14100, port)

	port = testPool.GetFreePort()
	assert.Equal(14101, port)

	port = testPool.GetFreePort()
	assert.Equal(14102, port)
}

func TestGetFreePort_NoPortsAvailable(t *testing.T) {
	assert := assert.New(t)

	testPool := newPool(14100, 100)

	for i := 0; i < 100; i++ {
		port := testPool.GetFreePort()
		assert.Equal(14100+i, port)
	}

	port := testPool.GetFreePort()
	assert.Equal(0, port)

	port = testPool.GetFreePort()
	assert.Equal(0, port)
}

func TestFreePort(t *testing.T) {
	assert := assert.New(t)

	testPool := newPool(14100, 100)

	for i := 0; i < testPool.PortRangeSize; i++ {
		port := testPool.GetFreePort()
		assert.Equal(testPool.PortRangeInit+i, port)
	}

	// No free port available (out of range)
	port := testPool.GetFreePort()
	assert.Equal(0, port)

	// Once you free one port, this is
	testPool.FreePort(14104)
	port = testPool.GetFreePort()
	assert.Equal(14104, port)

	port = testPool.GetFreePort()
	assert.Equal(0, port)

	testPool.FreePort(14104)
	port = testPool.GetFreePort()
	assert.Equal(14104, port)

	testPool.FreePort(14199)
	port = testPool.GetFreePort()
	assert.Equal(14199, port)

	testPool.FreePort(14100)
	port = testPool.GetFreePort()
	assert.Equal(14100, port)
}

type FakeMutex struct {
	mock.Mock
}

func (m *FakeMutex) Lock() {
	m.Called()
}

func (m *FakeMutex) Unlock() {
	m.Called()
}

func TestFreePort_OutOfRange(t *testing.T) {
	fakeMutex := &FakeMutex{}
	testPool := PortPool{
		LastBusyPort:  14100 - 1,
		Mutex:         fakeMutex,
		PortsMap:      map[int]bool{},
		PortRangeInit: 14100,
		PortRangeSize: 100,
	}

	testPool.FreePort(8080)

	fakeMutex.AssertNotCalled(t, "Lock")
	fakeMutex.AssertNotCalled(t, "Unlock")

	fakeMutex.On("Lock").Return().Once()
	fakeMutex.On("Unlock").Return().Once()

	testPool.FreePort(14101)

	fakeMutex.AssertCalled(t, "Lock")
	fakeMutex.AssertCalled(t, "Unlock")
}

func newPool(rangeInit, rangeSize int) PortPool {
	return PortPool{
		LastBusyPort:  rangeInit - 1,
		Mutex:         &sync.Mutex{},
		PortsMap:      map[int]bool{},
		PortRangeInit: rangeInit,
		PortRangeSize: rangeSize,
	}
}
