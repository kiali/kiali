package store

import (
	"container/list"
	"github.com/kiali/kiali/log"
	"sync"
)

type storeStats struct {
	hits          int
	totalRequests int
	size          int
}

// FifoStore uses a FIFO approach storage and is safe for concurrent use.
type FifoStore[K comparable, V any] struct {
	capacity int
	items    map[K]*list.Element
	lock     sync.RWMutex
	order    *list.List
	stats    storeStats
}

type entry[K comparable, V any] struct {
	key   K
	value V
}

func NewFIFOStore[K comparable, V any](capacity int) *FifoStore[K, V] {
	return &FifoStore[K, V]{
		items:    make(map[K]*list.Element),
		order:    list.New(),
		capacity: capacity,
		stats: storeStats{
			hits:          0,
			totalRequests: 0,
		},
	}
}

// Get returns the value associated with the given key or an error.
func (f *FifoStore[K, V]) Get(key K) (V, bool) {
	f.lock.RLock()
	defer f.lock.RUnlock()
	f.stats.totalRequests++
	elem, exists := f.items[key]
	if !exists {
		var value V
		return value, false
	}
	log.Tracef("[FIFO store] Returning from cache: %v", key)
	f.stats.hits++
	return elem.Value.(*entry[K, V]).value, true
}

// Set
func (f *FifoStore[K, V]) Set(key K, value V) {
	f.lock.Lock()
	defer f.lock.Unlock()
	if _, exists := f.items[key]; exists {
		return
	}

	// Remove older
	if f.order.Len() >= f.capacity {
		oldest := f.order.Front()
		if oldest != nil {
			oldestEntry := oldest.Value.(*entry[K, V])
			delete(f.items, oldestEntry.key)
			f.order.Remove(oldest)
		}
	}

	elem := f.order.PushBack(&entry[K, V]{key, value})
	f.items[key] = elem
}

// Get stats
func (f *FifoStore[K, V]) GetStats() storeStats {
	f.stats.size = len(f.items)
	return f.stats
}
