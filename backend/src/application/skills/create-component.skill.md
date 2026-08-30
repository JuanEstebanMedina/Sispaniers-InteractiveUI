## Tool: `create_component`

Use this tool only when user explicitly asks for dashboard view/component, or
when a component materially improves tracking active operation. Do not call it
for greetings, questions answerable from context, unclear requests, or missing
data. Ask focused follow-up question when needed.

When a component is warranted, use `create_component` unless user explicitly
and unambiguously says they want to modify, update, change or replace an
existing component (see `update_component`). Generic requests for a new view
use `create_component`, even if other components already exist.

If user references a component ambiguously, ask which component they mean;
never create one solely to avoid clarification.

### Arguments

```json
{
  "children": [
    { "kind": "<one from the index below>", "order": <n>, "props": { ... } }
  ],
  "layout": { "cols": <n>, "rows": <n> },
  "priority": "<normal|high|critical>",
  "reply": "<short natural-language message, addressed directly to the end user and shown as-is in a chat bubble>"
}
```

- `layout` is **required** — it declares how many cells the component
  occupies in the `{{grid_columns}}`-column grid (see "Size" below).
- `reply` is **required** — a conversational message for the end user, no
  internal jargon, no HTML, no markdown, no code, never empty.
- Don't compute position (`x`, `y`) — the backend assigns that when it
  inserts the event; you only declare the size.
- `priority` is optional. Omit it for routine information; use `high` for a
  decision or delay requiring attention, `critical` for an immediate material
  risk. The frontend colors the component border from it.

---

## Component index

`kind` must be EXACTLY one of these 18 values, never invent others — any
other value is rejected.

| `kind` | Is | Use it when |
|---|---|---|
| `title` | short heading | naming a section inside a `layout` |
| `label` | secondary text, one line | short clarification under another node |
| `stat` | a big number + label | one single figure that matters |
| `trend-chart` | time series with axes | something evolves over time |
| `category-chart` | bars with axes | comparing categories against each other |
| `breakdown-chart` | donut with a total at the center | share of parts within a total |
| `sparkline` | quiet mini trend with a light grid and a value axis, no legend | a trend that doesn't need a full chart's legend |
| `map` | live map with a marker per vessel | position of a shipment matters |
| `table` | rows in columns | listing rows to scan side by side |
| `key-values` | label/value pairs | loose fields extracted from a document |
| `timeline` | sequence of events with status | history of what happened, in order |
| `progress` | 0–max bar | progress toward a limit or a goal |
| `badge` | short status tag | flagging a one-word/short-phrase state |
| `file` | attachment card | showing a clickable document |
| `divider` | separator line | visually separating inside a `layout` |
| `button` | button — **inert, not wired up** | rarely; see warning below |
| `email-action` | proposed outbound email, user reviews & sends | the user needs to notify someone by email |
| `layout` | container that groups children | grouping 2+ nodes in a row or column |

Top-level nodes (the command's `children` array) already stack in a column
with a small gap automatically. Use `layout` only when you need a row,
different alignment, or different spacing — not just to group things that
already stack on their own.

---

## Each component: what it does, what to decide, what props to return

### `layout` — grouper

The only `kind` that can carry `children`.

- **Decide**: `direction` (`"row"` to place children side by side,
  `"column"` to stack them — default `"column"`), and optionally `gap`,
  `align`, `justify` if the default spacing isn't enough.
- **Props**: `direction?` (`row`|`column`), `gap?` (`none`|`xs`|`sm`|`md`|`lg`,
  default `sm`), `align?` (`start`|`center`|`end`|`stretch`, default
  `stretch`), `justify?` (`start`|`center`|`end`|`between`, default `start`),
  `wrap?` (boolean).
- **Returns**: `{ "kind": "layout", "order": n, "props": {...}, "children": [...] }`.
  Maximum 4 levels of nesting total, counting the root.

### `title` — section heading

- **Decide**: the exact text to show; it is not the title of the whole
  widget (the operation's layout already handles that), it's an internal
  subheading.
- **Props**: `text` (string), `tone?` (`default`|`muted`|`agent`|`accent`).

### `label` — secondary text

- **Decide**: a short, one-line clarification.
- **Props**: `text` (string), `tone?` (`default`|`muted`|`agent`|`accent`,
  default `muted`).

### `stat` — one figure

- **Decide**: which single number matters. Format the value yourself as
  readable text (`"24"`, `"3.2 days"`, `"USD 12,480"`) — don't send a raw
  JSON number expecting the frontend to format it, because `value` is read
  as a string and the wrong type is silently dropped.
- **Props**: `value` (string), `label?` (string), `tone?` (`default`|`muted`|
  `agent`|`accent`).

### `trend-chart` / `category-chart` — charts with axes

Same props shape for both; the difference is line (`trend-chart`) vs bars
(`category-chart`). They need at least `small` (2×2) to be legible —
**never** end up in `tile` or `banner`, those are rejected.

- **Decide**: which `dataKey` supplies the rows (see the data-source table
  below), which field of each row goes on the X axis (`xKey`), and which
  field(s) get plotted as series.
- **Props**: `dataKey` (one of the 6 valid values), `title?` (string, shown
  as the chart's own heading — no need for a separate `title` node above
  it), `xKey?` (string, default `"x"`), `series` (array of
  `{ "key": string, "label"?: string, "colorIndex"?: 0-7 }` — `key` is the
  field of each row to plot; without `key` that series is dropped).

### `breakdown-chart` — donut with a total

- **Decide**: which `dataKey` supplies rows shaped `{ name, value }` — it
  doesn't need `series` or `xKey`, it always plots `name`/`value` and sorts
  largest to smallest.
- **Props**: `dataKey`, `title?`, `centerLabel?` (string, default `"Total"`
  — the total is computed on its own, summing `value` across all rows).
- Best source: `containers-by-state` (already comes with `name`/`value`).

### `sparkline` — mini trend

- **Decide**: use this instead of `trend-chart` when you want a quieter
  version of the same idea — it still shows a value axis and a light grid,
  just no legend and no X-axis labels.
- **Props**: `dataKey`, `valueKey?` (string, default `"value"` — the field
  of each row to plot).

### `map` — live vessel positions

Needs at least `small` (2×2) to be legible — **never** ends up in `tile` or
`banner`, those are rejected.

- **Decide**: this only makes sense when a booking actually has a reported
  position — best (and usually only) source is `vessel-positions`.
- **Props**: `dataKey` (one of the 6 valid values), `title?` (string).

### `table` — rows in columns

- **Decide**: which columns to show and where the rows come from — inline
  (`rows`, hand-built rows) or from a named source (`dataKey`). If you send
  `rows` with data, that wins over `dataKey`.
- **Props**: `columns` (array of `{ "key": string, "label"?: string }` — the
  `key` must exist as a field on the rows it will display), `rows?` (array
  of objects, inline), `dataKey?` (one of the 6 valid values).
- Without `columns` nothing renders.

### `key-values` — loose pairs

- **Decide**: use this for fields extracted from a document (booking, BL,
  invoice) — unlike `table`, there are no columns or repeated rows, just
  label/value pairs.
- **Props**: `items` (array of `{ "label": string, "value": string|number }`
  — an entry without `label` is dropped).

### `timeline` — chronological sequence

- **Decide**: inline (`events`, with a status colored per event) or
  `dataKey` (faster, but every event comes out with a fixed `neutral`
  status — use `events` inline if you need to color different statuses).
- **Props**: `events?` (array of `{ "text": string, "at"?: string, "status"?:
  one of the 7 statuses below }`, default `neutral`), `dataKey?` (one of the
  6 valid values — best source: `schedule-changes`).
- With no events (neither inline nor via `dataKey`) nothing renders.

### `progress` — advancement

- **Decide**: which value and which max. It clamps itself between 0% and
  100%, you don't need to limit it yourself.
- **Props**: `value` (number), `max?` (number, default `100`), `label?`
  (string), `status?` (one of the 7 statuses below, default `brand`).

### `badge` — one-off status

- **Decide**: one word or a very short phrase, not a sentence.
- **Props**: `text` (string), `status?` (one of the 7 statuses below,
  default `neutral`).

**The 7 valid `status` values** (for `badge`, `progress` and `timeline`):
`neutral`, `brand`, `accent`, `success`, `warning`, `danger`, `info`.

### `file` — attachment

- **Decide**: if you know the format, send it explicitly in `type`;
  otherwise it's inferred from the extension in `name`. If you have a real
  URL, the card becomes clickable — without `url` it stays static (never
  send a made-up URL).
- **Props**: `name?` (string, default `"Archivo"`), `type?` (one of:
  `pdf`|`word`|`excel`|`csv`|`powerpoint`|`image`|`archive`|`code`|`file`, or
  inferred from the extension), `size?` (free string, e.g. `"2.4 MB"`),
  `at?` (free string, e.g. a date), `url?` (string).

### `divider` — separator

- No props. Only makes sense inside a `layout`.

### `button` — warning

Renders **disabled**: the action exists as vocabulary but isn't wired to
anything yet. Use it sparingly and never say in the `reply` that the button
"does" something — that would be false.

- **Props**: `label?` (string, default `"Acción"`).
- **Separate field** (not inside `props`): `action`, one of `navigate`,
  `confirm`, `reject`, `export`, `refresh` — required on this `kind`.

### `email-action` — proposed email, human sends it

The **one** interactive kind in this system — everything else is inert. It
does NOT send anything by itself: it shows an editable draft, and a human
has to review it (and may change any field) before clicking send. Because of
that, it's fine to use even though rule 2 (in the system prompt) forbids
claiming an action was taken — nothing has been sent yet when you return
this.

- **Decide**: fill in whatever you actually know. Leave `to` empty when you
  don't have a real recipient — never invent an email address. `subject`
  and `body` can be a reasonable draft even if incomplete; the human edits
  it before sending.
- **Props**: `to?` (string, proposed recipient), `subject?` (string,
  proposed subject), `body?` (string, proposed message).
- **Your `reply` must say, explicitly**: that you cannot send the email
  yourself, and that you've generated this component so the user can edit
  the recipient and/or message and send it themselves. Never say or imply
  the email was sent, is being sent, or that sending it is automatic.
- Ask for `tall` (2×4) — it holds three fields plus a multi-line message
  with room to actually read and edit it. `small` fits the fields but
  crams the body into a couple of lines; only reach for `large` if you're
  also pairing it with other nodes in the same component.

---

## Data sources (`dataKey`)

Only these 6 values are valid in any `dataKey` — any other is rejected. Each
row carries exactly these fields:

| `dataKey` | one row is | fields available |
|---|---|---|
| `containers` | a container | `id`, `state`, `vessel`, `carrier` |
| `bookings` | a booking | `id`, `carrier`, `vessel`, `origin`, `destination`, `containers` (count) |
| `documents` | a received document | `id`, `name`, `type`, `received`, `value` |
| `containers-by-state` | a container state, aggregated | `name`, `x`, `value`, `count` |
| `schedule-changes` | an ETA change | `x`, `at`, `text`, `value` (days late vs. the original ETA as of this change), `booking` |
| `vessel-positions` | a booking with a reported position | `bookingId`, `vessel`, `carrier`, `lat`, `lng`, `updatedAt` |

A booking with no reported position yet is absent from `vessel-positions`
entirely — it doesn't show up as a row with empty coordinates.

A `dataKey` not on this list is rejected and the step is retried. An `xKey`,
`series[].key`, or `columns[].key` that doesn't match any of these fields
doesn't break anything, but the widget comes out empty or incomplete —
check this table before naming a field.

## Size (the command's `layout`, not to be confused with `kind: "layout"`)

You request `cols`/`rows` as numbers; the backend snaps them to the nearest
grid size on this list:

| name | cols×rows |
|---|---|
| `tile` | 1×1 |
| `small` | 2×2 |
| `banner` | 4×1 |
| `tall` | 2×4 |
| `wide` | 4×2 |
| `large` | 4×4 |

**`tile` (1×1) is off limits for every kind, no exceptions.** One cell is
about 132px — a `stat`, a `badge`, a `sparkline`, anything at all in that
little space renders but nobody can read it. `small` (2×2) is the smallest
size any component may ever request.

Charts and the map need more than area — they need height for an axis, a
legend or a marker to read, so `banner` (4×1) is off limits for them too.

| `kind` | never fits |
|---|---|
| `trend-chart`, `category-chart`, `breakdown-chart`, `map` | `tile`, `banner` |
| every other kind | `tile` |

A component whose children include a node that doesn't fit the requested
size is rejected outright, not shrunk or silently accepted — pick a size
that fits every node in `children`, worst case first.

Always use the smallest allowed size that communicates the full information.
