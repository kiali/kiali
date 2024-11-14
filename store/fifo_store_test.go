package store

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSetAndGet(t *testing.T) {
	require := require.New(t)

	fifoStore := NewFIFOStore[string, string](3)
	fifoStore.Set("foo", "bar")
	fifoStore.Set("foo2", "bar2")
	fifoStore.Set("foo3", "bar3")

	require.Equal(fifoStore.stats.hits, 0)
	require.Equal(len(fifoStore.items), 3)

	elem, found := fifoStore.Get("foo")
	require.Equal(fifoStore.stats.hits, 1)
	require.True(found)
	require.Equal(elem, "bar")

	elem, found = fifoStore.Get("foo2")
	require.Equal(fifoStore.stats.hits, 2)
	require.True(found)
	require.Equal(elem, "bar2")

	fifoStore.Set("foo4", "bar4")
	_, found = fifoStore.Get("foo")
	require.Equal(fifoStore.stats.hits, 2)
	require.Equal(len(fifoStore.items), 3)
	require.False(found)
}
