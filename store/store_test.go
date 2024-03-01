package store_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/store"
)

func TestGetKeyExists(t *testing.T) {
	require := require.New(t)

	testStore := store.New[int]()
	testStore.Replace(map[string]int{"key1": 42})
	value, found := testStore.Get("key1")

	require.True(found)
	require.Equal(42, value)
}

func TestGetNonExistantKeyFails(t *testing.T) {
	require := require.New(t)

	testStore := store.New[int]()
	_, found := testStore.Get("nonexistent")
	require.False(found)
}

func TestReplaceStoreContents(t *testing.T) {
	require := require.New(t)

	testStore := store.New[int]()
	testStore.Replace(map[string]int{"key1": 42})

	newData := map[string]int{"key2": 99, "key3": 100}
	testStore.Replace(newData)

	_, found := testStore.Get("key1")
	require.False(found)

	value, found := testStore.Get("key2")
	require.True(found)
	require.Equal(99, value)

	value, found = testStore.Get("key3")
	require.True(found)
	require.Equal(100, value)
}

func TestReplaceWithEmptyKey(t *testing.T) {
	require := require.New(t)

	testStore := store.New[int]()
	testStore.Replace(map[string]int{"": 1})

	val, found := testStore.Get("")
	require.True(found)
	require.Equal(1, val)
}

func TestSetNewKey(t *testing.T) {
	require := require.New(t)

	testStore := store.New[int]()
	_, found := testStore.Get("key1")
	require.False(found)

	testStore.Set("key1", 42)
	val, found := testStore.Get("key1")
	require.True(found)
	require.Equal(42, val)
}

func TestSetExistingKey(t *testing.T) {
	require := require.New(t)

	testStore := store.New[int]()
	_, found := testStore.Get("key1")
	require.False(found)

	testStore.Set("key1", 42)
	_, found = testStore.Get("key1")
	require.True(found)

	testStore.Set("key1", 43)
	val, found := testStore.Get("key1")
	require.True(found)
	require.Equal(43, val)
}

func TestKeys(t *testing.T) {
	require := require.New(t)

	testStore := store.New[int]()

	testStore.Set("key1", 42)
	testStore.Set("key2", 43)

	keys := testStore.Keys()
	require.Len(keys, 2)
	require.Contains(keys, "key1")
	require.Contains(keys, "key2")
}

func TestRemove(t *testing.T) {
	require := require.New(t)

	testStore := store.New[int]()

	testStore.Set("key1", 42)
	testStore.Remove("key1")
	v, found := testStore.Get("key1")
	require.False(found)
	require.Zero(v)
}
