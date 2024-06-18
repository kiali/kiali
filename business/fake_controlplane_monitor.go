package business

import (
	"context"
)

// FakeControlPlaneMonitor is used for testing and implements ControlPlaneMonitor.
type FakeControlPlaneMonitor struct{}

func (f *FakeControlPlaneMonitor) PollIstiodForProxyStatus(ctx context.Context) {}
func (f *FakeControlPlaneMonitor) RefreshIstioCache(ctx context.Context) error  { return nil }

// Interface guard
var _ ControlPlaneMonitor = &FakeControlPlaneMonitor{}
