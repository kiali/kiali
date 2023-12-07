package business

import (
	"context"

	"github.com/kiali/kiali/kubernetes"
)

// FakeControlPlaneMonitor is used for testing and implements ControlPlaneMonitor.
type FakeControlPlaneMonitor struct {
	status kubernetes.IstioComponentStatus
}

func (f *FakeControlPlaneMonitor) PollIstiodForProxyStatus(ctx context.Context) {}
func (f *FakeControlPlaneMonitor) CanConnectToIstiod(client kubernetes.ClientInterface) (kubernetes.IstioComponentStatus, error) {
	return f.status, nil
}

func (f *FakeControlPlaneMonitor) CanConnectToIstiodForRevision(client kubernetes.ClientInterface, revision string) (kubernetes.IstioComponentStatus, error) {
	return f.status, nil
}
func (f *FakeControlPlaneMonitor) RefreshIstioCache(ctx context.Context) error { return nil }

// Interface guard
var _ ControlPlaneMonitor = &FakeControlPlaneMonitor{}
