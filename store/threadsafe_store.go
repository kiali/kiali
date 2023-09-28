package store

import (
	"sync"
)

// threadSafeStore implements the Store interface and is safe for concurrent use.
type threadSafeStore[K comparable, V any] struct {
	lock    sync.RWMutex
	data    map[K]V
	version uint
}

// Get returns the value associated with the given key or an error.
func (s *threadSafeStore[K, V]) Get(key K) (V, error) {
	s.lock.RLock()
	defer s.lock.RUnlock()
	var (
		v     V
		found bool
	)
	v, found = s.data[key]
	if !found {
		return v, &NotFoundError{Key: key}
	}
	return v, nil
}

func (s *threadSafeStore[K, V]) Items() map[K]V {
	s.lock.RLock()
	defer s.lock.RUnlock()
	return s.data
}

// Replace replaces the contents of the store with the given map.
func (s *threadSafeStore[K, V]) Replace(items map[K]V) {
	s.lock.Lock()
	defer s.lock.Unlock()
	s.data = items
	s.version++
}

func (s *threadSafeStore[K, V]) Set(key K, value V) {
	s.lock.Lock()
	defer s.lock.Unlock()
	s.data[key] = value
	s.version++
}

func (s *threadSafeStore[K, V]) Version() uint {
	return s.version
}

// Interface guard to ensure threadSafeStore implements the Store.
var _ Store[string, any] = &threadSafeStore[string, any]{}
