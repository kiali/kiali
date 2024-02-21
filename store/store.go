package store

import (
	"fmt"
)

// NotFoundError is returned when a key is not found in the store.
type NotFoundError struct {
	Key string
}

func (e *NotFoundError) Error() string {
	return fmt.Sprintf("key \"%s\" not found in store", e.Key)
}

// Store is a generic key value store. Implementations should be safe for concurrent use.
// It is basically just a map with a lock. Does not yet implement Set so we don't have to
// worry about this thing growing without bound.
type Store[T any] interface {
	// Get returns the value associated with the given key or an error.
	Get(key string) (T, error)
	// Replace replaces the contents of the store with the given map.
	Replace(map[string]T)
	// Set associates the given value with the given key. It will overwrite any existing value
	// or create a new entry if the key does not exist.
	Set(key string, value T)
}

// New returns a new store safe for concurrent use.
func New[T any]() Store[T] {
	return &threadSafeStore[T]{data: make(map[string]T)}
}

// Interface guard to ensure NotFoundError implements the error interface.
var _ error = &NotFoundError{}
