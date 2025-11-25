# Session Status

## Current Status

- **Phase**: 1 - Discovery & Research
- **Status**: Phase 1 Complete - Approach Selected
- **Last Updated**: 2025-11-19 (Session End)

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
  - Background job runs every 2 minutes (configurable)
  - Stores full health data in KialiCache
  - Exports health status/grade as Prometheus metrics (not raw error rates)
  - No historical queries in initial scope
  - Leverages existing Kiali metrics infrastructure
  - Addresses cardinality by only exporting computed health status
  - Maximum staleness: 2 minutes (configurable)

## Notes for Next Session

**Phase 1 Complete! Ready for Phase 2.**

When resuming, say **"Start session"** or **"Transition to Phase 2"**

### What's Been Decided:

- ✅ Approach 5 selected (Metrics-Based Background Pre-Computation)
- ✅ Core requirement: No cache misses, always pre-computed health
- ✅ Architectural requirement: Historical data preservation via Prometheus metrics
- ✅ All Phase 1 documents complete and updated

### Phase 2 Will Define:

1. Functional requirements (current + future historical queries)
2. Metrics specification (exact format, labels, values)
3. Cache structure and key design
4. Prometheus integration details
5. API contracts (zero breaking changes)
6. Configuration schema (refresh interval, etc.)
7. Acceptance criteria
8. Test strategy

### Quick Reference:

- **Selected Approach**: Approach 5 (Metrics-Based Background Pre-Computation)
- **Development Estimate**: 4-5 days
- **Max Staleness**: 2 minutes (configurable)
- **Metric Cardinality**: ~45k time series (manageable)
