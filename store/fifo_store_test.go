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

	s := New[string, string]()
	fifoStore := NewFIFOStore[string, string](s, 3, "test")
	fifoStore.Set("foo", "bar")
	fifoStore.Set("foo2", "bar2")
	fifoStore.Set("foo3", "bar3")

	require.Equal(fifoStore.order.Len(), 3)

	elem, found := fifoStore.Get("foo")
	require.True(found)
	require.Equal(elem, "bar")

	elem, found = fifoStore.Get("foo2")
	require.True(found)
	require.Equal(elem, "bar2")

	fifoStore.Set("foo4", "bar4")
	_, found = fifoStore.Get("foo")
	require.Equal(fifoStore.order.Len(), 3)
	require.False(found)
}

func TestExpired(t *testing.T) {
	require := require.New(t)

	store := New[string, string]()
	fifoStore := NewFIFOStore[string, string](store, 3, "test")
	expirationStore := NewExpirationStore[string, string](context.Background(), fifoStore, util.AsPtr(10*time.Second), util.AsPtr(10*time.Second))
	expirationStore.Set("foo", "bar")
	expirationStore.Set("foo2", "bar2")
	expirationStore.Set("foo3", "bar3")

	require.Equal(len(expirationStore.Store.Items()), 3)

	time.Sleep(5 * time.Second)
	elem, found := expirationStore.Get("foo")
	require.True(found)
	require.Equal(elem, "bar")

	time.Sleep(15 * time.Second)

	_, found1 := expirationStore.Get("foo")
	require.False(found1)
	_, found2 := expirationStore.Get("foo2")
	require.False(found2)
	_, found3 := expirationStore.Get("foo3")
	require.False(found3)

}

func TestExpiredNoCleanup(t *testing.T) {
	require := require.New(t)

	store := New[string, string]()
	fifoStore := NewFIFOStore[string, string](store, 3, "test")
	expirationStore := NewExpirationStore[string, string](context.Background(), fifoStore, util.AsPtr(10*time.Second), util.AsPtr(10*time.Second))
	expirationStore.Set("foo", "bar")
	expirationStore.Set("foo2", "bar2")
	expirationStore.Set("foo3", "bar3")

	//require.Equal(expirationStore.stats.Hits, 0)
	require.Equal(len(expirationStore.Store.Items()), 3)

	time.Sleep(5 * time.Second)
	elem, found := expirationStore.Get("foo")
	require.True(found)
	require.Equal(elem, "bar")

	time.Sleep(15 * time.Second)

	_, found1 := expirationStore.Get("foo")
	require.False(found1)
	_, found2 := expirationStore.Get("foo2")
	require.False(found2)
	_, found3 := expirationStore.Get("foo3")
	require.False(found3)

}
