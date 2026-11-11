# i18n conventions for Kiali UI translations

This document defines shared translation conventions for Kiali UI locale files, especially:

- `frontend/public/locales/es/translation.json`
- `frontend/public/locales/fr/translation.json`
- `frontend/public/locales/ja/translation.json`
- `frontend/public/locales/ko/translation.json`
- `frontend/public/locales/zh/translation.json`

The English catalog (`frontend/public/locales/en/translation.json`) is generated locally by `yarn i18n` and is not committed. English UI text is the i18n key; runtime `fallbackLng: 'en'` displays the key when no English file is present. Commit only translated catalogs.

It is intentionally written in English so contributors, reviewers, and AI assistants can align on the same terminology.

The core principles and general rules apply to every locale. Language-specific conventions supplement those shared rules only for the named language; other locales follow the [default conventions](#default-conventions-for-other-locales).

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

For every locale (`es`, `fr`, `ja`, `ko`, `zh`, and future languages):

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
- `host` -> `host` / `hosts`
- `hostname` -> `nombre de host` / `nombres de host`
- `HTTP Cookie` -> `cookie HTTP`
- `zoom` -> `zoom`
  - Keep the established borrowed term, as in `Zoom del gráfico`

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

Additional French UI terms:

- `host` / `hosts` -> `hôte` / `hôtes`
- `hostname` / `hostnames` -> `nom d’hôte` / `noms d’hôte`
- `HTTP Cookie` -> `cookie HTTP`
- `span` / `spans` -> `span` / `spans` for tracing
- `rule` / `rules` -> `règle` / `règles` in human-readable captions
- `consistent hash` -> `hachage cohérent`
- `traffic shifting` -> `répartition du trafic`
- `bytes` / `kilobytes` -> `octets` / `kilooctets` in prose; keep unit symbols such as `bps`, `kps`, and `KiB` unchanged

These choices apply to UI wording, not literal API fields, expressions, or resource kinds. For example, translate `Destination Rule` as `Règle de destination` and `Virtual Service` as `Service virtuel`, while preserving `DestinationRule`, `VirtualService`, `hosts`, and other literal API tokens when used as identifiers.

### French UI style

- Prefer short, neutral wording that works across French variants
- Prefer infinitive or impersonal UI phrasing (`Sélectionner`, `Filtrer par namespace`)
- Prefer `vous` over `tu` when a personal form is needed
- Use French punctuation in UI prose; preserve punctuation inside literal technical expressions
- Rephrase if a sentence becomes awkward after keeping a technical term in English
- Use `Depuis {{duration}}` for the recent-duration caption and `État du trafic (depuis {{duration}})` for its traffic-status heading; this neutral construction works with abbreviated durations in every plural form
- Use French plural agreement for `_other` and `_many` values, even when the English default value is singular

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

## Japanese conventions (`ja`)

### Canonical term choices

Use these consistently in Japanese UI strings:

- `namespace` -> `ネームスペース`
- `control plane` -> `コントロールプレーン`
- `data plane` -> `データプレーン`
- `mesh` -> `メッシュ`
- `workload` -> `ワークロード`

Keep the established technical names listed above in English, including resource kinds such as `ServiceEntry` and `VirtualService`.

Additional Japanese UI terms:

- `listener` -> `リスナー`; `server` -> `サーバー`; tracing `span` -> `スパン`
- `rule` -> `ルール`; `route rule` -> `ルーティングルール`
- `host` / `hostname` -> `ホスト` / `ホスト名`
- `HTTP Cookie` -> `HTTP クッキー`
- `egress` -> `エグレス`; `consistent hash` -> `コンシステントハッシュ`
- Human-readable `Destination Rule` / `Authorization Policy` / `Virtual Service` -> `宛先ルール` / `認可ポリシー` / `仮想サービス`
- Human-readable `Peer Authentication` / `Request Authentication` -> `ピア認証` / `リクエスト認証`
- Human-readable `Service Entry` / `Workload Entry` -> `サービスエントリー` / `ワークロードエントリー`
- TLS mode captions `Simple` / `Permissive` / `Strict` -> `シンプル` / `許容` / `厳格`; keep raw enum values unchanged

These are working choices based on Japanese usage, the English message and UI context, and Korean/Spanish references. They do not imply native-speaker approval. Literal API kinds, configuration fields, and Find operands retain their exact spelling; for example, translating a `Virtual Service` caption does not translate the `VirtualService` kind.

### Japanese UI style

- Prefer short, neutral UI wording
- Prefer polite `です` / `ます` for full sentences
- Prefer concise labels without sentence-ending particles when space is tight
- Use katakana for established cloud-native loanwords (`ネームスペース`, `ワークロード`, `メッシュ`)
- Rephrase if a sentence becomes awkward after keeping a technical term in English
- Use `過去 {{duration}}` for recent durations and `トラフィックステータス（過去 {{duration}}）` for the traffic-status heading; keep quoted help captions in sync
- Japanese cardinal plurals use `_other`, including for 0 and 1; a translated `_one` or `_many` entry does not supply the active caption
- In trace count labels, put the count before the noun so an existing filtered-count prefix remains readable (for example `1 / 2 件のスパン`)
- Use `名前解決方式` for ServiceEntry's `Resolution` caption; preserve `NONE`, `STATIC`, and `DNS` values
- Use `プロンプト` / `出力` for prompt/completion token captions, keeping unit symbols such as `M` unchanged

### Existing examples from `frontend/public/locales/ja/translation.json`

These entries match the preferred direction and are good references for future edits:

- `"Namespace": "ネームスペース"`
- `"Namespaces": "ネームスペース"`
- `"Filter by Namespace": "ネームスペースでフィルター"`
- `"Namespace Health": "ネームスペースのヘルス"`
- `"Control plane": "コントロールプレーン"`
- `"Data plane": "データプレーン"`
- `"Mesh": "メッシュ"`
- `"Waypoint": "Waypoint"`
- `"{{count}} workload_other": "{{count}} ワークロード"`

### Japanese do / do not

- Do: `コントロールプレーン`, `データプレーン`, `ネームスペース`, `メッシュ`, `ワークロード`
- Do not: alternate with `名前空間`, `網目`, or `負荷`

## Korean conventions (`ko`)

These working conventions follow existing Korean usage, current English, and UI
composition. They do not imply native-speaker validation.

- Use `스팬` for tracing spans, consistent with the existing `Spans` and span-detail captions.
- Korean cardinal plurals use `_other`, including for 0 and 1. Preserve existing inactive plural variants; they do not supply the active caption.
- For trace labels prefixed with a filtered count, put `{{count}}` before the noun so the complete label remains readable: `1 / 2개 스팬`, `1 / 2개 관련 앱`, and `1 / 2개 오류 포함 스팬`. This convention applies to those composed labels, rather than prescribing word order for all Korean text.

## Simplified Chinese conventions (`zh`)

These working conventions follow the existing Simplified Chinese catalog,
current English, and UI composition. They do not imply native-speaker validation.

- Use Simplified Chinese wording and natural Chinese sentence order, consistent with existing translations.
- Chinese cardinal plurals use `_other`, including for 0 and 1. Preserve existing inactive plural variants; they do not supply the active caption.
- In Graph summary count fragments, the caller supplies the number: `host` / `hosts` use `个主机`, and `workload entry` / `workload entries` use `个工作负载条目`, producing `2 个主机` and `2 个工作负载条目`. Standalone headings use `主机` and `工作负载条目` without the measure word. Check the call site before reusing these values; literal API fields such as `hosts` remain unchanged.
- Use Chinese punctuation such as `“…”` and `（…）` in prose outside protected tokens. The parenthesized cluster suffix does not need an English leading space; verify complete messages and preserve spacing required in other contexts.

## Default conventions for other locales

Locales without their own conventions use the core principles and general rules above.

- Use natural grammar and established technical UI terminology in the target language, consistent with existing translations in that locale.
- Preserve the globally protected names and tokens, but do not apply Spanish-only choices such as keeping `namespace`, `mesh`, or `workload` in English to other languages.
- Follow the shared [Find help: `Abbreviate:` strings](#find-help-abbreviate-strings-all-locales) rules, translating the introductory label while preserving the operands.
- Record unresolved terminology for review by someone proficient in the target language. Add a language-specific section when the team agrees on terminology or style rules beyond these defaults.

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
