package store

import (
	"container/list"
	"sync"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// FIFOStore uses a FIFO approach storage and is safe for concurrent use.
type FIFOStore[K comparable, V any] struct {
	capacity int
	lock     sync.RWMutex
	name     string // Used for metrics
	order    *list.List
	Store[K, V]
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
	_, exists := f.Store.Get(key)

	// Remove older
	if f.order != nil && f.order.Len() >= f.capacity && !exists {
		oldest := f.order.Front()
		if oldest != nil {
			f.lock.Lock()
			f.order.Remove(oldest)
			f.lock.Unlock()
			f.Store.Remove(oldest.Value.(K))
		}
	}

	f.lock.Lock()
	f.order.PushBack(key)
	f.lock.Unlock()
	f.Store.Set(key, value)
}

// Set
func (f *FIFOStore[K, V]) Remove(key K) {
	for e := f.order.Front(); e != nil; e = e.Next() {
		if e.Value == key {
			f.lock.Lock()
			f.order.Remove(e)
			f.lock.Unlock()
			break
		}
	}
	f.Store.Remove(key)
}

// Replace replaces the contents of the store with the given map and updates the order list
func (f *FIFOStore[K, V]) Replace(items map[K]V) {

	f.Store.Replace(items)
	if items == nil {
		f.lock.Lock()
		f.order = list.New()
		f.lock.Unlock()
		return
	}

	f.lock.Lock()
	for key := range items {
		f.order.PushBack(key)
	}
	f.lock.Unlock()
}
