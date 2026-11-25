package get_pod_performance

import (
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/ai/mcputil"
)

// BuildPodPerformanceForPod returns structured CPU/memory usage vs requests/limits for one pod.
func BuildPodPerformanceForPod(
	kialiInterface *mcputil.KialiInterface,
	clusterName, namespace, workloadName, podName, timeRange string,
	queryTime time.Time,
) (PodPerformanceResponse, error) {
	if kialiInterface == nil || kialiInterface.ClientFactory == nil {
		return PodPerformanceResponse{}, fmt.Errorf("kiali interface is not available")
	}
	if podName == "" {
		return PodPerformanceResponse{}, fmt.Errorf("podName is required")
	}
	if timeRange == "" {
		timeRange = defaultTimeRange
	}
	if queryTime.IsZero() {
		queryTime = time.Now().UTC()
	}

	resp := PodPerformanceResponse{
		Cluster:   clusterName,
		Namespace: namespace,
		Workload:  workloadName,
		PodName:   podName,
		Resolved:  "pod",
		TimeRange: timeRange,
		QueryTime: queryTime,
		Errors:    map[string]string{},
	}

	pod, podErr := getPod(kialiInterface.Request, kialiInterface.ClientFactory, clusterName, namespace, podName)
	if podErr != nil {
		if k8serrors.IsNotFound(podErr) {
			return PodPerformanceResponse{}, fmt.Errorf("pod %q not found in namespace %q", podName, namespace)
		}
		return PodPerformanceResponse{}, podErr
	}
	applyPodSpecPerformance(pod, &resp)
	fillFromPrometheus(kialiInterface.Request, kialiInterface.Prom, namespace, resp.PodName, timeRange, queryTime, &resp)

	resp.CPU.UsageRequestRatio = ratio(resp.CPU.Usage, resp.CPU.Request)
	resp.CPU.UsageLimitRatio = ratio(resp.CPU.Usage, resp.CPU.Limit)
	resp.Memory.UsageRequestRatio = ratio(resp.Memory.Usage, resp.Memory.Request)
	resp.Memory.UsageLimitRatio = ratio(resp.Memory.Usage, resp.Memory.Limit)

	for i := range resp.Containers {
		c := &resp.Containers[i]
		c.CPU.UsageRequestRatio = ratio(c.CPU.Usage, c.CPU.Request)
		c.CPU.UsageLimitRatio = ratio(c.CPU.Usage, c.CPU.Limit)
		c.Memory.UsageRequestRatio = ratio(c.Memory.Usage, c.Memory.Request)
		c.Memory.UsageLimitRatio = ratio(c.Memory.Usage, c.Memory.Limit)
	}

	if len(resp.Errors) == 0 {
		resp.Errors = nil
	}
	return resp, nil
}

func applyPodSpecPerformance(pod *corev1.Pod, resp *PodPerformanceResponse) {
	containerReqLim := extractContainerRequestsLimits(pod)
	resp.Containers = make([]ContainerPerformance, 0, len(containerReqLim))

	var totalCPUReq, totalCPULim float64
	var totalMemReqBytes, totalMemLimBytes float64
	for containerName, rl := range containerReqLim {
		c := ContainerPerformance{Container: containerName}

		if rl.CPURequestCores != nil {
			v := *rl.CPURequestCores
			c.CPU.Request = &ScalarValue{Value: v, Unit: "cores"}
			totalCPUReq += v
		}
		if rl.CPULimitCores != nil {
			v := *rl.CPULimitCores
			c.CPU.Limit = &ScalarValue{Value: v, Unit: "cores"}
			totalCPULim += v
		}
		if rl.MemoryRequestBytes != nil {
			v := *rl.MemoryRequestBytes
			c.Memory.Request = &ScalarValue{Value: v, Unit: "bytes"}
			totalMemReqBytes += v
		}
		if rl.MemoryLimitBytes != nil {
			v := *rl.MemoryLimitBytes
			c.Memory.Limit = &ScalarValue{Value: v, Unit: "bytes"}
			totalMemLimBytes += v
		}

		resp.Containers = append(resp.Containers, c)
	}
	if totalCPUReq > 0 {
		resp.CPU.Request = &ScalarValue{Value: totalCPUReq, Unit: "cores"}
	}
	if totalCPULim > 0 {
		resp.CPU.Limit = &ScalarValue{Value: totalCPULim, Unit: "cores"}
	}
	if totalMemReqBytes > 0 {
		resp.Memory.Request = &ScalarValue{Value: totalMemReqBytes, Unit: "bytes"}
	}
	if totalMemLimBytes > 0 {
		resp.Memory.Limit = &ScalarValue{Value: totalMemLimBytes, Unit: "bytes"}
	}
}
