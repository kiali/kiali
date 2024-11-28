package store

import (
	"container/list"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// FIFOStore uses a FIFO approach storage and is safe for concurrent use.
type FIFOStore[K comparable, V any] struct {
	capacity int
	name     string // Used for metrics
	Store[K, V]
	order *list.List
}

func NewFIFOStore[K comparable, V any](store Store[K, V], capacity int, name string) *FIFOStore[K, V] {

	f := &FIFOStore[K, V]{
		capacity: capacity,
		Store:    store,
		order:    list.New(),
		name:     name,
	}
	return f
}

// Get returns the value associated with the given key or an error.
func (f *FIFOStore[K, V]) Get(key K) (V, bool) {
	internalmetrics.GetCacheRequestsTotalMetric(f.name).Inc()
	elem, exists := f.Store.Get(key)
	if !exists {
		var value V
		log.Tracef("[FIFO store] Element doesnt exist: %v", key)
		return value, false
	}

	log.Tracef("[FIFO store] Returning from cache: %v", key)
	internalmetrics.GetCacheHitsTotalMetric(f.name).Inc()
	return elem, true
}

// Set
func (f *FIFOStore[K, V]) Set(key K, value V) {
	if _, exists := f.Store.Get(key); exists {
		return
	}

	// Remove older
	if f.order != nil && f.order.Len() >= f.capacity {
		oldest := f.order.Front()
		if oldest != nil {
			f.order.Remove(oldest)
			f.Store.Remove(oldest.Value.(K))
		}
	}

	f.order.PushBack(key)
	f.Store.Set(key, value)
}

// Set
func (f *FIFOStore[K, V]) Remove(key K) {
	for e := f.order.Front(); e != nil; e = e.Next() {
		if e.Value == key {
			f.order.Remove(e)
			break
		}
	}
	f.Store.Remove(key)
}
