package store

import (
	"context"
	"time"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
)

const (
	defaultKeyExpirationCheckInterval = 10 * time.Second
	defaultKeyTTL                     = 10 * time.Second
)

// TODO: A better implementation would probably use a priority queue
// to more efficiently expire keys but this is simpler and good enough for now.

// ExpirationStore is a generic key value store that expires keys after a certain time.
// It keeps track of which keys are expired separately from the main store.
type ExpirationStore[T any] struct {
	Store[T]
	Stopped <-chan struct{}

	keyExpirationCheckInterval time.Duration
	keyTTLs                    Store[time.Time]
	ttl                        time.Duration
}

// NewExpirationStore returns a new ExpirationStore with the given store and expiration time.
// TODO: Provide functional options if the arguments list continues to grow.
func NewExpirationStore[T any](ctx context.Context, store Store[T], keyTTL *time.Duration, keyExpirationCheckInterval *time.Duration) *ExpirationStore[T] {
	if keyExpirationCheckInterval == nil {
		keyExpirationCheckInterval = util.AsPtr(defaultKeyExpirationCheckInterval)
	}

	if keyTTL == nil {
		keyTTL = util.AsPtr(defaultKeyTTL)
	}

	s := &ExpirationStore[T]{
		Store:                      store,
		keyExpirationCheckInterval: *keyExpirationCheckInterval,
		keyTTLs:                    New[time.Time](),
		ttl:                        *keyTTL,
	}
	s.Stopped = s.checkAndRemoveExpiredKeys(ctx)
	return s
}

// Set associates the given value with the given key and sets the expiration time.
func (s *ExpirationStore[T]) Set(key string, value T) {
	s.Store.Set(key, value)
	s.keyTTLs.Set(key, time.Now().Add(s.ttl))
}

// Remove removes the given key from the store. If the key does not exist, it does nothing.
// Removes the expiration key as well.
func (s *ExpirationStore[T]) Remove(key string) {
	s.Store.Remove(key)
	s.keyTTLs.Remove(key)
}

// Replace replaces the contents of the store with the given map and renews key timers.
func (s *ExpirationStore[T]) Replace(items map[string]T) {
	now := time.Now()
	s.Store.Replace(items)
	if items == nil {
		s.keyTTLs.Replace(nil)
		return
	}

	for key := range items {
		s.keyTTLs.Set(key, now.Add(s.ttl))
	}
}

func (s *ExpirationStore[T]) checkAndRemoveExpiredKeys(ctx context.Context) <-chan struct{} {
	stopped := make(chan struct{})
	go func() {
		for {
			select {
			case <-time.After(s.keyExpirationCheckInterval):
				// Check for expired keys and remove them from the store.
				// If a key is expired, send a signal on the channel.
				for _, key := range s.Keys() {
					expiration, found := s.keyTTLs.Get(key)
					if !found {
						continue
					}

					if time.Now().After(expiration) {
						log.Tracef("Key %s expired. Removing from store", key)
						s.Remove(key)
					}
				}

			case <-ctx.Done():
				s.Replace(nil)
				// Don't block on sending stopped.
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
