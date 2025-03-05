package store

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestSetAndGet(t *testing.T) {
	require := require.New(t)

	s := New[string, string]()
	fifoStore := NewFIFOStore(s, 3, "test")
	fifoStore.Set("foo", "bar")
	fifoStore.Set("foo2", "bar2")
	fifoStore.Set("foo3", "bar3")

	require.Equal(3, fifoStore.order.Len())

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

func TestUpdate(t *testing.T) {
	require := require.New(t)

	s := New[string, string]()
	fifoStore := NewFIFOStore(s, 3, "test")
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

	fifoStore.Set("foo2", "newValue")
	elem, found = fifoStore.Get("foo2")
	require.Equal(fifoStore.order.Len(), 3)
	require.True(found)
	require.Equal(elem, "newValue")

	fifoStore.Set("foo4", "bar4")
	elem, found = fifoStore.Get("foo2")
	require.Equal(fifoStore.order.Len(), 3)
	require.True(found)
	require.Equal(elem, "newValue")
	_, found = fifoStore.Get("foo")
	require.False(found)
}

func TestExpired(t *testing.T) {
	require := require.New(t)
	ms := 1 * time.Millisecond

	store := New[string, string]()
	fifoStore := NewFIFOStore(store, 3, "test")
	expirationStore := NewExpirationStore(context.Background(), fifoStore, &ms, &ms)
	expirationStore.Set("foo", "bar")
	expirationStore.Set("foo2", "bar2")
	expirationStore.Set("foo3", "bar3")

	require.Equal(len(expirationStore.Store.Items()), 3)

	time.Sleep(30 * time.Millisecond)

	_, found1 := expirationStore.Get("foo")
	require.False(found1)
	_, found2 := expirationStore.Get("foo2")
	require.False(found2)
	_, found3 := expirationStore.Get("foo3")
	require.False(found3)
}

func TestReplace(t *testing.T) {
	require := require.New(t)

	s := New[string, string]()
	fifoStore := NewFIFOStore(s, 3, "test")
	fifoStore.Set("foo", "bar")
	fifoStore.Set("foo2", "bar2")
	fifoStore.Set("foo3", "bar3")

	require.Equal(fifoStore.order.Len(), 3)
	elem, found := fifoStore.Get("foo")

	require.True(found)
	require.Equal(elem, "bar")

	replaced := map[string]string{"newKey": "newValue", "newKey2": "newValue2", "newKey3": "newValue3"}
	fifoStore.Replace(replaced)
	require.Equal(fifoStore.order.Len(), 3)
	_, found = fifoStore.Get("foo")

	require.False(found)
	elem, found = fifoStore.Get("newKey")

	require.True(found)
	require.Equal(elem, "newValue")

	replaced2 := map[string]string{}
	replaced2["replacedKey"] = "replacedValue"
	replaced2["replacedKey2"] = "replacedValue2"
	replaced2["replacedKey3"] = "replacedValue3"
	replaced2["newKey"] = "newValue"
	fifoStore.Replace(replaced2)
	require.Equal(fifoStore.order.Len(), 3)
}
