package store

import (
	"container/list"
	"context"
	"sync"
	"time"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
)

const (
	defaultExpirationCheckInterval = 1 * time.Minute
	defaultTTL                     = 5 * time.Minute
)

type storeStats struct {
	hits          int
	totalRequests int
	size          int
}

// FifoStore uses a FIFO approach storage and is safe for concurrent use.
type FifoStore[K comparable, V any] struct {
	capacity                int
	expirationCheckInterval time.Duration
	items                   map[K]*list.Element
	lock                    sync.RWMutex
	order                   *list.List
	stats                   storeStats
	stopped                 <-chan struct{}
	ttl                     time.Duration
}

type entry[K comparable, V any] struct {
	key   K
	ttl   time.Time
	value V
}

func NewFIFOStore[K comparable, V any](ctx context.Context, capacity int, expirationCheckInterval *time.Duration, ttl *time.Duration) *FifoStore[K, V] {
	if expirationCheckInterval == nil {
		expirationCheckInterval = util.AsPtr(defaultExpirationCheckInterval)
	}
	if ttl == nil {
		ttl = util.AsPtr(defaultTTL)
	}
	f := &FifoStore[K, V]{
		capacity:                capacity,
		expirationCheckInterval: *expirationCheckInterval,
		items:                   make(map[K]*list.Element),
		order:                   list.New(),
		stats: storeStats{
			hits:          0,
			totalRequests: 0,
		},
		ttl: *ttl,
	}
	f.stopped = f.removeExpiredKeys(ctx)
	return f
}

// Get returns the value associated with the given key or an error.
func (f *FifoStore[K, V]) Get(key K) (V, bool) {
	f.lock.RLock()
	defer f.lock.RUnlock()
	f.stats.totalRequests++
	elem, exists := f.items[key]
	if !exists {
		var value V
		log.Tracef("[FIFO store] Element doesnt exist: %v", key)
		return value, false
	}
	// If element is expired
	if time.Now().After(elem.Value.(*entry[K, V]).ttl) {
		entryToRemove := elem.Value.(*entry[K, V])
		delete(f.items, entryToRemove.key)
		f.order.Remove(elem)
		var value V
		log.Tracef("[FIFO store] Element expired: %v", key)
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

	elem := f.order.PushBack(&entry[K, V]{key, time.Now().Add(f.ttl), value})
	f.items[key] = elem
}

// Get stats
func (f *FifoStore[K, V]) GetStats() storeStats {
	f.stats.size = len(f.items)
	return f.stats
}

// removeExpiredKeys
// Get already checks expired elements
// But this avoids to have expired items using cache capacity
func (f *FifoStore[K, V]) removeExpiredKeys(ctx context.Context) <-chan struct{} {
	stopped := make(chan struct{})
	go func() {
		for {
			select {
			case <-time.After(f.expirationCheckInterval):
				// Check for expired keys and remove them from the store.
				// If a key is expired, send a signal on the channel.
				for _, item := range f.items {
					key := item.Value.(*entry[K, V]).key

					if time.Now().After(item.Value.(*entry[K, V]).ttl) {
						log.Tracef("[FIFO store] Key '%v' expired. Removing from store", key)
						delete(f.items, key)
						f.order.Remove(item)
					}
				}

			case <-ctx.Done():
				select {
				case stopped <- struct{}{}:
				default:
				}
				return
			}
		}
	}()
	return stopped
}
