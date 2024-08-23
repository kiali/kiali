package cache

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func forConcurrentAccess(ow *OnceWrapper, lock *sync.Mutex, key int, value string, data map[int]string) {
	// If this works like it should, for each concurrent set of calls, only one will be able to set a key value in the data map.
	// This is simulating the usage of OnceWrapper that is implemented in the cache refresh function.
	defer ow.Reset()
	ow.Do(func() error { //nolint:errcheck
		lock.Lock()
		data[key] = value
		lock.Unlock()
		time.Sleep(1 * time.Second)
		return nil
	})
}
func TestOnceWrapper_Do(t *testing.T) {
	assert := assert.New(t)

	onceWrapper := &OnceWrapper{once: &sync.Once{}}
	testBucket := map[int]string{}
	lock := sync.Mutex{} // required to use a lock so we can pass the data race test

	// make some concurrent calls - only one should actually do something
	wg := sync.WaitGroup{}
	for i := 1; i < 5; i++ {
		wg.Add(1)
		go func() {
			forConcurrentAccess(onceWrapper, &lock, i, "A", testBucket)
			wg.Done()
		}()
	}
	wg.Wait()

	// there should only be one data key in the testBucket - we aren't guaranteed which one, but only one should be there
	lock.Lock()
	assert.Len(testBucket, 1, "There should have only been one invocation of the function that sets testBucket data")
	for _, v := range testBucket {
		assert.Equal(v, "A")
	}
	lock.Unlock()

	lock.Lock()
	testBucket = map[int]string{}
	lock.Unlock()

	// Second round of calls to see OnceWrapper was reset and still works
	wg = sync.WaitGroup{}
	for i := 10; i < 20; i++ {
		wg.Add(1)
		go func() {
			forConcurrentAccess(onceWrapper, &lock, i, "B", testBucket)
			wg.Done()
		}()
	}
	wg.Wait()

	// there should only be one data key in the testBucket - we aren't guaranteed which one, but only one should be there
	lock.Lock()
	assert.Len(testBucket, 1, "There should have only been one invocation of the function that sets testBucket data")
	for _, v := range testBucket {
		assert.Equal(v, "B")
	}
	lock.Unlock()
}
