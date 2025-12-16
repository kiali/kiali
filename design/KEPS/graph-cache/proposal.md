# Graph Cache KEP

1. [Summary](#summary)
2. [Motivation](#motivation)
   1. [Goals](#goals)
   2. [Non-Goals](#nongoals)
3. [Solution](#solution)
4. [Technical Challenges](#technical-challenges)
   1. [Time Periods](#time-periods)
   2. [Graph Options](#graph-options)
5. [Roadmap](#roadmap)

# Summary

Improve response times for Kiali's Traffic Graph by implementing a caching mechanism that can serve pre-computed or recently computed graph data. This KEP explores various approaches to graph caching considering Kiali's extensive configuration options and permission model.

# Motivation

The Traffic Graph is one of Kiali's most resource-intensive features. At scale, graph generation can take 30+ seconds due to:

- Multiple Prometheus queries across time ranges
- Complex graph processing and appender logic
- Multi-cluster data aggregation
- Large numbers of services and workloads

Users frequently refresh graphs or navigate between similar views, causing repeated expensive computations for the same or similar data.

## Goals

- Reduce Traffic Graph response times for repeated graph requests

## Non-goals

- Caching all possible graph combinations upfront
- Requiring users to pre-define "favorite" graphs in configuration
- Bypassing Kubernetes RBAC or Kiali's permission model
- Changing the fundamental graph generation algorithm

# Solution

This KEP builds upon the ideas in [Controller Model KEP](../controller-model/proposal.md) which establishes a framework for pre-computing and caching Kiali data. However, the Traffic Graph presents unique challenges due to:

1. **User-driven configuration**: Graphs are highly customizable with numerous options
2. **Time-based data**: Graphs refresh based on time advancements, not necessarily K8s config change.

The recommended approach is **Background Refresh (Re-compute)**, which provides automatic, permission-aware caching without configuration burden.

# Technical Challenges

One of Kiali's strengths is that it offers the end user a vast number of configuration options, such that views can be customized as needed to help visualize or troubleshoot the mesh. This is a big problem for pre-computing information. The processor and memory resources required to pre-compute the potential combinations is prohibitive.

Note that the focus is on the cross-cluster/cross-namespace pages. When a user has navigated the view to a detail page, on-demand processing is typically both feasible, due to a narrow scope, and desired, even mildly stale data is less acceptable.

## Graph Options

The Traffic Graph offers many options and the option settings directly affect the back-end processing. The namespaces and graph-type alone will fundamentally determine the queries performed and the resulting graph.

This is a difficult situation for pre-compute, as it's not possible to predict what the desired graph will be.

Possible options:

- **Predefinition (pre-compute)** - ❌ **ELIMINATED after analysis (Nov 2025)**

  - Let users define graphs in the Kiali CR. These "favorite" graphs could be pre-computed and rendered quickly.
  - Benefits:
    - favorite graphs always ready
  - Downsides:
    - it may be very unlikely for users to want to define graph queries in config
    - config-based queries are fixed may become dated
    - updates require kiali pod restarts
    - some users may not have permissions to view the data resulting from the predefined graph
    - **CRITICAL**: Configuration barrier makes this impractical for real-world usage
    - **CRITICAL**: Permission mismatch between controller SA and users has no good solution

- **Background refresh (re-compute)** - ✅ **RECOMMENDED (Nov 2025)**

  - Like today, users can set graph options as needed, and then launch a graph request. The user will wait for the initial graph to render. The result will be cached and the server will proactively re-compute the same graph, updating the cache. Requests for the same graph will return the most recent cached result. A change of graph, a cache-hit timeout, or a session end would end the re-compute.
  - Benefits:
    - avoids permission issues and config, works with any graph at any time
    - no user configuration required (automatic, self-service)
    - permission-aware caching (per-session)
    - self-optimizing (popular graphs stay cached)
  - Downsides:
    - still have to wait on the first request and any subsequent change to the requested graph

# Proposed Implementation

## Architecture

The graph cache implementation uses a **per-session** caching strategy with background refresh jobs. The graph cache uses a custom in-memory cache for several key reasons:

### Why Not a Kubernetes Controller?

1. **Non-Kubernetes Data Sources**: Graph generation relies primarily on Prometheus metrics, not Kubernetes objects. There are no K8s resources to watch that would trigger graph regeneration.

2. **Time-Based Refresh**: Graphs must refresh based on time window advancement (e.g., "last 5 minutes"), not configuration changes. This requires periodic polling rather than event-driven updates.

3. **Permission Context**: Graph data must be generated using the user's permissions (RBAC), not the Kiali service account. A controller running with elevated privileges would bypass user access controls.

4. **Dynamic Configuration**: Graph options (namespaces, graph type, display options) are user-specified at request time, not pre-defined in configuration. This makes them unsuitable for controller-based pre-computation.

5. **Session Lifecycle**: Graphs are ephemeral, tied to user sessions. They should be evicted when users change focus, not persist indefinitely like other cached data.

### Why Not the KialiCache?

The existing KialiCache doesn't quite fit the model I think we want for the graph cache. The following table is AI-generated but summarizes some of the reasons pretty well:

| Aspect                 | KialiCache                    | Graph Cache Needs               |
| ---------------------- | ----------------------------- | ------------------------------- |
| **Permission model**   | Kiali SA token → filter after | User's auth token per-session   |
| **Lifecycle**          | Singleton, process-lifetime   | Per-session, ephemeral          |
| **Key structure**      | cluster/namespace/token       | sessionID only                  |
| **Eviction strategy**  | Simple TTL                    | LRU + memory limit + inactivity |
| **Background refresh** | External (controllers)        | Built-in goroutine per entry    |
| **Memory tracking**    | None                          | Per-entry estimation            |

### Why not use store.Store as a Building Block?

We could use the existing store.Store. But, it's not a drop-in solution and would require some customizations (LRU eviction, inactivity tracking, etc). In the end, the custom graph cache impl is preferred because it's not overly complex or a lot of code, and in this case a bespoke solution serves well given the differing needs of the graph cache.

### Why not the golang-lru cache package?

It's possible that we could build the cache off this existing library, but like the other alternatives, it doesn't fit perfectly. We'd like tyo keep memory-based eviction but I'm not sure it's something easily built into lru. I'm
also not sure about a few other things desired features.

## Per-Session Caching

Each user session maintains its own cached graph, uniquely identified by `sessionID`. This approach:

- **Preserves permissions**: Each session uses the requesting user's auth token. This is important to
  ensure that the background graph generation results in restricting access as needed (inaccessible nodes, etc)
- **Supports concurrent users**: Different users cache independently. Tabs in the same browser share a session (and cache); different browsers or incognito windows have separate sessions.
- **Enables automatic eviction**:
  - Inactivity timeout: session not accessed within configurable period
  - Memory limit: LRU eviction when cache exceeds configured memory cap
  - Options changed: user requests a different graph configuration
  - Caching disabled: request explicitly disables caching
  - note, user logout does not currently force eviction, it relies on inactivity.
- **Optimizes for common case**: Users typically refresh the same graph repeatedly

When a user requests a graph:

1. If cached, return immediately from cache
2. If not cached, generate synchronously, cache it, and start background refresh job

### OpenShift multi-cluster auth

At this time (v2.19 Kiali), the OpenShift auth solution for multi-cluster may result in multiple session IDs for one user. There is a session ID for each cluster the user logs into via Kiali. Also at this time, the user must always log into the Kiali home cluster. For now, the caching mechanism will, when there are multiple possible session IDs, consstently select the home cluster session ID. This should effectively limit the "logical" user session to a single cache entry.

## Configuration

Graph caching is controlled via the `kiali_internal.graph_cache` configuration block:

```yaml
kiali_internal:
  graph_cache:
    enabled: true # Default: true
    inactivity_timeout: "10m" # How long to keep inactive session graphs
    max_cache_memory_mb: 1024 # Memory limit across all cached graphs
    refresh_interval: "60s" # Default refresh interval for background jobs
```

- **enabled**: Master switch for graph caching. When disabled, all graph requests are handled synchronously.
- **inactivity_timeout**: Sessions inactive (no cache hit) longer than this are evicted to free memory.
- **max_cache_memory_mb**: Soft limit on total cache memory. When exceeded, least-recently-accessed sessions are evicted.
- **refresh_interval**: Default interval for background refresh jobs. Individual requests can override this.

## Background Refresh Jobs

When a graph is cached, a background goroutine is spawned to refresh it periodically:

- Regenerates the graph with a moving time window (e.g., "last 5 minutes" advances forward)
- Updates the cache atomically so concurrent reads remain consistent
- Terminates when session is evicted or becomes inactive
- Uses the same auth context as the original request

## AI input

Note that this proposal and the associated implementation were aided using Cursor with various enabled models. The main design decision was to use an custom in-memory cache mechanism over a k8s controller store. It seemed right to me [jshaughn] and Cursor agreed. Just to further vet the decision I also asked claude sonnet 4.5, and it agreed:

● Looking at the graph caching implementation and proposal, I can provide an analysis of whether the current approach is correct or if it should use a Kubernetes controller store.

Analysis

Current Implementation Assessment: CORRECT ✅

The implementation correctly uses a custom in-memory cache rather than a Kubernetes controller store. This is the right architectural choice for several important reasons:

Why a Kubernetes Controller Store Would Be WRONG

The proposal document (lines 92-103) explicitly addresses this and provides excellent reasoning:

1. Data Source Mismatch

   - Graphs are built from Prometheus time-series metrics, not Kubernetes objects
   - Controllers watch K8s resources for changes - but there are no K8s resources to watch that would trigger graph updates
   - The graph data fundamentally comes from outside the K8s API

     Counter-point:

     The controller model still works with non-kube sources. You can configure any "Source" you want as long as you can send into a channel. Kiali's validations controller runs on a ticker that performs validation every reconcileInterval. So, point 1 is not a breaking issue. It's just not a perfect fit.

2. Time-Based vs Event-Based

   - Graphs must refresh based on time window advancement ("last 5 minutes" moves forward)
   - Controllers are event-driven (reacting to K8s object changes)
   - Graph refresh needs periodic polling, not event watching

   Counter-point:

   Again, Kiali's validations controller is interval-based. So, point 2 is not a breaking issue. But also again,it's just a perfect fit given that the graph caching can be running multiple timers, each with different context.

3. Permission Context is Critical

   - Graph data MUST be generated using the user's auth token and RBAC permissions
   - A controller runs with the Kiali service account (elevated privileges)
   - Using a controller would bypass user access controls - a security issue

   Counter-point:

   This is not a blocking issue, as we could likely use the client factory to get the user's client, and not
   have to use the Kiali SA.

4. Session Lifecycle

   - Graphs are ephemeral and session-specific
   - Should be evicted when users change focus
   - Controllers maintain cluster-wide, persistent data - wrong model

5. Dynamic Configuration

   - Graph options (namespaces, type, duration) are user-specified at request time
   - Controllers work with pre-defined resource types
   - Can't pre-compute all possible graph combinations

Implementation Quality

The actual implementation in graph_cache.go and refresh_job.go is well-designed:

Strengths:

- ✅ Proper mutex locking (no race conditions)
- ✅ LRU eviction for memory management
- ✅ Inactivity timeout handling
- ✅ Per-session isolation
- ✅ Context cancellation for cleanup
- ✅ Moving time window (updates QueryTime correctly)
- ✅ Goroutine lifecycle management

Key Design Patterns:

- Uses dependency injection (GraphGenerator function)
- Background goroutines with ticker-based refresh
- Thread-safe cache operations
- Graceful cleanup on eviction

When Controllers ARE Used in Kiali

The proposal references the Controller Model KEP which IS appropriate for:

- Validations (based on K8s Istio configs)
- Health checks (based on K8s pod/deployment state)
- Registry services (based on K8s service objects)

These work with controllers because they:

- Watch actual K8s resources
- Can run with service account permissions
- Are cluster-wide, not session-specific

Conclusion

The implementation is correct. Using a Kubernetes controller store would be architecturally wrong and would break the permission model. The custom in-memory cache with background refresh jobs is the appropriate solution for this use
case.

The design decision is well-documented in the proposal (lines 92-103), and the implementation properly follows that design.

[jshaughn] The bottom line here is that, not unlike many things, there is a trade-off between a custom solution and trying to re-use existing solutions. In this case, I don't see a perfect fit. Despite the downsides of a custom graph impl (yet another mechanism, so complexity), I think it's important for the graph cache to serve as perfectly as possible, given the graph's critical nature to Kiali. And, the implemetation is not a huge amount of code, I think it should be quite manageable. If we find cracks that can't be rectified, we're not boxed in, another impl is still feasible.
