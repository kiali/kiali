package store_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/store"
)

func TestGetKeyExists(t *testing.T) {
	require := require.New(t)

	testStore := store.New[string, int]()
	testStore.Replace(map[string]int{"key1": 42})
	value, found := testStore.Get("key1")

	require.True(found)
	require.Equal(42, value)
}

func TestGetNonExistantKeyFails(t *testing.T) {
	require := require.New(t)

	testStore := store.New[string, int]()
	_, found := testStore.Get("nonexistent")
	require.False(found)
}

func TestReplaceStoreContents(t *testing.T) {
	require := require.New(t)

	testStore := store.New[string, int]()
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

	testStore := store.New[string, int]()
	testStore.Replace(map[string]int{"": 1})

	val, found := testStore.Get("")
	require.True(found)
	require.Equal(1, val)
}

func TestSetNewKey(t *testing.T) {
	require := require.New(t)

	testStore := store.New[string, int]()
	_, found := testStore.Get("key1")
	require.False(found)

	currentVersion := testStore.Version()

	testStore.Set("key1", 42)
	val, found := testStore.Get("key1")
	require.True(found)
	require.Equal(42, val)
	require.Equal(currentVersion+1, testStore.Version())
}

func TestSetExistingKey(t *testing.T) {
	require := require.New(t)

	testStore := store.New[string, int]()
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

	testStore := store.New[string, int]()

	testStore.Set("key1", 42)
	testStore.Set("key2", 43)

	keys := testStore.Keys()
	require.Len(keys, 2)
	require.Contains(keys, "key1")
	require.Contains(keys, "key2")
}

func TestRemove(t *testing.T) {
	require := require.New(t)

	testStore := store.New[string, int]()

	testStore.Set("key1", 42)
	testStore.Remove("key1")
	v, found := testStore.Get("key1")
	require.False(found)
	require.Zero(v)
}

func TestReplaceIncrementsVersion(t *testing.T) {
	require := require.New(t)

	testStore := store.New[string, int]()
	require.Equal(uint(0), testStore.Version())
	testStore.Replace(map[string]int{"": 1})

	require.Equal(uint(1), testStore.Version())
}

func TestItemsReturnsWholeMap(t *testing.T) {
	require := require.New(t)

	testStore := store.New[string, int]()
	testStore.Replace(map[string]int{"key1": 42, "key2": 99})

	contents := testStore.Items()
	require.Len(contents, 2)
	require.Equal(42, contents["key1"])
	require.Equal(99, contents["key2"])
}

func TestDeleteKey(t *testing.T) {
	require := require.New(t)

	testStore := store.New[string, int]()
	testStore.Replace(map[string]int{"key1": 42, "key2": 99})
	require.Equal(uint(1), testStore.Version())

	testStore.Remove("key1")
	_, found := testStore.Get("key1")
	require.False(found)
	require.Equal(uint(2), testStore.Version())

	testStore.Remove("nonexistent")
}
