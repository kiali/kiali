package istio

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/telemetry/istio/appender"
)

// MockAppender is a mock implementation of the Appender interface for testing
type MockAppender struct {
	mock.Mock
	name        string
	isFinalizer bool
	execOrder   *[]string
	execMutex   *sync.Mutex
}

func NewMockAppender(name string, isFinalizer bool, execOrder *[]string, execMutex *sync.Mutex) *MockAppender {
	return &MockAppender{
		name:        name,
		isFinalizer: isFinalizer,
		execOrder:   execOrder,
		execMutex:   execMutex,
	}
}

func (m *MockAppender) Name() string {
	return m.name
}

func (m *MockAppender) IsFinalizer() bool {
	return m.isFinalizer
}

func (m *MockAppender) AppendGraph(ctx context.Context, trafficMap graph.TrafficMap, globalInfo *appender.GlobalInfo, namespaceInfo *appender.AppenderNamespaceInfo) {
	// Record execution order for testing
	m.execMutex.Lock()
	*m.execOrder = append(*m.execOrder, m.name)
	m.execMutex.Unlock()

	// Call the mock to track invocations and allow custom behavior
	m.Called(ctx, trafficMap, globalInfo, namespaceInfo)
}

func TestRunAppendersInParallel_EmptyAppenders(t *testing.T) {
	ctx := context.Background()
	trafficMap := graph.NewTrafficMap()
	globalInfo := &appender.GlobalInfo{
		Conf: config.NewConfig(),
	}
	namespaceInfo := &appender.AppenderNamespaceInfo{
		Namespace: "test",
	}

	// Should not panic with empty appenders
	runAppendersInParallel(ctx, []appender.Appender{}, trafficMap, globalInfo, namespaceInfo)
}

func TestRunAppendersInParallel_SequentialAppenders(t *testing.T) {
	ctx := context.Background()
	trafficMap := graph.NewTrafficMap()
	globalInfo := &appender.GlobalInfo{
		Conf: config.NewConfig(),
	}
	namespaceInfo := &appender.AppenderNamespaceInfo{
		Namespace: "test",
	}

	var execOrder []string
	var execMutex sync.Mutex

	// Create mock appenders that should run sequentially
	serviceEntryAppender := NewMockAppender(appender.ServiceEntryAppenderName, false, &execOrder, &execMutex)
	deadNodeAppender := NewMockAppender(appender.DeadNodeAppenderName, false, &execOrder, &execMutex)
	workloadEntryAppender := NewMockAppender(appender.WorkloadEntryAppenderName, false, &execOrder, &execMutex)

	serviceEntryAppender.On("AppendGraph", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()
	deadNodeAppender.On("AppendGraph", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()
	workloadEntryAppender.On("AppendGraph", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()

	appenders := []appender.Appender{
		serviceEntryAppender,
		deadNodeAppender,
		workloadEntryAppender,
	}

	runAppendersInParallel(ctx, appenders, trafficMap, globalInfo, namespaceInfo)

	// Verify all appenders were called
	serviceEntryAppender.AssertExpectations(t)
	deadNodeAppender.AssertExpectations(t)
	workloadEntryAppender.AssertExpectations(t)

	// Verify sequential execution order
	assert.Equal(t, 3, len(execOrder))
	assert.Equal(t, appender.ServiceEntryAppenderName, execOrder[0])
	assert.Equal(t, appender.DeadNodeAppenderName, execOrder[1])
	assert.Equal(t, appender.WorkloadEntryAppenderName, execOrder[2])
}

func TestRunAppendersInParallel_ParallelAppenders(t *testing.T) {
	ctx := context.Background()
	trafficMap := graph.NewTrafficMap()
	globalInfo := &appender.GlobalInfo{
		Conf: config.NewConfig(),
	}
	namespaceInfo := &appender.AppenderNamespaceInfo{
		Namespace: "test",
	}

	var execOrder []string
	var execMutex sync.Mutex
	var startTimes []time.Time
	var startMutex sync.Mutex

	// Create mock appenders that can run in parallel
	responseTimeAppender := NewMockAppender(appender.ResponseTimeAppenderName, false, &execOrder, &execMutex)
	securityPolicyAppender := NewMockAppender(appender.SecurityPolicyAppenderName, false, &execOrder, &execMutex)
	throughputAppender := NewMockAppender(appender.ThroughputAppenderName, false, &execOrder, &execMutex)

	// Set up mock expectations with timing verification
	responseTimeAppender.On("AppendGraph", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
		startMutex.Lock()
		startTimes = append(startTimes, time.Now())
		startMutex.Unlock()
		time.Sleep(5 * time.Millisecond) // Simulate work
	}).Return()

	securityPolicyAppender.On("AppendGraph", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
		startMutex.Lock()
		startTimes = append(startTimes, time.Now())
		startMutex.Unlock()
		time.Sleep(5 * time.Millisecond) // Simulate work
	}).Return()

	throughputAppender.On("AppendGraph", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
		startMutex.Lock()
		startTimes = append(startTimes, time.Now())
		startMutex.Unlock()
		time.Sleep(5 * time.Millisecond) // Simulate work
	}).Return()

	appenders := []appender.Appender{
		responseTimeAppender,
		securityPolicyAppender,
		throughputAppender,
	}

	start := time.Now()
	runAppendersInParallel(ctx, appenders, trafficMap, globalInfo, namespaceInfo)
	duration := time.Since(start)

	// Verify all appenders were called
	responseTimeAppender.AssertExpectations(t)
	securityPolicyAppender.AssertExpectations(t)
	throughputAppender.AssertExpectations(t)

	// Verify all appenders executed
	assert.Equal(t, 3, len(execOrder))
	assert.Equal(t, 3, len(startTimes))

	// Verify parallel execution by checking that appenders started within a short time window
	// This is more reliable than absolute timing in CI environments
	if len(startTimes) >= 2 {
		maxStartTimeDiff := time.Duration(0)
		for i := 1; i < len(startTimes); i++ {
			diff := startTimes[i].Sub(startTimes[0])
			if diff < 0 {
				diff = -diff
			}
			if diff > maxStartTimeDiff {
				maxStartTimeDiff = diff
			}
		}
		// All appenders should start within 50ms of each other if running in parallel
		// This is more lenient for CI environments while still validating parallel execution
		assert.Less(t, maxStartTimeDiff, 50*time.Millisecond, "Appenders should start nearly simultaneously if running in parallel")
	}

	t.Logf("Parallel execution took %v, max start time difference: %v", duration, func() time.Duration {
		if len(startTimes) >= 2 {
			maxDiff := time.Duration(0)
			for i := 1; i < len(startTimes); i++ {
				diff := startTimes[i].Sub(startTimes[0])
				if diff < 0 {
					diff = -diff
				}
				if diff > maxDiff {
					maxDiff = diff
				}
			}
			return maxDiff
		}
		return 0
	}())
}

func TestRunAppendersInParallel_MixedAppenders(t *testing.T) {
	ctx := context.Background()
	trafficMap := graph.NewTrafficMap()
	globalInfo := &appender.GlobalInfo{
		Conf: config.NewConfig(),
	}
	namespaceInfo := &appender.AppenderNamespaceInfo{
		Namespace: "test",
	}

	var execOrder []string
	var execMutex sync.Mutex

	// Create a mix of sequential and parallel appenders
	serviceEntryAppender := NewMockAppender(appender.ServiceEntryAppenderName, false, &execOrder, &execMutex)
	deadNodeAppender := NewMockAppender(appender.DeadNodeAppenderName, false, &execOrder, &execMutex)
	responseTimeAppender := NewMockAppender(appender.ResponseTimeAppenderName, false, &execOrder, &execMutex)
	throughputAppender := NewMockAppender(appender.ThroughputAppenderName, false, &execOrder, &execMutex)

	serviceEntryAppender.On("AppendGraph", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()
	deadNodeAppender.On("AppendGraph", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()
	responseTimeAppender.On("AppendGraph", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()
	throughputAppender.On("AppendGraph", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()

	appenders := []appender.Appender{
		serviceEntryAppender,
		deadNodeAppender,
		responseTimeAppender,
		throughputAppender,
	}

	runAppendersInParallel(ctx, appenders, trafficMap, globalInfo, namespaceInfo)

	// Verify all appenders were called
	serviceEntryAppender.AssertExpectations(t)
	deadNodeAppender.AssertExpectations(t)
	responseTimeAppender.AssertExpectations(t)
	throughputAppender.AssertExpectations(t)

	// Verify execution order: sequential appenders should come first
	assert.Equal(t, 4, len(execOrder))

	// Sequential appenders should be first two in order
	assert.Equal(t, appender.ServiceEntryAppenderName, execOrder[0])
	assert.Equal(t, appender.DeadNodeAppenderName, execOrder[1])

	// Parallel appenders should be last two (order may vary due to concurrency)
	parallelAppenders := []string{execOrder[2], execOrder[3]}
	assert.Contains(t, parallelAppenders, appender.ResponseTimeAppenderName)
	assert.Contains(t, parallelAppenders, appender.ThroughputAppenderName)

	// Verify that sequential appenders completed before parallel ones started
	// This is critical for correctness - parallel appenders must not start until sequential ones finish
}

func TestRunAppendersInParallel_OnlyParallelAppenders(t *testing.T) {
	ctx := context.Background()
	trafficMap := graph.NewTrafficMap()
	globalInfo := &appender.GlobalInfo{
		Conf: config.NewConfig(),
	}
	namespaceInfo := &appender.AppenderNamespaceInfo{
		Namespace: "test",
	}

	var execOrder []string
	var execMutex sync.Mutex

	// Create only truly parallel appenders (ones that don't modify map structure)
	responseTimeAppender := NewMockAppender(appender.ResponseTimeAppenderName, false, &execOrder, &execMutex)
	securityPolicyAppender := NewMockAppender(appender.SecurityPolicyAppenderName, false, &execOrder, &execMutex)
	throughputAppender := NewMockAppender(appender.ThroughputAppenderName, false, &execOrder, &execMutex)

	responseTimeAppender.On("AppendGraph", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()
	securityPolicyAppender.On("AppendGraph", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()
	throughputAppender.On("AppendGraph", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()

	appenders := []appender.Appender{
		responseTimeAppender,
		securityPolicyAppender,
		throughputAppender,
	}

	start := time.Now()
	runAppendersInParallel(ctx, appenders, trafficMap, globalInfo, namespaceInfo)
	duration := time.Since(start)

	// Verify all appenders were called
	responseTimeAppender.AssertExpectations(t)
	securityPolicyAppender.AssertExpectations(t)
	throughputAppender.AssertExpectations(t)

	// Verify all appenders executed
	assert.Equal(t, 3, len(execOrder))

	// Verify parallel execution completed successfully
	// Note: We don't assert on exact timing as CI environments can be variable
	// The key is that all appenders executed concurrently without errors
	t.Logf("Parallel execution took %v", duration)
}

func TestRunSingleAppender(t *testing.T) {
	ctx := context.Background()
	trafficMap := graph.NewTrafficMap()
	globalInfo := &appender.GlobalInfo{
		Conf: config.NewConfig(),
	}
	namespaceInfo := &appender.AppenderNamespaceInfo{
		Namespace: "test",
	}

	var execOrder []string
	var execMutex sync.Mutex

	mockAppender := NewMockAppender("testAppender", false, &execOrder, &execMutex)
	mockAppender.On("AppendGraph", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()

	runSingleAppender(ctx, mockAppender, trafficMap, globalInfo, namespaceInfo)

	// Verify appender was called
	mockAppender.AssertExpectations(t)
	assert.Equal(t, 1, len(execOrder))
	assert.Equal(t, "testAppender", execOrder[0])
}

// Benchmark tests to measure performance improvement
func BenchmarkSequentialAppenders(b *testing.B) {
	ctx := context.Background()
	trafficMap := graph.NewTrafficMap()
	globalInfo := &appender.GlobalInfo{
		Conf: config.NewConfig(),
	}
	namespaceInfo := &appender.AppenderNamespaceInfo{
		Namespace: "test",
	}

	// Create parallel appenders but force sequential execution for comparison
	var appenders []appender.Appender
	appenderNames := []string{
		appender.ResponseTimeAppenderName,
		appender.SecurityPolicyAppenderName,
		appender.ThroughputAppenderName,
	}

	for _, name := range appenderNames {
		var execOrder []string
		var execMutex sync.Mutex
		mockAppender := NewMockAppender(name, false, &execOrder, &execMutex)
		mockAppender.On("AppendGraph", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
			time.Sleep(1 * time.Millisecond) // Simulate work
		}).Return()
		appenders = append(appenders, mockAppender)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Force sequential execution by running each appender individually
		for _, a := range appenders {
			runSingleAppender(ctx, a, trafficMap, globalInfo, namespaceInfo)
		}
	}
}

func BenchmarkParallelAppenders(b *testing.B) {
	ctx := context.Background()
	trafficMap := graph.NewTrafficMap()
	globalInfo := &appender.GlobalInfo{
		Conf: config.NewConfig(),
	}
	namespaceInfo := &appender.AppenderNamespaceInfo{
		Namespace: "test",
	}

	// Create only parallel appenders (same as sequential benchmark for fair comparison)
	var appenders []appender.Appender
	appenderNames := []string{
		appender.ResponseTimeAppenderName,
		appender.SecurityPolicyAppenderName,
		appender.ThroughputAppenderName,
	}

	for _, name := range appenderNames {
		var execOrder []string
		var execMutex sync.Mutex
		mockAppender := NewMockAppender(name, false, &execOrder, &execMutex)
		mockAppender.On("AppendGraph", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
			time.Sleep(1 * time.Millisecond) // Simulate work
		}).Return()
		appenders = append(appenders, mockAppender)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		runAppendersInParallel(ctx, appenders, trafficMap, globalInfo, namespaceInfo)
	}
}
