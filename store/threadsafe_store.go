package store

import (
	"sync"
)

// threadSafeStore implements the Store interface and is safe for concurrent use.
type threadSafeStore[T any] struct {
	lock sync.RWMutex
	data map[string]T
}

// Get returns the value associated with the given key or an error.
func (s *threadSafeStore[T]) Get(key string) (T, error) {
	s.lock.RLock()
	defer s.lock.RUnlock()
	var (
		v     T
		found bool
	)
	v, found = s.data[key]
	if !found {
		return v, &NotFoundError{key}
	}
	return v, nil
}

// Replace replaces the contents of the store with the given map.
func (s *threadSafeStore[T]) Replace(items map[string]T) {
	s.lock.Lock()
	defer s.lock.Unlock()
	s.data = items
}

// Interface guard to ensure threadSafeStore implements the Store.
var _ Store[any] = &threadSafeStore[any]{}
