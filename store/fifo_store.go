package store

import (
	"container/list"
	"sync"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// fifoStore uses a FIFO approach storage and is safe for concurrent use.
type fifoStore[K comparable, V any] struct {
	capacity int
	lock     sync.RWMutex
	name     string // Used for metrics
	order    *list.List
	Store[K, V]
}

func NewFIFOStore[K comparable, V any](store Store[K, V], capacity int, name string) *fifoStore[K, V] {

	f := &fifoStore[K, V]{
		capacity: capacity,
		Store:    store,
		order:    list.New(),
		name:     name,
	}
	return f
}

// Get returns the value associated with the given key or an error.
func (f *fifoStore[K, V]) Get(key K) (V, bool) {
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

// Set Adds an item into the store, at the end of the list
// If the key already exists, modifies the value, without modify the element order
func (f *fifoStore[K, V]) Set(key K, value V) {
	f.lock.Lock()
	defer f.lock.Unlock()

	_, exists := f.Store.Get(key)

	// Remove older
	if f.order != nil && f.order.Len() >= f.capacity && !exists {
		oldest := f.order.Front()
		if oldest != nil {
			f.order.Remove(oldest)
			f.Store.Remove(oldest.Value.(K))
		}
	}

	if !exists {
		f.order.PushBack(key)
	}
	f.Store.Set(key, value)
}

// Remove removes an element from the store
func (f *fifoStore[K, V]) Remove(key K) {
	f.lock.Lock()
	defer f.lock.Unlock()

	f.order.Remove(&list.Element{Value: key})
	f.Store.Remove(key)
}

// Replace replaces the contents of the store with the given map and updates the order list
func (f *fifoStore[K, V]) Replace(items map[K]V) {
	f.lock.Lock()
	defer f.lock.Unlock()

	if len(items) > f.capacity {
		truncated := make(map[K]V, f.capacity)
		count := 0

		for k, v := range items {
			if count >= f.capacity {
				break
			}
			truncated[k] = v
			count++
		}
		items = truncated
	}

	f.Store.Replace(items)
	f.order = list.New()

	for key := range items {
		f.order.PushBack(key)
	}
}
