package store

import (
	"sync"

	"golang.org/x/exp/maps"
)

// threadSafeStore implements the Store interface and is safe for concurrent use.
type threadSafeStore[T any] struct {
	lock sync.RWMutex
	data map[string]T
}

// Get returns the value associated with the given key or an error.
func (s *threadSafeStore[T]) Get(key string) (T, bool) {
	s.lock.RLock()
	defer s.lock.RUnlock()
	var (
		v     T
		found bool
	)
	v, found = s.data[key]
	return v, found
}

// Replace replaces the contents of the store with the given map.
func (s *threadSafeStore[T]) Replace(items map[string]T) {
	s.lock.Lock()
	defer s.lock.Unlock()
	// In case this gets re-used, we don't want items to be nil for other methods.
	if items == nil {
		items = make(map[string]T)
	}
	s.data = items
}

// Set associates the given value with the given key. It will overwrite any existing value
// or create a new entry if the key does not exist.
func (s *threadSafeStore[T]) Set(key string, value T) {
	s.lock.Lock()
	defer s.lock.Unlock()
	s.data[key] = value
}

func (s *threadSafeStore[T]) Remove(key string) {
	s.lock.Lock()
	defer s.lock.Unlock()
	delete(s.data, key)
}

// Keys returns all the keys in the store.
func (s *threadSafeStore[T]) Keys() []string {
	s.lock.RLock()
	defer s.lock.RUnlock()
	return maps.Keys(s.data)
}

// Interface guard to ensure threadSafeStore implements the Store.
var _ Store[any] = &threadSafeStore[any]{}
