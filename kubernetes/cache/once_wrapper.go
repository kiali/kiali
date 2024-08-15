package cache

import (
	"sync"
)

type OnceWrapper struct {
	once *sync.Once
	rwMu sync.RWMutex
	err  error // the result of the last exection of the function passed to Do()
}

func (o *OnceWrapper) Do(callable func() error) error {
	o.rwMu.RLock()
	defer o.rwMu.RUnlock()
	o.once.Do(func() {
		o.err = callable()
	})
	return o.err
}

// Reset for the next Do
func (o *OnceWrapper) Reset() {
	o.rwMu.Lock()
	defer o.rwMu.Unlock()
	o.once = &sync.Once{}
	o.err = nil
}
