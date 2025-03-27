package sliceutil_test

import (
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/util/sliceutil"
)

func TestFilter(t *testing.T) {
	filterEven := func(i int) bool {
		return i%2 == 0
	}
	testCases := map[string]struct {
		slice    []int
		filter   func(int) bool
		expected []int
	}{
		"filters even numbers": {
			slice:    []int{1, 2, 3, 4, 5},
			filter:   filterEven,
			expected: []int{2, 4},
		},
		"empty slice returns empty slice": {
			slice:    []int{},
			filter:   filterEven,
			expected: []int{},
		},
		"nil slice returns nil": {
			slice:    nil,
			filter:   filterEven,
			expected: nil,
		},
	}
	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)
			assert.Equal(tc.expected, sliceutil.Filter(tc.slice, tc.filter))
		})
	}
}

func TestMap(t *testing.T) {
	testCases := map[string]struct {
		slice    []int
		mapFunc  func(int) string
		expected []string
	}{
		"converts slice of ints to strings": {
			slice:    []int{1, 2, 3, 4, 5},
			mapFunc:  strconv.Itoa,
			expected: []string{"1", "2", "3", "4", "5"},
		},
		"empty slice returns empty slice": {
			slice:    []int{},
			mapFunc:  strconv.Itoa,
			expected: []string{},
		},
		"nil slice returns nil": {
			slice:    nil,
			mapFunc:  strconv.Itoa,
			expected: nil,
		},
	}
	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)
			assert.Equal(tc.expected, sliceutil.Map(tc.slice, tc.mapFunc))
		})
	}
}

func TestSomeString(t *testing.T) {
	testCases := map[string]struct {
		slice          []string
		value          string
		someStringFunc func(int) string
		expected       bool
	}{
		"array contains value, returns true": {
			slice:    []string{"bookinfo", "bookinfo2", "default"},
			value:    "bookinfo",
			expected: true,
		},
		"array does not contain value, returns false": {
			slice:    []string{"bookinfo", "bookinfo2", "default"},
			value:    "bookinfo3",
			expected: false,
		},
		"empty array, returns false": {
			slice:    []string{},
			value:    "",
			expected: false,
		},
	}
	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)
			assert.Equal(tc.expected, sliceutil.SomeString(tc.slice, tc.value))
		})
	}
}
