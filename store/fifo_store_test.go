package store

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/util"
)

func TestSetAndGet(t *testing.T) {
	require := require.New(t)

	fifoStore := NewFIFOStore[string, string](context.Background(), 3, nil, nil)
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

func TestExpired(t *testing.T) {
	require := require.New(t)

	fifoStore := NewFIFOStore[string, string](context.Background(), 3, util.AsPtr(10*time.Second), util.AsPtr(10*time.Second))
	fifoStore.Set("foo", "bar")
	fifoStore.Set("foo2", "bar2")
	fifoStore.Set("foo3", "bar3")

	require.Equal(fifoStore.stats.hits, 0)
	require.Equal(len(fifoStore.items), 3)

	time.Sleep(5 * time.Second)
	elem, found := fifoStore.Get("foo")
	require.True(found)
	require.Equal(elem, "bar")

	time.Sleep(15 * time.Second)

	_, found1 := fifoStore.Get("foo")
	require.False(found1)
	_, found2 := fifoStore.Get("foo2")
	require.False(found2)
	_, found3 := fifoStore.Get("foo3")
	require.False(found3)

}

func TestExpiredNoCleanup(t *testing.T) {
	require := require.New(t)

	fifoStore := NewFIFOStore[string, string](context.Background(), 3, util.AsPtr(10*time.Minute), util.AsPtr(10*time.Second))
	fifoStore.Set("foo", "bar")
	fifoStore.Set("foo2", "bar2")
	fifoStore.Set("foo3", "bar3")

	require.Equal(fifoStore.stats.hits, 0)
	require.Equal(len(fifoStore.items), 3)

	time.Sleep(5 * time.Second)
	elem, found := fifoStore.Get("foo")
	require.True(found)
	require.Equal(elem, "bar")

	time.Sleep(15 * time.Second)

	_, found1 := fifoStore.Get("foo")
	require.False(found1)
	_, found2 := fifoStore.Get("foo2")
	require.False(found2)
	_, found3 := fifoStore.Get("foo3")
	require.False(found3)

}
