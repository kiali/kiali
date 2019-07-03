package cytoscape

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRateStrings(t *testing.T) {
	assert := assert.New(t)

	assert.Equal(1, calcPrecision(0.1, 5))
	assert.Equal(1, calcPrecision(0.4, 5))
	assert.Equal(0, calcPrecision(0.5, 5))
	assert.Equal(0, calcPrecision(0.9, 5))
	assert.Equal(2, calcPrecision(0.01, 5))
	assert.Equal(2, calcPrecision(0.04, 5))
	assert.Equal(1, calcPrecision(0.05, 5))
	assert.Equal(1, calcPrecision(0.09, 5))
	assert.Equal(3, calcPrecision(0.001, 5))
	assert.Equal(3, calcPrecision(0.004, 5))
	assert.Equal(2, calcPrecision(0.005, 5))
	assert.Equal(2, calcPrecision(0.009, 5))
	assert.Equal(4, calcPrecision(0.0001, 5))
	assert.Equal(4, calcPrecision(0.0004, 5))
	assert.Equal(3, calcPrecision(0.0005, 5))
	assert.Equal(3, calcPrecision(0.0009, 5))
	assert.Equal(0, calcPrecision(0.99, 5))
	assert.Equal(0, calcPrecision(0.999, 5))
	assert.Equal(5, calcPrecision(0.00000000001, 5)) // max precision 5

	assert.Equal("1.00", rateToString(2, 1))
	assert.Equal("1.0", rateToString(1, 1))

	assert.Equal("10.00", rateToString(2, 10))
	assert.Equal("10.0", rateToString(1, 10))

	assert.Equal("0.90", rateToString(2, 0.9))
	assert.Equal("0.9", rateToString(1, 0.9))

	assert.Equal("0.99", rateToString(2, 0.99))
	assert.Equal("1.0", rateToString(1, 0.99))

	assert.Equal("0.91", rateToString(2, 0.91))
	assert.Equal("0.9", rateToString(1, 0.91))

	assert.Equal("0.09", rateToString(2, 0.09))
	assert.Equal("0.1", rateToString(1, 0.09))

	assert.Equal("0.01", rateToString(2, 0.01))
	assert.Equal("0.01", rateToString(1, 0.01))

	assert.Equal("0.05", rateToString(2, 0.05))
	assert.Equal("0.1", rateToString(1, 0.05))

	assert.Equal("0.01", rateToString(2, 0.009))
	assert.Equal("0.01", rateToString(1, 0.009))

	assert.Equal("0.001", rateToString(3, 0.001))
	assert.Equal("0.001", rateToString(2, 0.001))
	assert.Equal("0.001", rateToString(1, 0.001))

	assert.Equal("0.0004", rateToString(3, 0.0004))
	assert.Equal("0.0004", rateToString(2, 0.0004))
	assert.Equal("0.0004", rateToString(1, 0.0004))

	assert.Equal("0.001", rateToString(3, 0.0005))
	assert.Equal("0.001", rateToString(2, 0.0005))
	assert.Equal("0.001", rateToString(1, 0.0005))

	assert.Equal("0.001", rateToString(3, 0.0009))
	assert.Equal("0.001", rateToString(2, 0.0009))
	assert.Equal("0.001", rateToString(1, 0.0009))

	assert.Equal("10.009", rateToString(3, 10.009))
	assert.Equal("10.01", rateToString(2, 10.009))
	assert.Equal("10.0", rateToString(1, 10.009))

	assert.Equal("10.001", rateToString(3, 10.001))
	assert.Equal("10.00", rateToString(2, 10.001))
	assert.Equal("10.0", rateToString(1, 10.001))
}
