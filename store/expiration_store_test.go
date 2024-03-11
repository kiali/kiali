package store_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/store"
)

func testingContext(t *testing.T) context.Context {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	return ctx
}

func TestSetAndGet(t *testing.T) {
	require := require.New(t)
	ctx := testingContext(t)

	store := store.NewExpirationStore(ctx, store.New[string](), nil, nil)

	key := "testKey"
	value := "testValue"
	store.Set(key, value)
	_, found := store.Get(key)
	require.True(found)
}

func TestKeyExpiration(t *testing.T) {
	require := require.New(t)
	ctx := testingContext(t)

	ms := 1 * time.Millisecond
	store := store.NewExpirationStore(ctx, store.New[string](), &ms, &ms)

	key := "testKey"
	value := "testValue"
	store.Set(key, value)
	time.Sleep(time.Millisecond * 30)
	_, found := store.Get(key)
	require.False(found)
}

func TestRemoveKey(t *testing.T) {
	require := require.New(t)
	ctx := testingContext(t)

	store := store.NewExpirationStore(ctx, store.New[string](), nil, nil)

	key := "testKey"
	value := "testValue"
	store.Set(key, value)
	store.Remove(key)
	_, found := store.Get(key)
	require.False(found)
}

func TestReplace(t *testing.T) {
	require := require.New(t)
	ctx := testingContext(t)

	store := store.NewExpirationStore(ctx, store.New[string](), nil, nil)

	initialData := map[string]string{"key1": "value1"}
	newData := map[string]string{"key2": "value2"}

	store.Replace(initialData)
	store.Replace(newData)

	_, found := store.Get("key1")
	require.False(found)

	val, found := store.Get("key2")
	require.True(found)
	require.Equal("value2", val)
}

func TestStoppedReceivesWhenContextCancelled(t *testing.T) {
	require := require.New(t)
	ctx, cancel := context.WithCancel(context.Background())

	store := store.NewExpirationStore(ctx, store.New[string](), nil, nil)

	cancel()
	select {
	case <-store.Stopped:
	case <-time.After(time.Second):
		require.Fail("Expected store to send a stop message on Stopped when context cancelled but received none")
	}
}
