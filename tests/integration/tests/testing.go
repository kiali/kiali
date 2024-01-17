package tests

import (
	"context"
	"testing"
)

/*
	Contains helper utils and functions for integration tests.
*/

// contextWithTestingDeadline returns a context with a deadline set to the test's deadline.
// The context is canceled when the test ends.
// If the test does not have a deadline, then a context.Background() is returned.
func contextWithTestingDeadline(t *testing.T) context.Context {
	ctx := context.Background()
	if deadline, ok := t.Deadline(); ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithDeadline(ctx, deadline)
		t.Cleanup(cancel)
	}
	return ctx
}
