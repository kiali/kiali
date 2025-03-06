package store

import (
	"maps"
	"slices"
	"sync"
)

// threadSafeStore implements the Store interface and is safe for concurrent use.
type threadSafeStore[K comparable, V any] struct {
	lock    sync.RWMutex
	data    map[K]V
	version uint
}

// Get returns the value associated with the given key or an error.
func (s *threadSafeStore[K, V]) Get(key K) (V, bool) {
	s.lock.RLock()
	defer s.lock.RUnlock()
	var (
		v     V
		found bool
	)
	v, found = s.data[key]
	return v, found
}

// Items returns a copy of all items in the store.
func (s *threadSafeStore[K, V]) Items() map[K]V {
	s.lock.RLock()
	defer s.lock.RUnlock()
	return maps.Clone(s.data)
}

// Replace replaces the contents of the store with the given map.
func (s *threadSafeStore[K, V]) Replace(items map[K]V) {
	s.lock.Lock()
	defer s.lock.Unlock()
	// In case this gets re-used, we don't want items to be nil for other methods.
	if items == nil {
		items = make(map[K]V)
	}
	s.data = items
	s.version++
}

// Set associates the given value with the given key. It will overwrite any existing value
// or create a new entry if the key does not exist.
func (s *threadSafeStore[K, V]) Set(key K, value V) {
	s.lock.Lock()
	defer s.lock.Unlock()
	s.data[key] = value
	s.version++
}

func (s *threadSafeStore[K, V]) Remove(key K) {
	s.lock.Lock()
	defer s.lock.Unlock()
	delete(s.data, key)
	s.version++
}

// Keys returns all the keys in the store.
func (s *threadSafeStore[K, V]) Keys() []K {
	s.lock.RLock()
	defer s.lock.RUnlock()
	return slices.Collect(maps.Keys(s.data))
}

func (s *threadSafeStore[K, V]) Version() uint {
	s.lock.RLock()
	defer s.lock.RUnlock()
	return s.version
}

// Interface guard to ensure threadSafeStore implements the Store.
var _ Store[string, any] = &threadSafeStore[string, any]{}
