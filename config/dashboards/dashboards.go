package dashboards

const DEFAULT_DASHBOARDS_YAML = `
- name: istiod
  title: Istiod Metrics
  discoverOn: "pilot_info"
  items:
  - chart:
      name: "Proxy Push Time"
      spans: 3
      metricName: "pilot_proxy_convergence_time_count"
      unit: "s"
      dataType: "rate"
  - chart:
      name: "CPU Usage"
      spans: 3
      metricName: "process_cpu_seconds_total"
      unit: "s"
      dataType: "rate"
      min: 0
  - chart:
      name: "Pilot Pushes"
      unit: "ops/s"
      spans: 3
      metricName: "pilot_xds_pushes"
      dataType: "raw"
      min: 0
  - chart:
      name: "XDS Active Connections"
      spans: 3
      metricName: "pilot_xds"
      dataType: "raw"
      min: 0
  - chart:
      name: "Known Services"
      spans: 3
      metricName: "pilot_services"
      dataType: "raw"
      min: 0

- name: envoy
  title: Envoy Metrics
  discoverOn: "envoy_server_uptime"
  items:
  - chart:
      name: "Pods uptime"
      spans: 3
      metricName: "envoy_server_uptime"
      dataType: "raw"
  - chart:
      name: "Allocated memory"
      unit: "bytes"
      spans: 3
      metricName: "envoy_server_memory_allocated"
      dataType: "raw"
      min: 0
  - chart:
      name: "Heap size"
      unit: "bytes"
      spans: 3
      metricName: "envoy_server_memory_heap_size"
      dataType: "raw"
      min: 0
  - chart:
      name: "Upstream active connections"
      spans: 3
      metricName: "envoy_cluster_upstream_cx_active"
      dataType: "raw"
  - chart:
      name: "Upstream total requests"
      spans: 3
      metricName: "envoy_cluster_upstream_rq_total"
      unit: "rps"
      dataType: "rate"
  - chart:
      name: "Downstream active connections"
      spans: 3
      metricName: "envoy_listener_downstream_cx_active"
      dataType: "raw"
  - chart:
      name: "Downstream HTTP requests"
      spans: 3
      metricName: "envoy_listener_http_downstream_rq"
      unit: "rps"
      dataType: "rate"
- name: go
  title: Go Metrics
  runtime: Go
  discoverOn: "go_info"
  items:
  - chart:
      name: "CPU ratio"
      spans: 4
      metricName: "container_cpu_usage_seconds_total"
      dataType: "rate"
      aggregations:
      - label: "pod_name"
        displayName: "Pod"
  - chart:
      name: "RSS Memory"
      unit: "bytes"
      spans: 4
      metricName: "process_resident_memory_bytes"
      dataType: "raw"
      aggregations:
      - label: "pod_name"
        displayName: "Pod"
  - chart:
      name: "Goroutines"
      spans: 4
      metricName: "go_goroutines"
      dataType: "raw"
      aggregations:
      - label: "pod_name"
        displayName: "Pod"
  - chart:
      name: "Heap allocation rate"
      unit: "bytes/s"
      spans: 4
      metricName: "go_memstats_alloc_bytes_total"
      dataType: "rate"
      aggregations:
      - label: "pod_name"
        displayName: "Pod"
  - chart:
      name: "GC rate"
      spans: 4
      metricName: "go_gc_duration_seconds_count"
      dataType: "rate"
      aggregations:
      - label: "pod_name"
        displayName: "Pod"
  - chart:
      name: "Next GC"
      unit: "bytes"
      spans: 4
      metricName: "go_memstats_next_gc_bytes"
      dataType: "raw"
      aggregations:
      - label: "pod_name"
        displayName: "Pod"
- name: kiali
  title: Kiali Internal Metrics
  items:
  - chart:
      name: "API hit rate"
      unit: "ops"
      spans: 4
      metricName: "kiali_api_processing_duration_seconds_count"
      dataType: "rate"
      aggregations:
      - label: "route"
        displayName: "API route"
  - chart:
      name: "API processing duration"
      unit: "seconds"
      spans: 4
      metricName: "kiali_api_processing_duration_seconds"
      dataType: "histogram"
      aggregations:
      - label: "route"
        displayName: "API route"
  - chart:
      name: "API Failures"
      spans: 4
      metricName: "kiali_api_failures_total"
      dataType: "raw"
      aggregations:
      - label: "route"
        displayName: "API route"
  - chart:
      name: "Graph generation duration"
      unit: "seconds"
      spans: 4
      metricName: "kiali_graph_generation_duration_seconds"
      dataType: "histogram"
      aggregations:
      - label: "graph_kind"
        displayName: "Graph kind"
      - label: "graph_type"
        displayName: "Graph type"
  - chart:
      name: "Tracing processing duration"
      unit: "seconds"
      spans: 4
      metricName: "kiali_tracing_processing_duration_seconds"
      dataType: "histogram"
      aggregations:
      - label: "query_group"
        displayName: "Query Group"
- name: micrometer-1.0.6-jvm-pool
  title: JVM Pool Metrics
  runtime: JVM
  discoverOn: "jvm_buffer_total_capacity_bytes"
  items:
  - chart:
      name: "Pool buffer memory used"
      unit: "bytes"
      spans: 4
      metricName: "jvm_buffer_memory_used_bytes"
      dataType: "raw"
      aggregations:
      - label: "id"
        displayName: "Pool"
  - chart:
      name: "Pool buffer capacity"
      unit: "bytes"
      spans: 4
      metricName: "jvm_buffer_total_capacity_bytes"
      dataType: "raw"
      aggregations:
      - label: "id"
        displayName: "Pool"
  - chart:
      name: "Pool buffer count"
      unit: "bytes"
      spans: 4
      metricName: "jvm_buffer_count"
      dataType: "raw"
      aggregations:
      - label: "id"
        displayName: "Pool"
- name: micrometer-1.0.6-jvm
  title: JVM Metrics
  runtime: JVM
  discoverOn: "jvm_threads_live"
  items:
  - chart:
      name: "Total live threads"
      spans: 4
      metricName: "jvm_threads_live"
      dataType: "raw"
  - chart:
      name: "Daemon threads"
      spans: 4
      metricName: "jvm_threads_daemon"
      dataType: "raw"
  - chart:
      name: "Loaded classes"
      spans: 4
      metricName: "jvm_classes_loaded"
      dataType: "raw"
  - chart:
      name: "Memory used"
      unit: "bytes"
      spans: 4
      metricName: "jvm_memory_used_bytes"
      dataType: "raw"
      aggregations:
      - label: "area"
        displayName: "Area"
      - label: "id"
        displayName: "Space"
  - chart:
      name: "Memory commited"
      unit: "bytes"
      spans: 4
      metricName: "jvm_memory_committed_bytes"
      dataType: "raw"
      aggregations:
      - label: "area"
        displayName: "Area"
      - label: "id"
        displayName: "Space"
  - chart:
      name: "Memory max"
      unit: "bytes"
      spans: 4
      metricName: "jvm_memory_max_bytes"
      dataType: "raw"
      aggregations:
      - label: "area"
        displayName: "Area"
      - label: "id"
        displayName: "Space"
- name: micrometer-1.1-jvm
  title: JVM Metrics
  runtime: JVM
  discoverOn: "jvm_threads_live_threads"
  items:
  - chart:
      name: "Memory used"
      unit: "bytes"
      spans: 4
      metricName: "jvm_memory_used_bytes"
      dataType: "raw"
      aggregations:
      - label: "area"
        displayName: "Area"
      - label: "id"
        displayName: "Space"
  - chart:
      name: "Memory commited"
      unit: "bytes"
      spans: 4
      metricName: "jvm_memory_committed_bytes"
      dataType: "raw"
      aggregations:
      - label: "area"
        displayName: "Area"
      - label: "id"
        displayName: "Space"
  - chart:
      name: "Memory max"
      unit: "bytes"
      spans: 4
      metricName: "jvm_memory_max_bytes"
      dataType: "raw"
      aggregations:
      - label: "area"
        displayName: "Area"
      - label: "id"
        displayName: "Space"
  - chart:
      name: "Total live threads"
      spans: 4
      metricName: "jvm_threads_live_threads"
      dataType: "raw"
  - chart:
      name: "Daemon threads"
      spans: 4
      metricName: "jvm_threads_daemon_threads"
      dataType: "raw"
  - chart:
      name: "Threads states"
      spans: 4
      metricName: "jvm_threads_states_threads"
      dataType: "raw"
      aggregations:
      - label: "state"
        displayName: "State"
- name: microprofile-1.1
  title: MicroProfile Metrics
  runtime: MicroProfile
  discoverOn: "base:thread_count"
  items:
  - chart:
      name: "Current loaded classes"
      spans: 3
      metricName: "base:classloader_current_loaded_class_count"
      dataType: "raw"
  - chart:
      name: "Unloaded classes"
      spans: 3
      metricName: "base:classloader_total_unloaded_class_count"
      dataType: "raw"
  - chart:
      name: "Thread count"
      spans: 3
      metricName: "base:thread_count"
      dataType: "raw"
  - chart:
      name: "Thread max count"
      spans: 3
      metricName: "base:thread_max_count"
      dataType: "raw"
  - chart:
      name: "Thread daemon count"
      spans: 3
      metricName: "base:thread_daemon_count"
      dataType: "raw"
  - chart:
      name: "Committed heap"
      unit: "bytes"
      spans: 3
      metricName: "base:memory_committed_heap_bytes"
      dataType: "raw"
  - chart:
      name: "Max heap"
      unit: "bytes"
      spans: 3
      metricName: "base:memory_max_heap_bytes"
      dataType: "raw"
  - chart:
      name: "Used heap"
      unit: "bytes"
      spans: 3
      metricName: "base:memory_used_heap_bytes"
      dataType: "raw"
- name: microprofile-x.y
  title: MicroProfile Metrics
  runtime: MicroProfile
  discoverOn: "base:gc_complete_scavenger_count"
  items:
  - chart:
      name: "Young GC time"
      unit: "seconds"
      spans: 3
      metricName: "base:gc_young_generation_scavenger_time_seconds"
      dataType: "raw"
  - chart:
      name: "Young GC count"
      spans: 3
      metricName: "base:gc_young_generation_scavenger_count"
      dataType: "raw"
  - chart:
      name: "Total GC time"
      unit: "seconds"
      spans: 3
      metricName: "base:gc_complete_scavenger_time_seconds"
      dataType: "raw"
  - chart:
      name: "Total GC count"
      spans: 3
      metricName: "base:gc_complete_scavenger_count"
      dataType: "raw"
- name: nodejs
  title: Node.js Metrics
  runtime: Node.js
  discoverOn: "nodejs_active_handles_total"
  items:
  - chart:
      name: "Active handles"
      spans: 4
      metricName: "nodejs_active_handles_total"
      dataType: "raw"
  - chart:
      name: "Active requests"
      spans: 4
      metricName: "nodejs_active_requests_total"
      dataType: "raw"
  - chart:
      name: "Event loop lag"
      unit: "seconds"
      spans: 4
      metricName: "nodejs_eventloop_lag_seconds"
      dataType: "raw"
  - chart:
      name: "Total heap size"
      unit: "bytes"
      spans: 4
      metricName: "nodejs_heap_space_size_total_bytes"
      dataType: "raw"
      aggregations:
      - label: "space"
        displayName: "Space"
  - chart:
      name: "Used heap size"
      unit: "bytes"
      spans: 4
      metricName: "nodejs_heap_space_size_used_bytes"
      dataType: "raw"
      aggregations:
      - label: "space"
        displayName: "Space"
  - chart:
      name: "Available heap size"
      unit: "bytes"
      spans: 4
      metricName: "nodejs_heap_space_size_available_bytes"
      dataType: "raw"
      aggregations:
      - label: "space"
        displayName: "Space"
- name: quarkus
  title: Quarkus Metrics
  runtime: Quarkus
  items:
  - chart:
      name: "Thread count"
      spans: 4
      metricName: "vendor:thread_count"
      dataType: "raw"
  - chart:
      name: "Used heap"
      unit: "bytes"
      spans: 4
      metricName: "vendor:memory_heap_usage_bytes"
      dataType: "raw"
  - chart:
      name: "Used non-heap"
      unit: "bytes"
      spans: 4
      metricName: "vendor:memory_non_heap_usage_bytes"
      dataType: "raw"
  - include: "microprofile-x.y"
- name: springboot-jvm-pool
  title: JVM Pool Metrics
  runtime: Spring Boot
  items:
  - include: "micrometer-1.0.6-jvm-pool"
- name: springboot-jvm
  title: JVM Metrics
  runtime: Spring Boot
  items:
  - include: "micrometer-1.0.6-jvm"
- name: springboot-tomcat
  title: Tomcat Metrics
  runtime: Spring Boot
  items:
  - include: "tomcat"
- name: thorntail
  title: Thorntail Metrics
  runtime: Thorntail
  discoverOn: "vendor:loaded_modules"
  items:
  - include: "microprofile-1.1"
  - chart:
      name: "Loaded modules"
      spans: 6
      metricName: "vendor:loaded_modules"
      dataType: "raw"
- name: tomcat
  title: Tomcat Metrics
  runtime: Tomcat
  discoverOn: "tomcat_sessions_created_total"
  items:
  - chart:
      name: "Sessions created"
      spans: 4
      metricName: "tomcat_sessions_created_total"
      dataType: "raw"
  - chart:
      name: "Active sessions"
      spans: 4
      metricName: "tomcat_sessions_active_current"
      dataType: "raw"
  - chart:
      name: "Sessions rejected"
      spans: 4
      metricName: "tomcat_sessions_rejected_total"
      dataType: "raw"
  - chart:
      name: "Bytes sent"
      unit: "bitrate"
      spans: 6
      metricName: "tomcat_global_sent_bytes_total"
      dataType: "rate"
      aggregations:
      - label: "name"
        displayName: "Name"
  - chart:
      name: "Bytes received"
      unit: "bitrate"
      spans: 6
      metricName: "tomcat_global_received_bytes_total"
      dataType: "rate"
      aggregations:
      - label: "name"
        displayName: "Name"
  - chart:
      name: "Global errors"
      spans: 6
      metricName: "tomcat_global_error_total"
      dataType: "raw"
      aggregations:
      - label: "name"
        displayName: "Name"
  - chart:
      name: "Servlet errors"
      spans: 6
      metricName: "tomcat_servlet_error_total"
      dataType: "raw"
      aggregations:
      - label: "name"
        displayName: "Name"
- name: vertx-client
  title: Vert.x Client Metrics
  runtime: Vert.x
  discoverOn: "vertx_http_client_connections"
  items:
  - chart:
      name: "Client response time"
      unit: "seconds"
      spans: 6
      metricName: "vertx_http_client_responseTime_seconds"
      dataType: "histogram"
      aggregations:
      - label: "path"
        displayName: "Path"
      - label: "method"
        displayName: "Method"
  - chart:
      name: "Client request count rate"
      unit: "ops"
      spans: 6
      metricName: "vertx_http_client_requestCount_total"
      dataType: "rate"
      aggregations:
      - label: "path"
        displayName: "Path"
      - label: "method"
        displayName: "Method"
  - chart:
      name: "Client active connections"
      spans: 6
      metricName: "vertx_http_client_connections"
      dataType: "raw"
  - chart:
      name: "Client active websockets"
      spans: 6
      metricName: "vertx_http_client_wsConnections"
      dataType: "raw"
  - chart:
      name: "Client bytes sent"
      unit: "bytes"
      spans: 6
      metricName: "vertx_http_client_bytesSent"
      dataType: "histogram"
  - chart:
      name: "Client bytes received"
      unit: "bytes"
      spans: 6
      metricName: "vertx_http_client_bytesReceived"
      dataType: "histogram"
- name: vertx-eventbus
  title: Vert.x Eventbus Metrics
  runtime: Vert.x
  discoverOn: "vertx_eventbus_handlers"
  items:
  - chart:
      name: "Event bus handlers"
      spans: 6
      metricName: "vertx_eventbus_handlers"
      dataType: "raw"
      aggregations:
      - label: "address"
        displayName: "Eventbus address"
  - chart:
      name: "Event bus pending messages"
      spans: 6
      metricName: "vertx_eventbus_pending"
      dataType: "raw"
      aggregations:
      - label: "address"
        displayName: "Eventbus address"
  - chart:
      name: "Event bus processing time"
      unit: "seconds"
      spans: 6
      metricName: "vertx_eventbus_processingTime_seconds"
      dataType: "histogram"
      aggregations:
      - label: "address"
        displayName: "Eventbus address"
  - chart:
      name: "Event bus bytes read"
      unit: "bytes"
      spans: 6
      metricName: "vertx_eventbus_bytesRead"
      dataType: "histogram"
      aggregations:
      - label: "address"
        displayName: "Eventbus address"
  - chart:
      name: "Event bus bytes written"
      unit: "bytes"
      spans: 6
      metricName: "vertx_eventbus_bytesWritten"
      dataType: "histogram"
      aggregations:
      - label: "address"
        displayName: "Eventbus address"
- name: vertx-jvm
  title: JVM Metrics
  runtime: Vert.x
  items:
  - include: "micrometer-1.1-jvm"
- name: vertx-pool
  title: Vert.x Pools Metrics
  runtime: Vert.x
  discoverOn: "vertx_pool_ratio"
  items:
  - chart:
      name: "Usage duration"
      unit: "seconds"
      spans: 6
      metricName: "vertx_pool_usage_seconds"
      dataType: "histogram"
      aggregations:
      - label: "pool_name"
        displayName: "Name"
      - label: "pool_type"
        displayName: "Type"
  - chart:
      name: "Usage ratio"
      spans: 6
      metricName: "vertx_pool_ratio"
      dataType: "raw"
      aggregations:
      - label: "pool_name"
        displayName: "Name"
      - label: "pool_type"
        displayName: "Type"
  - chart:
      name: "Queue size"
      spans: 6
      metricName: "vertx_pool_queue_size"
      dataType: "raw"
      aggregations:
      - label: "pool_name"
        displayName: "Name"
      - label: "pool_type"
        displayName: "Type"
  - chart:
      name: "Time in queue"
      unit: "seconds"
      spans: 6
      metricName: "vertx_pool_queue_delay_seconds"
      dataType: "histogram"
      aggregations:
      - label: "pool_name"
        displayName: "Name"
      - label: "pool_type"
        displayName: "Type"
  - chart:
      name: "Resources used"
      spans: 6
      metricName: "vertx_pool_inUse"
      dataType: "raw"
      aggregations:
      - label: "pool_name"
        displayName: "Name"
      - label: "pool_type"
        displayName: "Type"
- name: vertx-server
  title: Vert.x Server Metrics
  runtime: Vert.x
  discoverOn: "vertx_http_server_connections"
  items:
  - chart:
      name: "Server response time"
      unit: "seconds"
      spans: 6
      metricName: "vertx_http_server_responseTime_seconds"
      dataType: "histogram"
      aggregations:
      - label: "path"
        displayName: "Path"
      - label: "method"
        displayName: "Method"
  - chart:
      name: "Server request count rate"
      unit: "ops"
      spans: 6
      metricName: "vertx_http_server_requestCount_total"
      dataType: "rate"
      aggregations:
      - label: "code"
        displayName: "Error code"
      - label: "path"
        displayName: "Path"
      - label: "method"
        displayName: "Method"
  - chart:
      name: "Server active connections"
      spans: 6
      metricName: "vertx_http_server_connections"
      dataType: "raw"
  - chart:
      name: "Server active websockets"
      spans: 6
      metricName: "vertx_http_server_wsConnections"
      dataType: "raw"
  - chart:
      name: "Server bytes sent"
      unit: "bytes"
      spans: 6
      metricName: "vertx_http_server_bytesSent"
      dataType: "histogram"
  - chart:
      name: "Server bytes received"
      unit: "bytes"
      spans: 6
      metricName: "vertx_http_server_bytesReceived"
      dataType: "histogram"
`
