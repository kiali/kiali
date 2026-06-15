# i18n conventions for Kiali UI translations

This document defines shared translation conventions for Kiali UI locale files, especially:

- `frontend/public/locales/es/translation.json`
- `frontend/public/locales/zh/translation.json`

It is intentionally written in English so contributors, reviewers, and AI assistants can align on the same terminology.

If an existing locale entry conflicts with these conventions, do not mass-rewrite the whole file. Apply these rules to new or edited strings and improve consistency opportunistically.

## Related documentation

- `frontend/README.adoc#internationalization-i18n`
- `CONTRIBUTING.md#internationalization`

## Core principles

- Prefer technical accuracy and consistency over literal translation.
- Use short, neutral UI wording.
- Preserve placeholders, interpolation variables, and technical tokens exactly as written.
- Keep code, CLI flags, API fields, filenames, paths, resource kind names, and YAML/JSON keys unchanged.
- Once a preferred term is chosen for a locale, keep using it instead of alternating between synonyms.

## General rules

### Keep these unchanged in all locales

Keep product names, feature names, and established technical names in English:

- `Kiali`
- `Istio`
- `Ambient`
- `Waypoint`
- `Sidecar`
- `Gateway`
- `ServiceEntry`
- `VirtualService`
- `DestinationRule`
- `PeerAuthentication`
- `RequestAuthentication`
- `AuthorizationPolicy`
- `Prometheus`
- `Grafana`
- `Envoy`
- `ztunnel`
- `OpenShift`
- `Kubernetes`

### Preserve tokens and formatting

Do not translate or alter:

- placeholders such as `{{count}}`, `{{namespace}}`, `{{clusterName}}`
- rich-text markers such as `<1>...</1>`
- units and protocol strings such as `RPS`, `HTTP`, `TCP`, `mTLS`, `%`
- literal values, identifiers, or config fields such as `ALLOW_ANY`, `REGISTRY_ONLY`, `meshConfig.outboundTrafficPolicy.mode`
- file paths, URLs, commands, and code blocks

Keep whitespace and punctuation around placeholders intact unless the locale requires a punctuation change outside the placeholder itself.

### UI style

- Prefer concise labels: `View Mesh`, `Filter by namespace`, `Control plane`
- Prefer neutral wording over region-specific phrasing
- Prefer direct error messages: `Could not load`, `Not found`, `Unavailable`
- Avoid over-translating domain concepts when the English term is already the clearest term in the Istio/Kubernetes ecosystem

## Spanish conventions (`es`)

### Canonical term choices

Use these consistently in Spanish UI strings:

- `namespace` -> `namespace` / `namespaces`
  - Avoid `espacio de nombres` in technical UI text
- `control plane` -> `plano de control`
- `data plane` -> `plano de datos`
- `mesh` -> `mesh` / `meshes`
  - Avoid `malla`
- `workload` -> `workload` / `workloads`
  - Avoid alternating with translated variants

Keep the established technical names listed above in English, including resource kinds such as `ServiceEntry` and `VirtualService`.

### Spanish UI style

- Prefer short, neutral wording that works across Spanish variants
- Prefer impersonal or neutral UI phrasing when practical
- Avoid switching voice unnecessarily inside the same area of the UI
- Rephrase if a sentence becomes awkward after keeping a technical term in English

### Existing examples from `frontend/public/locales/es/translation.json`

These entries already match the preferred direction and are good references for future edits:

- `"Namespace": "Namespace"`
- `"Namespaces": "Namespaces"`
- `"Filter by Namespace": "Filtrar por namespace"`
- `"Namespace Health": "Salud del namespace"`
- `"Control plane": "Plano de control"`
- `"Data plane": "Plano de datos"`
- `"Mesh": "Mesh"`
- `"Waypoint": "Waypoint"`
- `"{{count}} workload_other": "{{count}} workloads"`

### Spanish do / do not

- Do: `plano de control`, `plano de datos`, `namespace`, `mesh`, `workload`
- Do not: `espacio de nombres`, `malla`, translated variants of `workload`

Note: the current Spanish locale is only partially aligned. In particular, some existing entries still translate `Workload` as `Carga de trabajo` / `Cargas de trabajo`. Treat the conventions in this file as the preferred direction for future edits.

## Chinese conventions (`zh`, Simplified Chinese)

TODO: validate the Chinese glossary and wording with a native speaker or a reviewer confident in Simplified Chinese technical UI translation. The current `zh` locale is inconsistent and still contains many untranslated English strings.


## When editing locale files

Before changing `translation.json` entries:

1. Check whether the term already exists elsewhere in the same locale.
2. Prefer the canonical term from this document over a new synonym.
3. Preserve placeholders and technical tokens exactly.
4. Keep resource names and product names in English.
5. If a string must diverge for readability, choose the smallest deviation and keep it consistent nearby.

## When in doubt

Prefer consistency with this document over a more literal translation. If a new term seems important enough to become a convention, update this file in the same pull request so the shared glossary stays current.
