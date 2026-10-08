---
domain: workloads
relations:
- entity: pod
  verb: runs
  cardinality: one-to-many
references:
- kind: code
  role: implementation
  target: business/workloads.go#WorkloadService
---

# Workload

Something that runs pods — a Deployment, StatefulSet, DaemonSet, Job, CronJob,
ReplicaSet, DeploymentConfig, a bare Pod or a WorkloadGroup.

## Information kept

- **Name** — the workload's name
- **Type** — its Kubernetes kind
- **Created** — when it was created
- **Version** — its version label
- **Mode** — Sidecar or Ambient, and in ambient which ztunnel or waypoint captures its traffic
- **Auto injection** — whether its pods get a sidecar: true, false or not set
- **Waypoint** — the waypoint proxy its traffic goes through, if any
- **Health** — Healthy, Degraded, Failure, Not Ready or no health information
- **Labels** — its Kubernetes labels
- **Annotations** — its Kubernetes annotations, on the workload and on its pod template
- **Istio proxy status** — whether each proxy is in sync with its control plane
- **Validations** — missing sidecar, missing app or version label, and failing containers
- **Missing sidecar** — whether its pods run outside the mesh
- **Inbound metrics** — request volume, duration, size and errors of traffic it receives
- **Outbound metrics** — the same for traffic it sends
- **Runtime metrics** — the dashboards of the runtimes its pods expose, such as Go, JVM or Quarkus
