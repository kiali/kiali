# i18n conventions for Kiali UI translations

This document defines shared translation conventions for Kiali UI locale files, especially:

- `frontend/public/locales/es/translation.json`
- `frontend/public/locales/fr/translation.json`
- `frontend/public/locales/ko/translation.json`
- `frontend/public/locales/zh/translation.json`

The English catalog (`frontend/public/locales/en/translation.json`) is generated locally by `yarn i18n` and is not committed. English UI text is the i18n key; runtime `fallbackLng: 'en'` displays the key when no English file is present. Commit only translated catalogs.

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

When the UI text is exactly the same as the English **API kind** or product name (for example `Envoy`, `DestinationRule`), **do not wrap it in `t()`**. Use a string literal so `i18next-parser` does not extract it into `translation.json`.

**Human-readable labels** that describe a kind but are not the kind string itself (for example `Destination Rule` with a space, `Authorization Policy`) **should use `t()`** and **should be translated** in locale catalogs. Do not confuse them with `DestinationRule` / `AuthorizationPolicy` in YAML.

Remove redundant `key: key` catalog lines only for literals that are not passed through `t()`.

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

### Find help: `Abbreviate:` strings (all locales)

Traffic Graph and Mesh Find help (`GraphHelpFind.tsx`, `MeshHelpFind.tsx`) includes usage notes whose i18n keys start with `Abbreviate:`. They document shorthand operands users type in the Find box (for example `cb|circuitbreaker`).

For every locale (`es`, `ko`, `zh`, and future languages):

- Translate only the label word that corresponds to English `Abbreviate` (plus the punctuation that follows it in that language).
- Keep the entire `alias|operand` list unchanged, in English, including commas and pipe characters.

Examples:

- `es`: `"Abbreviate: ns|namespace, …": "Abreviar: ns|namespace, …"`
- `zh`: `"Abbreviate: ns|namespace, …": "缩写：ns|namespace, …"`

Leaving the value identical to the English key is acceptable for operands but leaves the help intro untranslated; prefer localizing the label as above.

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
- `listener` -> `Listener` / `Listeners`
  - Keep in English: Gateway API spec field (`spec.listeners`)
  - Do not use `escucha`, `oyente`, or other Spanish variants
- `server` -> `Server` / `Servers`
  - Keep in English: Istio Gateway form field for listener endpoints
  - Same rule as `Listener`: API/form field name, not a generic word
  - Exception: `Server Certificate` -> `Certificado del servidor` (only the descriptive word is translated)

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
- `"Listeners": "Listeners"`
- `"Listener List": "Lista de Listeners"`
- `"Servers": "Servers"`
- `"Server List": "Lista de Servers"`
- `"Abbreviate: ns|namespace, svc|service, …": "Abreviar: ns|namespace, svc|service, …"` (see [Find help: `Abbreviate:` strings](#find-help-abbreviate-strings-all-locales))

### Spanish do / do not

- Do: `plano de control`, `plano de datos`, `namespace`, `mesh`, `workload`, `Listener`, `Server`
- Do not: `espacio de nombres`, `malla`, translated variants of `workload`, `escucha` / `oyente` for `Listener`, `servidor` for Gateway form `Server` / `Servers`

Note: the current Spanish locale is only partially aligned. In particular, some existing entries still translate `Workload` as `Carga de trabajo` / `Cargas de trabajo`. Treat the conventions in this file as the preferred direction for future edits.

## French conventions (`fr`)

### Canonical term choices

Use these consistently in French UI strings:

- `namespace` -> `namespace` / `namespaces`
  - Avoid `espace de noms` in technical UI text
- `control plane` -> `plan de contrôle`
- `data plane` -> `plan de données`
- `mesh` -> `mesh` / `meshes`
  - Avoid `maillage`
- `workload` -> `workload` / `workloads`
  - Avoid alternating with `charge de travail`
- `listener` -> `Listener` / `Listeners`
  - Keep in English: Gateway API spec field (`spec.listeners`)
- `server` -> `Server` / `Servers`
  - Keep in English: Istio Gateway form field for listener endpoints
  - Exception: `Server Certificate` -> `Certificat du serveur` (only the descriptive word is translated)

Keep the established technical names listed above in English, including resource kinds such as `ServiceEntry` and `VirtualService`.

### French UI style

- Prefer short, neutral wording that works across French variants
- Prefer infinitive or impersonal UI phrasing (`Sélectionner`, `Filtrer par namespace`)
- Prefer `vous` over `tu` when a personal form is needed
- Use standard UI punctuation; do not require a space before `:`, `;`, `!`, or `?`
- Rephrase if a sentence becomes awkward after keeping a technical term in English

### Existing examples from `frontend/public/locales/fr/translation.json`

These entries match the preferred direction and are good references for future edits:

- `"Namespace": "Namespace"`
- `"Namespaces": "Namespaces"`
- `"Filter by Namespace": "Filtrer par namespace"`
- `"Namespace Health": "Santé du namespace"`
- `"Control plane": "Plan de contrôle"`
- `"Data plane": "Plan de données"`
- `"Mesh": "Mesh"`
- `"Waypoint": "Waypoint"`
- `"{{count}} workload_other": "{{count}} workloads"`
- `"Listeners": "Listeners"`
- `"Servers": "Servers"`

### French do / do not

- Do: `plan de contrôle`, `plan de données`, `namespace`, `mesh`, `workload`, `Listener`, `Server`
- Do not: `espace de noms`, `maillage`, translated variants of `workload`

## Chinese conventions (`zh`, Simplified Chinese)

TODO: validate the Chinese glossary and wording with a native speaker or a reviewer confident in Simplified Chinese technical UI translation. The current `zh` locale is inconsistent and still contains many untranslated English strings.

For `Abbreviate:` Find help lines, follow [Find help: `Abbreviate:` strings](#find-help-abbreviate-strings-all-locales) (for example `缩写：` in `zh`).

## When editing locale files

Before changing `translation.json` entries:

1. Check whether the term already exists elsewhere in the same locale.
2. Prefer the canonical term from this document over a new synonym.
3. Preserve placeholders and technical tokens exactly.
4. Keep resource names and product names in English.
5. If a string must diverge for readability, choose the smallest deviation and keep it consistent nearby.
6. After bulk edits, run `cd frontend && yarn i18n` so committed catalogs use the same key order as `i18next-parser` (`sort: true` in `i18next-parser.config.ts`). Do not hand-reorder keys or use a separate sort script.

## When in doubt

Prefer consistency with this document over a more literal translation. If a new term seems important enough to become a convention, update this file in the same pull request so the shared glossary stays current.
