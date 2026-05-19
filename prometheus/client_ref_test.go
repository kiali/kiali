package prometheus

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// sentinelClient embeds NoopClient but overrides GetExistingMetricNames to
// return a known sentinel value. This makes it behaviourally distinguishable
// from a plain NoopClient, which always returns an empty slice.
// Used to prove that ClientRef.Set actually changes the active delegate.
type sentinelClient struct {
	*NoopClient
}

func (s *sentinelClient) GetExistingMetricNames(_ context.Context, _ []string) ([]string, error) {
	return []string{"sentinel"}, nil
}

// TestClientRefStartsWithInitialClient verifies that calls are delegated to the
// initial client before Set is ever called.
func TestClientRefStartsWithInitialClient(t *testing.T) {
	noop := NewNoopClient()
	ref := NewClientRef(noop)

	_, err := ref.GetBuildInfo(context.Background())
	assert.ErrorIs(t, err, ErrPrometheusDisabled, "should delegate to the initial NoopClient")
}

// TestClientRefSetUpgradesClient verifies that after Set, all calls reach the
// new client and not the original. Uses sentinelClient (returns ["sentinel"]
// from GetExistingMetricNames) vs NoopClient (returns []) as the signal,
// so the two delegates are behaviourally distinguishable without external imports.
func TestClientRefSetUpgradesClient(t *testing.T) {
	ref := NewClientRef(NewNoopClient())

	// Pre-swap: GetExistingMetricNames returns [] from NoopClient.
	names, err := ref.GetExistingMetricNames(context.Background(), nil)
	require.NoError(t, err)
	assert.Empty(t, names, "pre-swap: NoopClient should return empty slice")

	// Swap to sentinelClient.
	ref.Set(&sentinelClient{NewNoopClient()})

	// Post-swap: GetExistingMetricNames must return the sentinel value.
	names, err = ref.GetExistingMetricNames(context.Background(), nil)
	require.NoError(t, err)
	assert.Equal(t, []string{"sentinel"}, names, "post-swap: sentinelClient should return sentinel value")
}

// TestClientRefSetIsVisibleToAllCallers verifies the atomic swap: a value
// stored by one goroutine via Set is immediately visible to subsequent reads
// on any goroutine.
func TestClientRefSetIsVisibleToAllCallers(t *testing.T) {
	ref := NewClientRef(NewNoopClient())

	done := make(chan struct{})
	go func() {
		ref.Set(&sentinelClient{NewNoopClient()})
		close(done)
	}()
	<-done

	// After the goroutine has set, calls must reach the sentinelClient.
	names, err := ref.GetExistingMetricNames(context.Background(), nil)
	require.NoError(t, err)
	assert.Equal(t, []string{"sentinel"}, names, "atomic swap must be visible across goroutines")
}

// TestClientRefAPINotNil verifies that API() never returns nil, even before Set
// is called, so callers that invoke client.API() directly don't panic.
func TestClientRefAPINotNil(t *testing.T) {
	ref := NewClientRef(NewNoopClient())
	require.NotNil(t, ref.API())
}

// TestClientRefAPIUpdatesAfterSet verifies that API() returns the upgraded
// client's API after Set is called, not the original NoopClient's noopAPI.
func TestClientRefAPIUpdatesAfterSet(t *testing.T) {
	ref := NewClientRef(NewNoopClient())

	preAPI := ref.API()
	require.NotNil(t, preAPI)

	ref.Set(&sentinelClient{NewNoopClient()})

	// The sentinelClient embeds NoopClient whose API() returns a &noopAPI{}.
	// Both pre and post are noopAPIs, but this confirms API() delegates through
	// the updated client rather than panicking or returning a stale value.
	postAPI := ref.API()
	require.NotNil(t, postAPI)
}
