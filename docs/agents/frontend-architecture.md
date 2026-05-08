---
scribe:
  title: "Frontend Architecture"
  description: "React/TypeScript frontend — component structure, routing, Redux state, PatternFly, i18n, Cypress tests"
  watch_paths: [frontend/src/, frontend/cypress/]
  scan: "8b3121d092244fb3aba0087f449ff717b6fd709b"
  freshness: 89
  human_input: 0
  completeness: 91
  inferred_sections:
    - {id: "overview", heading: "Overview"}
    - {id: "entry-points", heading: "Entry Points and Bootstrap"}
    - {id: "routing", heading: "Routing"}
    - {id: "pages", heading: "Pages"}
    - {id: "components", heading: "Components"}
    - {id: "redux-state", heading: "Redux State Management"}
    - {id: "styling", heading: "Styling and PatternFly"}
    - {id: "i18n", heading: "Internationalisation"}
    - {id: "hooks", heading: "Custom Hooks"}
    - {id: "cypress", heading: "Cypress End-to-End Tests"}
  stale_flags: []
---

# Frontend Architecture

> TL;DR: A React 17 + TypeScript SPA that uses React Router v5 as a direct dependency plus `react-router-dom-v5-compat` for React Router v6 APIs (`createBrowserRouter`), Redux with redux-persist, PatternFly 6 for UI components, typestyle for scoped CSS, and i18next for translations. Cypress BDD tests cover the full feature set via tagged `.feature` files and shared step-definition modules.

## Overview

The frontend lives entirely under `frontend/`. The production artifact is built with `react-scripts` and served from the Go backend as static files. In development, MSW (Mock Service Worker) can be enabled to run the frontend without a live backend (`REACT_APP_MOCK_API=true`).

Key technology choices (from `frontend/package.json`):

| Concern | Library |
|---|---|
| UI framework | React 17, TypeScript |
| UI component system | PatternFly 6 (`@patternfly/react-core` etc.) |
| Topology / graph canvas | `@patternfly/react-topology` |
| Charts | `@patternfly/react-charts` |
| State management | Redux 4 + redux-persist + redux-thunk |
| Routing | `react-router-dom` v5 (direct) + `react-router-dom-v5-compat` v6 for `createBrowserRouter` / `RouterProvider` |
| Styling | typestyle (`kialiStyle`) + PatternFly CSS + SCSS variables |
| i18n | i18next + i18next-http-backend + react-i18next |
| HTTP | axios (with request/response interceptors) |
| YAML editing | ACE editor + Monaco editor |
| E2E tests | Cypress with `@badeball/cypress-cucumber-preprocessor` |

## Entry Points and Bootstrap

**`frontend/src/index.tsx`** is the Webpack entry point. It:

1. Imports and applies global PatternFly CSS (`patternfly.css`, `patternfly-charts.css`, `patternfly-addons.css`).
2. Imports `./i18n` to initialise i18next before any component renders.
3. Optionally starts MSW for offline/mock development mode.
4. Calls `setRouter(pathRoutes)` to construct the React Router `createBrowserRouter` instance, then renders `<RouterProvider router={router} />` around `<App />`.

**`frontend/src/app/App.tsx`** is the root React component. It:

- Wraps everything in `<Provider store={store}>` and `<PersistGate>` (from redux-persist).
- Registers global `visibilityjs` handlers that dispatch `GlobalActions.setPageVisibility*` so background polling can pause when the tab is hidden.
- Sets up global Axios interceptors: every request increments a loading counter (spinner) and sets the OpenShift Bearer token header if one was extracted from the URL `oauth_token` param; every response decrements the counter and dispatches `LoginActions.sessionExpired()` on HTTP 401.
- Shows `<StartupInitializer>` until startup checks complete, then renders `<AuthenticationController>` which gates the app between `<LoginPage>` (unauthenticated) and `<Navigation>` (authenticated).

Other files in `frontend/src/app/`:

- `History.tsx` — exports the `router` instance and `rootBasename` / `webRoot` helpers.
- `AuthenticationController.tsx` — checks session state and renders either the public or protected area.
- `InitializingScreen.tsx` — loading screen shown during startup and PersistGate hydration.
- `StartupInitializer.tsx` — fetches configuration, status, and auth strategy before the app is usable.

## Routing

Routes are declared in **`frontend/src/routes.tsx`**. The file exports two things:

### `navMenuItems`

An array of `MenuItem` objects that drives the left-hand navigation bar. Each entry specifies `id`, `title` (translated), `to` (path), and `pathsActive` (array of regexes used to highlight the active nav item). Entries with `separator: true` also render a visual divider.

Current nav items: Overview, Traffic Graph, Mesh, Namespaces, Applications, Services, Workloads, Istio Config, Distributed Tracing. Note: the Distributed Tracing nav item links to a route whose `element` is an empty fragment (`<></>`); there is no `TracingPage` component. Kiali links users directly to the external Jaeger/Tempo URL rather than embedding a tracing page.

### `pathRoutes`

A `RouteObject[]` array consumed by `createBrowserRouter`. The mapping of paths to page components:

| Path pattern | Component |
|---|---|
| `/overview` | `OverviewPage` |
| `/namespaces` | `NamespacesPage` |
| `/graph/namespaces` | `GraphPage` |
| `/graph/node/namespaces/:namespace/aggregates/:aggregate/:aggregateValue` | `GraphRoute` (aggregate node-detail graph) |
| `/graph/node/namespaces/:namespace/...` | `GraphRoute` (node-detail graph for app/service/workload nodes) |
| `/namespaces/:namespace/services/:service` | `ServiceDetailsRoute` |
| `/namespaces/:namespace/workloads/:workload` | `WorkloadDetailsRoute` |
| `/namespaces/:namespace/applications/:app` | `AppDetailsRoute` |
| `/namespaces/:namespace` | `NamespaceDetailsRoute` |
| `/namespaces/:namespace/istio/...` | `IstioConfigDetailsRoute` |
| `/istio/new/:group/:version/:kind` | `IstioConfigNewRoute` |
| `/istio` | `IstioConfigListPage` |
| `/applications` | `AppListPage` |
| `/services` | `ServiceListPage` |
| `/workloads` | `WorkloadListPage` |
| `/mesh` | `MeshPage` |
| `*` | `WildcardRoute` |

Route components under `frontend/src/routes/` (e.g. `GraphRoute`, `ServiceDetailsRoute`) handle URL-parameter extraction and pass props into the underlying page components.

## Pages

Each subdirectory of `frontend/src/pages/` corresponds to a top-level route:

| Directory | Purpose |
|---|---|
| `Overview/` | Namespace health summary tiles |
| `Graph/` | Traffic graph canvas built on `@patternfly/react-topology` |
| `Mesh/` | Mesh topology visualisation |
| `Namespaces/` | Namespace list |
| `NamespaceDetails/` | Single-namespace detail — overview, resources, labels, annotations, minigraph |
| `AppList/` | Application list across namespaces |
| `AppDetails/` | Single-app detail (workloads, metrics, traces) |
| `ServiceList/` | Kubernetes service list |
| `ServiceDetails/` | Single-service detail |
| `WorkloadList/` | Workload list |
| `WorkloadDetails/` | Single-workload detail |
| `IstioConfigList/` | All Istio config objects |
| `IstioConfigDetails/` | Single Istio config object viewer/editor |
| `IstioConfigNew/` | Wizard for creating new Istio config |
| `Login/` | Login page |

### NamespaceDetails Page

**Route:** `/namespaces/:namespace` → `NamespaceDetailsRoute` (thin wrapper in [frontend/src/routes/NamespaceDetailsRoute.tsx](frontend/src/routes/NamespaceDetailsRoute.tsx)) → `NamespaceDetailsPage` → `NamespaceDetailsOverview`.

`NamespaceDetailsRoute` uses `useParams` to extract `:namespace` and passes it as a prop to the page component. This follows the same pattern as `WorkloadDetailsRoute` and `ServiceDetailsRoute`.

**Component tree:**

```
NamespaceDetailsRoute           (route param extraction)
  NamespaceDetailsPage          (class, Redux-connected, connectRefresh HOC)
    RenderHeader                (title row with PFBadge + namespace name, actions menu, TimeControl)
    ParameterizedTabs           (single "Overview" tab at index 0)
      NamespaceDetailsOverview  (Grid layout: 4 left + 8 right columns)
        Stack (left column)
          Card[data-test="namespace-details-card"]     (Status/Type/Mode/Revision/mTLS/Cluster)
          Card[data-test="namespace-resources-card"]   (Apps/Services/Workloads/Istio config with health breakdowns)
          EditableLabelsCard[data-test="namespace-labels-card"]
          EditableAnnotationsCard[data-test="namespace-annotations-card"]
        MiniGraphCard (right column, spans 8 of 12)   (traffic minigraph for the namespace)
    NamespaceTrafficPolicies    (modal for injection/mTLS traffic policy operations)
```

**Data loading (`NamespaceDetailsPage.load()`):**

1. `API.getNamespaceInfo(namespace, cluster)` — fetches base `Namespace` object.
2. `enrichNamespaceInfo()` — runs four API calls in parallel via `Promise.all`:
   - `fetchClusterNamespacesHealth` → populates `statusApp`, `statusService`, `statusWorkload`, `worstStatus`
   - `API.getClustersTls` → populates `nsInfo.tlsStatus` (with mesh-wide mTLS inheritance logic in `resolveNamespaceTlsStatusForDisplay`)
   - `API.getConfigValidations` → populates `nsInfo.validations`
   - `API.getIstioConfig` → populates `nsInfo.istioConfig` (filtered to the target namespace via `buildIstioConfigForNamespace`)
3. Uses `PromisesRegistry` (cancellable promises) to avoid setting state after unmount.

**Static Grafana/Perses info** is fetched once via class-level static promise caches (`NamespaceDetailsPageComponent.grafanaInfoPromise`, `persesInfoPromise`) to avoid re-fetching on route reuse; these links are filtered to `ISTIO_DASHBOARDS` entries and passed to `buildNamespaceRowActions`.

**Control plane revisions** are fetched via `API.getControlPlanes()` on mount and stored in state; passed to `NamespaceTrafficPolicies` filtered to planes that manage the current namespace.

**Label/annotation editing** (when not in viewOnlyMode):
- `EditableLabelsCard` and `EditableAnnotationsCard` allow in-place editing.
- On save, `handleSaveMetadata` computes a JSON merge-patch (setting removed keys to `null`) and calls `API.updateNamespace(namespace, jsonPatch, cluster)`.
- Keys containing `"istio"` are sorted first in both cards via `partitionByIstio()` (renders `numPriority` highlighted entries at the top).

**Actions menu** (`buildNamespaceRowActions` in [frontend/src/pages/NamespaceDetails/namespaceDetailActions.ts](frontend/src/pages/NamespaceDetails/namespaceDetailActions.ts)): builds conditional entries for sidecar injection enable/disable, Grafana dashboards, Perses dashboards — all gated on `serverConfig` flags and `viewOnlyMode`.

**Cypress coverage** (`frontend/cypress/integration/featureFiles/namespace_details.feature`, tagged `@namespace-details @ossmc`):

| Tag | Scenario |
|---|---|
| `@core-2 @offline` | Overview card exists (`[data-test="namespace-detail-overview-bookinfo"]`) |
| `@core-2 @offline` | Details card has Status, Type, Mode entries |
| `@core-2 @offline` | Resources card has links for Applications, Services, Workloads, Istio config |
| `@core-2 @offline` | Labels card exists |
| `@core-2 @offline` | Annotations card exists |
| `@core-2` | Minigraph is visible |

Step definitions are in [frontend/cypress/integration/common/namespace_details.ts](frontend/cypress/integration/common/namespace_details.ts). The `Given` step navigates to `/console/namespaces/${ns}?refresh=0`; `Then` steps query by `data-test` attributes matching those emitted by `NamespaceDetailsOverview`.

## Components

`frontend/src/components/` contains reusable components organised by feature area. Top-level subdirectories include:

`About`, `Ambient`, `Badge`, `BoundingClientAwareComponent`, `BreadcrumbView`, `Charts`, `ChatBot`, `DebugInformation`, `DefaultSecondaryMasthead`, `DetailDescription`, `Dropdown`, `Envoy`, `ErrorBoundary`, `ErrorSection`, `FilterList`, `Filters`, `Health`, `HeatMap`, `IstioActions`, `IstioCertsInfo`, `IstioConfigCard`, `IstioConfigPreview`, `IstioStatus`, `IstioWizards`, `Kiosk`, `Label`, `Link`, `Loading`, `Logo`, `Mesh`, `Metrics`, `MetricsOptions`, `MissingAuthPolicy`, `MissingLabel`, `MissingSidecar`, `MTls`, `Nav`, `NotificationCenter`, `Overview`, `Pf`, `Refresh`, `Select`, `SessionTimeout`, `Spire`, `SummaryPanel`, `Tab`, `Table`, `Time`, `ToolbarDropdown`, `Tour`.

Notable component groups:

- **`Nav/`** — top navigation and the `Navigation` shell that wraps all authenticated pages.
- **`IstioWizards/`** — multi-step wizard for creating and updating Istio traffic management config.
- **`Metrics/`** / **`MetricsOptions/`** — Prometheus-backed chart panels embedded in detail pages.
- **`Health/`** — health indicator icons and tooltip content.
- **`SummaryPanel/`** — right-hand side panel in the traffic graph showing selected node/edge details.
- **`ChatBot/`** — AI chatbot integration (PatternFly chatbot `@patternfly/chatbot`).

## Redux State Management

### Store setup (`frontend/src/store/ConfigStore.ts`)

The store is created with `createStore` + `applyMiddleware(thunk)`. redux-persist writes a subset of state to `localStorage` under a key derived from the app's `webRoot` (e.g. `kiali-root`). State slices persisted (with selective field whitelisting via `redux-persist-transform-filter`):

| Slice | Persisted fields |
|---|---|
| `authentication` | `landingRoute` |
| `globalState` | `language`, `theme` |
| `graph` | `filterState`, `layout` (note: the persist config references `filterState` by name, distinct from `toolbarState`) |
| `statusState` | entire slice |
| `tracingState` | entire slice |
| `namespaces` | `activeNamespaces` |
| `userSettings` | `duration`, `refreshInterval`, `timeRange` |

Redux DevTools are enabled in development mode.

### `KialiAppState` shape (`frontend/src/store/Store.ts`)

| Key | Type | Purpose |
|---|---|---|
| `authentication` | `LoginState` | Session info, login status enum, landing route |
| `chatAi` | `ChatAIState` | AI chatbot enabled flag, providers, context |
| `clusters` | `ClusterState` | Active clusters list and filter |
| `globalState` | `GlobalState` | Page visibility, kiosk mode, loading counter, language, theme |
| `graph` | `GraphState` | Layout, edge mode, summary data, toolbar state, update timestamp |
| `istioCertsInfo` | `CertsInfo[]` | Istio certificate info |
| `istioStatus` | `{ [cluster]: ComponentStatus[] }` | Control-plane component health |
| `mesh` | `MeshState` | Mesh topology definition, layout, selected target, toolbar state |
| `meshTLSStatus` | `TLSStatus` | Mesh-wide mTLS status |
| `metricsStats` | `MetricsStatsState` | Cached Prometheus metric summaries |
| `namespaces` | `NamespaceState` | Active/all namespaces, per-cluster mapping, fetch state |
| `namespacesList` | `NamespacesListState` | Column order and visibility for the namespaces list page |
| `notificationCenter` | `NotificationCenterState` | Toast/alert notification queue |
| `statusState` | `StatusState` | Kiali server build/version info |
| `tourState` | `TourState` | Active guided tour step |
| `tracingState` | `TracingState` | Distributed tracing configuration |
| `userSettings` | `UserSettings` | Duration, refresh interval, time range, replay state |

### Reducers (`frontend/src/reducers/`)

One reducer file per state slice, combined in `reducers/index.ts` via `combineReducers`. Async work is done via thunk action creators in the corresponding `*ThunkActions.ts` files (e.g. `GraphThunkActions.ts`, `NamespaceThunkActions.ts`).

### `GraphToolbarState`

The `graph.toolbarState` sub-object carries all graph display toggles:

`boxByCluster`, `boxByNamespace`, `edgeLabels[]`, `findValue`, `graphType`, `hideValue`, `rankBy[]`, `showFindHelp`, `showIdleEdges`, `showIdleNodes`, `showLegend`, `showOperationNodes`, `showOutOfMesh`, `showRank`, `showSecurity`, `showServiceNodes`, `showTrafficAnimation`, `showVirtualServices`, `showWaypoints`, `trafficRates[]`.

## Styling and PatternFly

### PatternFly

The app imports PatternFly CSS directly in `index.tsx`:

```typescript
import '@patternfly/patternfly/patternfly.css';
import '@patternfly/patternfly/patternfly-charts.css';
import '@patternfly/patternfly/patternfly-addons.css';
```

A `postinstall` script in `package.json` patches PatternFly's CSS to replace non-standard `justify-content: start/end` values with `flex-start/flex-end` for browser compatibility.

### `kialiStyle` (`frontend/src/styles/StyleUtils.ts`)

All component-level styles use the `kialiStyle` function instead of raw typestyle `style()`:

```typescript
export const kialiStyle = (styleProps: NestedCSSProperties) => {
  return style({
    $debugName: cssPrefix,   // controlled via CSS_PREFIX env var (default: "kiali")
    $nest: {
      '&&&': { ...styleProps }  // triple-ampersand increases CSS specificity
    }
  });
};
```

The triple-ampersand specificity trick is intentional — it ensures Kiali styles win over PatternFly defaults, which is especially important in the OSSMC (OpenShift Service Mesh Console) plugin context where the CSS prefix can be changed.

### Style modules in `frontend/src/styles/`

| File | Purpose |
|---|---|
| `GlobalStyle.ts` | Body-level global styles |
| `GraphStyle.ts` | Graph toolbar and layout style utilities |
| `HealthStyle.ts` | Health status colour tokens |
| `AceEditorStyle.ts` | ACE editor theming |
| `FlexStyles.ts` | Common flexbox utilities |
| `PfSpacer.ts` | PatternFly spacer constants |
| `PfTypography.ts` | Typography helpers |
| `TabStyles.ts` | Tab component styling |
| `variables.module.scss` | SCSS CSS custom-property tokens (imported as a CSS module) |

## Internationalisation

Kiali uses i18next with the HTTP backend loader.

**`frontend/src/i18n.ts`** initialises i18next:

```typescript
i18next
  .use(HttpBackend)       // loads JSON translation files from the server
  .use(initReactI18next)
  .init({
    backend: { loadPath: `${process.env.PUBLIC_URL}/locales/{{lng}}/{{ns}}.json` },
    fallbackLng: 'en',
    nsSeparator: '|',     // changed from default ':' so translated strings can end with ':'
    interpolation: { escapeValue: false }
  });
```

**`frontend/src/utils/I18nUtils.ts`** exposes three helpers used throughout the codebase:

- `useKialiTranslation()` — React hook wrapping `useTranslation(I18N_NAMESPACE)`.
- `t(value, options?)` — plain function for translating outside a component; falls back to returning `value` if i18next is not yet initialised.
- `tMap(value, options?)` — translates every value in a string-keyed object.

The `I18N_NAMESPACE` is controlled by the `I18N_NAMESPACE` environment variable, allowing the OSSMC plugin to use a separate namespace. Translation strings are extracted from source by running `npm run i18n` (invokes the `i18next-parser`).

## Custom Hooks

`frontend/src/hooks/` provides small composable hooks:

| Hook file | Purpose |
|---|---|
| `applications.ts` | Fetch applications list |
| `clusters.ts` | Cluster selection helpers |
| `controlPlanes.ts` | Control plane data |
| `dataPlanes.ts` | Data plane data |
| `istioConfigs.ts` | Istio config fetch |
| `namespaces.ts` | Namespace list and selection |
| `redux.ts` | Typed `useAppSelector` / `useAppDispatch` |
| `refresh.ts` | Polling/refresh interval logic |
| `services.ts` | Service list fetch |
| `useIconFontReady.ts` | Waits for PatternFly icon font to load |

## Cypress End-to-End Tests

End-to-end tests live under `frontend/cypress/`. They use the `@badeball/cypress-cucumber-preprocessor` to parse Gherkin `.feature` files.

### Feature files (`frontend/cypress/integration/featureFiles/`)

Each `.feature` file covers one user-facing feature. The test suite is tagged (`@core-1`, `@core-2`, `@crd-validation`, `@ambient`, `@multi-cluster`, `@waypoint`, `@tracing`, `@ai-chatbot`, etc.) so that different CI pipelines can run relevant subsets using the `TAGS` environment variable.

Partial list of feature files:

`ai_chatbot.feature`, `app_details.feature`, `app_details_graph.feature`, `app_details_multicluster.feature`, `apps.feature`, `authorization.feature`, `graph_context_menu.feature`, `graph_display.feature`, `graph_find_hide.feature`, `graph_replay.feature`, `graph_side_panel.feature`, `graph_toolbar.feature`, `graph_toolbar_legend.feature`, `istio_config_editor.feature`, `istio_config.feature`, `istio_config_type_filters.feature`, `istio_config_validation_filters.feature`, …

### Step definitions (`frontend/cypress/integration/common/`)

Shared step implementation files (one per feature area):

`app_details.ts`, `apps.ts`, `authorization.ts`, `graph.ts`, `graph_display.ts`, `graph_find_hide.ts`, `graph_side_panel.ts`, `graph_toolbar.ts`, `hooks.ts`, `istio_config.ts`, `istio_config_editor.ts`, `kiali_login.ts`, `kiali_logout.ts`, `mesh.ts`, `namespaces.ts`, `navigation.ts`, `overview.ts`, `services.ts`, `sidecar_injection.ts`, `table.ts`, `workloads.ts`, `waypoint.ts`, `wizard_istio_config.ts`, `wizard_request_routing.ts`, …

`hooks.ts` provides Cucumber `Before`/`After` hooks (login, namespace setup) shared across all features.

### CI test scripts

`npm run cypress:run` runs three segments in sequence: `@crd-validation`, `@core-1 or @core-2`, and `@perses`. The full set of CI scripts also covers `@ambient`, `@waypoint`, `@waypoint-tracing`, `@ambient-multi-primary`, `@waypoint-multicluster`, `@ai-chatbot`, `@multi-cluster`, `@multi-primary`, `@external-kiali`, and more. JUnit XML reports are generated with `cypress-multi-reporters` via the `:junit` variants of each script.

### Gherkin Lint

Feature files are validated at commit time by `gherkin-lint` (v4.2.4, separate from Cypress itself).

**Config:** [frontend/.gherkin-lintrc](frontend/.gherkin-lintrc) — a flat JSON object of rule → `"on"/"off"`.

Rules that are **ON** (enforced):

| Rule | What it catches |
|---|---|
| `no-files-without-scenarios` | `.feature` file with no `Scenario` or `Scenario Outline` |
| `no-unnamed-features` | `Feature:` keyword with no name |
| `no-unnamed-scenarios` | `Scenario:` / `Scenario Outline:` with no name |
| `no-partially-commented-tag-lines` | Lines mixing `@tag` and `# comment` — Gherkin parser silently drops the tag |
| `no-empty-file` | Zero-byte feature files |
| `no-scenario-outlines-without-examples` | `Scenario Outline` block with no `Examples:` table |
| `no-empty-background` | `Background:` block with no steps |

All **formatting** rules are OFF (`indentation`, `no-trailing-spaces`, `no-multiple-empty-lines`, `new-line-at-eof`) — Prettier handles whitespace uniformly via the pre-commit hook, and mixing two formatters for the same concern caused conflicts.

`allowed-tags`, `no-restricted-tags`, `no-dupe-scenario-names`, `no-dupe-feature-names`, `use-and`, `no-homogenous-tags`, `no-superfluous-tags` are all OFF — tag governance is enforced by convention and CI tag-filter scripts rather than the linter.

**When it runs:**

- `npm run lint:gherkin` — runs `gherkin-lint cypress/integration/featureFiles` (54 `.feature` files).
- `npm run pre-commit` — runs `prettier-quick --staged`, `lint:precommit` (ESLint on staged `.tsx?`), **`lint:gherkin`**, and `format:precommit` in that order. All four must pass or the commit is rejected.

**Separation of concerns** — `gherkin-lint` validates Gherkin syntax/structure at commit time. `@badeball/cypress-cucumber-preprocessor` (used in `cypress.config.ts`) parses the same `.feature` files at test runtime and binds steps to TypeScript step-definition functions via `Given`/`When`/`Then` from the preprocessor. They operate independently: `gherkin-lint` never executes tests; the preprocessor never enforces structural rules.
