/*
Package slicetest provides utilities for testing slices.
*/
package slicetest

import (
	"slices"
	"testing"
)

// FindOrFail will find an element in a slice or fail the test.
func FindOrFail[T any](t *testing.T, s []T, f func(T) bool) T {
	t.Helper()
	idx := slices.IndexFunc(s, f)
	if idx == -1 {
		t.Fatal("Element not in slice")
	}
	return s[idx]
}
