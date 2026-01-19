# Session Status

## Current Status

- **Phase**: 2 - Requirements Definition
- **Status**: Phase 2 Complete - Review In Progress
- **Last Updated**: 2026-01-19 (Session Paused)

## Project Overview

**Objective**: Implement pre-computing and caching of health data in Kiali

**Background**:

- Currently, health information (ClusterHealth endpoint at line 1137 in routing/routes.go) is calculated at request time
- Each request triggers fresh Prometheus queries and live data aggregation
- No caching is involved in health calculation - this can cause performance issues with many namespaces/services

## Current Phase Progress

### Phase 1: Discovery & Research

**Goal**: Understand the problem, explore the codebase, and research multiple solution approaches

**Completed**:

- ✅ Initial context gathering - identified that health is computed on-demand via handlers/health.go
- ✅ Confirmed health calculation flow: handlers → business/health.go → Prometheus queries
- ✅ Created PROBLEM_ANALYSIS.md with 4 distinct solution approaches
- ✅ Created CODEBASE_EXPLORATION.md documenting existing architecture and integration points
- ✅ Created CONSTRAINTS.md covering technical, performance, business, and security constraints
- ✅ Researched all solution approaches with detailed pros/cons analysis
- ✅ Provided initial recommendation: Approach 2 (On-Demand Caching) with evolution path
- ✅ **NEW**: Added Approach 5 (Metrics-Based Background Pre-Computation) based on user proposal
- ✅ Updated comparison table and resource analysis to include Approach 5
- ✅ Revised recommendations to present both Approach 2 and Approach 5 as viable options

**Quality Gates Status**:

- ✅ Problem documented in ai-dev-context/PROBLEM_ANALYSIS.md
- ✅ Multiple solution approaches researched (5 approaches compared)
- ✅ Constraints documented in ai-dev-context/CONSTRAINTS.md
- ✅ Codebase explored in ai-dev-context/CODEBASE_EXPLORATION.md
- ✅ Solution options ready for requirements evaluation
- ✅ **NEW**: Approach 5 (Metrics-Based) fully documented and compared

**Selected Approach**: ✅ **Approach 5 - Metrics-Based Background Pre-Computation**

**Selection Rationale**:

- Cache misses are NOT acceptable (hard requirement)
- Pre-computed health must always be available
- This requirement rules out Approaches 2, 3, and 4 (all have on-demand computation)
- Approach 5 provides guaranteed availability + observability benefits

**Next Steps**:

- ✅ Ready to transition to Phase 2 (Requirements Definition) for Approach 5

**Key Insight from Final Discussion**:

- Approach 5 is architecturally required (not just preferred)
- Approach 1 has no way to preserve historical health data without custom time-series storage
- Prometheus metrics provide automatic historical data preservation
- Future historical query APIs will need this data
- Worth the additional 1 day of development for long-term architecture

## Failed Approaches

_(None yet - will document any failed approaches to avoid repetition)_

## Key Decisions

### Approach Selection

- **Date**: 2025-11-19
- **Decision**: Selected Approach 5 (Metrics-Based Background Pre-Computation)
- **Rationale**:
  - **Hard requirement**: Cache misses not acceptable, health must always be pre-computed
  - This rules out Approaches 2, 3, 4 (all have on-demand computation scenarios)
  - Approach 5 guarantees availability + adds observability benefits
- **Key aspects**:
  - Background job runs every 5 minutes (configurable)
  - Stores full health data in KialiCache
  - Exports health status/grade as Prometheus metrics (not raw error rates)
  - No historical queries in initial scope
  - Leverages existing Kiali metrics infrastructure
  - Addresses cardinality by only exporting computed health status
  - Maximum staleness: 5 minutes (configurable)

## Current Phase Progress

### Phase 2: Requirements Definition

**Goal**: Define detailed requirements for Approach 5 implementation

**Completed**:

- ✅ Created PHASE2_REQUIREMENTS.md (comprehensive 700+ line document)
- ✅ Defined 6 functional requirements covering all aspects
- ✅ Designed cache structure (keys, values, expiration)
- ✅ Specified 7 Prometheus metrics (3 health + 4 operational)
- ✅ Documented API contracts (zero breaking changes guarantee)
- ✅ Created configuration schema with 5 parameters
- ✅ Designed HealthCacheService architecture
- ✅ Identified 5 integration points with existing code
- ✅ Defined 5 non-functional requirements
- ✅ Created 8 detailed acceptance criteria
- ✅ Designed comprehensive test strategy
- ✅ Broke implementation into 5 phases with time estimates

**Key Discovery**:

- Confirmed health data is NOT currently stored anywhere
- Everything computed fresh on every request
- Clean slate for implementation (no legacy code to migrate)

**Quality Gates Status**:

- ✅ All functional requirements defined and documented
- ✅ Cache design complete with key format and structure
- ✅ Metrics specification complete with cardinality analysis
- ✅ API contracts guaranteed (zero breaking changes)
- ✅ Configuration schema defined and validated
- ✅ Acceptance criteria established (8 major criteria)
- ✅ Test strategy defined (unit, integration, performance, manual)
- ✅ Implementation broken into manageable phases

**Open Questions** (need decisions before implementation):

1. ✅ **DECIDED**: Cache miss behavior - Return "Unknown" health status (not an error)
2. Metrics cardinality limits: How to handle? (Recommend: assume OK initially)
3. Historical queries: Support queryTime? (Recommend: not in Phase 1)
4. ✅ **DECIDED**: Rate intervals - Dynamically calculated from refresh interval
   - If refresh_interval=2m, use rate_interval="2m" for Prometheus queries
   - User-requested rateInterval parameter ignored (returns cached data)
   - Simplifies cache key (no rateInterval dimension)
5. ✅ **DECIDED**: Feature flag - Always enabled (no disable option)

## Notes for Next Session

**Phase 2 Complete - Review In Progress**

User is reviewing requirements document. When resuming, continue review or proceed to Phase 3.

**Recent Changes** (2026-01-19 Review Session):

- ✅ Changed default refresh interval to 2 minutes
- ✅ Removed cache expiration (background job continuously overwrites)
- ✅ Clarified job interval is time between completions, not max duration
- ✅ Clarified "accessible namespaces" means Kiali's service account access
- ✅ Cache miss returns "Unknown" health status (not an error)
- ✅ FR4 metrics honor `Observability.Metrics.Enabled` config
- ✅ Removed hot reload requirement (changes require restart)
- ✅ Rate interval is fixed configurable (default 0 = auto from elapsed time)
- ✅ Removed enable/disable feature flag (always active)
- ✅ Individual cache entries can be updated independently (for detail pages)

**Open Questions Decided:**

- Q1: Cache miss → return "Unknown" status ✅
- Q4: Rate interval → configurable, default 0 = auto from elapsed time ✅
- Q5: Feature flag → always enabled (no disable) ✅

When resuming, continue review or say **"Proceed to Phase 3"**

### What's Been Defined:

- ✅ Complete requirements document (PHASE2_REQUIREMENTS.md)
- ✅ Cache design: `health:{cluster}:{namespace}:{type}` (simplified - no rateInterval)
- ✅ Rate interval configurable (default: 0 = auto from elapsed time), not affected by client parameters
- ✅ 3 health metrics + 4 operational metrics
- ✅ HealthCacheService architecture
- ✅ 5-phase implementation plan
- ✅ Comprehensive test strategy

### Phase 3 Will Define:

1. File-by-file implementation plan
2. Detailed code structure for each component
3. Complete interface definitions
4. Data flow diagrams
5. Step-by-step implementation guide
6. Migration/rollout plan
7. Monitoring and alerting setup

### Quick Reference:

- **Selected Approach**: Approach 5 (Metrics-Based Background Pre-Computation)
- **Development Estimate**: 4-5 days (Phase 1: 2d, Phase 2: 1d, Phase 3: 1d, Phase 4: 1d, Phase 5: 0.5-1d)
- **Cache Key Format**: `health:{cluster}:{namespace}:{type}`
- **Refresh Interval**: 2 minutes (configurable)
- **Cache Expiration**: None (background job continuously overwrites)
- **Staleness Detection**: Via timestamp stored with cached values
- **Metric Cardinality**: ~15k-45k time series (manageable)
