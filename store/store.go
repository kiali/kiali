package store

import (
	"fmt"
)

// NotFoundError is returned when a key is not found in the store.
type NotFoundError struct {
	Key any
}

func (e *NotFoundError) Error() string {
	return fmt.Sprintf("key \"%#v\" not found in store", e.Key)
}

// Store is a generic key value store. Implementations should be safe for concurrent use.
// It is basically just a map with a lock.
type Store[K comparable, V any] interface {
	// Get returns the value associated with the given key or an error.
	Get(key K) (V, error)
	// Set associates the given value with the given key. It will overwrite any existing value
	// or create a new entry if the key does not exist.
	Set(key K, value V)
	// Items returns a copy of the store's contents.
	Items() map[K]V
	// Replace replaces the contents of the store with the given map.
	Replace(map[K]V)
	// Version returns the current version of the store. The version is incremented every time the store is modified.
	// It can be used to detect changes to the store.
	Version() uint
	// Delete removes the key from the store. noop if the key doesn't exist.
	Delete(key K)
}

// New returns a new store safe for concurrent use.
func New[K comparable, V any]() Store[K, V] {
	return &threadSafeStore[K, V]{data: make(map[K]V)}
}

// Interface guard to ensure NotFoundError implements the error interface.
var _ error = &NotFoundError{}
