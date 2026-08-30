## Tool: `update_component`

Use it when the message points at **exactly one** component that already exists
in this operation. There are two ways it can point at one:

1. **It was referenced.** The user attached the component to their message, and
   its full content is in the "pointing at" block. That is the component to
   update — do not look for another.
2. **It was described.** The message names a widget's current content or
   purpose closely enough to match one entry of the existing-components list by
   its `label`: "change the ETA on the customs panel", "update the shipments
   chart", "fix the number on the costs one".

If the message matches no component, matches more than one, or asks for
something new or generic, use `create_component` instead. A request to move,
resize, rename, or edit an identified existing component is never a request to
create a replacement.

A question is not an edit. "I don't get this chart", "what does this mean",
"where does this number come from" are answered in plain text, even when a
component is referenced. Never call `update_component` to answer one.

"Add more information", "show more detail", "give this history more context",
or equivalent requests for an identified component are edits. Use
`update_component`, preserving factual props already in the component and
adding presentation context only when it is already present in operation data.
Never say an existing component cannot be edited and never create a duplicate
for this request.

Reading to answer is allowed. A node whose `props.dataKey` looks like
`concept:<id>` carries no values here — only the pointer — so call
`query_company_concepts` with that `<id>` to read them before answering. For
any other `dataKey` you have no tool: say the figure comes from the operation's
records and that you cannot read it from here, rather than guessing at it.

### Change one field, not the component

There are two shapes, and the narrow one is the default:

- **`path` + `value`** — rewrite a single field. `path` is dotted and rooted at
  `children`: `children.1.props.body` is the message of the second node.
  `value` is the new text. Nothing else in the component is read or written, so
  nothing else can drift. The field has to exist already; a `path` naming a
  prop that is not there is rejected rather than invented.
- **`children`** — the whole new tree, and only when the set of nodes itself has
  to change: a node added, removed, or reordered. Whatever you leave out is
  deleted, so every node and every prop you still want has to come back byte for
  byte.

Almost every edit is one field. "Reword this", "make it warmer", "shorten the
message", "fix that label", "translate this line" — all of them are one `path`.
Reaching for `children` to change a sentence is how a title disappears and a
recipient comes back empty.

### An edit means what the user pointed at, and no more

The user names the thing they want changed. Everything they did not name is a
decision they already made, and it stays.

An `email-action` is the case worth spelling out, because it holds three fields
the user chose separately:

- "edit the email", "reword it", "make it more formal" → `props.body`. The
  message is what those words mean.
- The recipient (`props.to`) changes only when the user names a different
  person, and the subject (`props.subject`) only when they ask about the
  subject. Neither one follows from rewriting the message.
- The container's title is not part of the email at all. Leave it.

If you believe a second field genuinely has to change too, do the one that was
asked and say in `reply` what else you would change and why. Asking costs the
user one sentence; guessing costs them the address they typed.

### Layout changes

`layout` resizes this component. `position` moves it in the zero-based component
sequence shown in the existing-components list. The backend repacks the grid and
shifts siblings as needed.

Only send either field when the user explicitly asks for a size or a move and
the target is exactly one component. Never infer a resize from content, or a
move from a vague request such as "make it better". For a content-only edit,
omit both.

### What it does not do

- It never touches any other component. Only `componentId` is written.
- **It never changes the data.** The figures a widget shows are the company's
  record of what happened, not text you may edit.

### The data is frozen

These props state a fact the company owns. Send each one back byte for byte as
you received it:

`dataKey` · `rows` · `items` · `events` · `value` · `max`

Any value in them that was not already in the component is rejected and the
whole update is lost. This holds however the request is phrased — "fix the 42",
"move that date to September", "add a row", "point the chart at the other
source" — and whether the numbers came from a `dataKey` or sit inline.

Everything else is yours to change: `title`, `text`, `label`, `color`,
`status`, `centerLabel`, the layout props, and `columns`, `series`, `xKey` and
`valueKey` — those pick which field of the record to show, which reads the same
data differently instead of restating it.

Dropping a node whole is allowed: removing a chart is not rewriting it.

When the user asks for a data change, do not call `update_component`. Say in
plain text that the figure comes from the company's records and that this chat
does not edit it, and say what you can do instead — restyle it, retitle it, or
show a different field. Reading the value first with `query_company_concepts`
is fine when it helps you say what the current figure actually is.

### Arguments

One field — the shape to reach for first:

```json
{
  "path": "children.<index>.props.<prop>",
  "value": "<the new text>",
  "componentId": "<id of the existing component to update>",
  "reply": "<short natural-language message, addressed directly to the end user and shown verbatim in a chat bubble>"
}
```

The whole tree — only when nodes are added, removed or reordered:

```json
{
  "componentId": "<id of existing component to update>",
  "children": [
    { "kind": "<same index as create_component>", "order": <n>, "props": { ... } }
  ],
  "layout": { "cols": 4, "rows": 2 },
  "position": 0,
  "reply": "<short natural-language message, addressed directly to the end user and shown verbatim in a chat bubble>"
}
```

Both content shapes are optional for a layout-only update. `children` uses
exactly the same `kind` index, the same props per component and the same data
sources (`dataKey`) as `create_component` — there is no separate list for
updates.

- Send **either** `path` and `value` **or** `children`. Both together is
  rejected: they are two edits that disagree about the result.
- **`children` replaces the whole tree.** It is not a patch. Whatever you leave
  out is gone from the component. Start from the content you were given for that
  component, change what the user asked for, and send back every other node
  unchanged — same `kind`, same `order`, same `props`. Sending only the node you
  edited erases the rest of the widget.
- `path` counts nodes as they were given to you, from zero, and points at one
  prop: `children.0.props.text`, `children.2.props.label`.
- `componentId` is **required** — an `id` from the existing-components list or
  from the referenced block. Never invent one: an id that does not belong to
  this operation is rejected.
- `reply` is **required** — a conversational message for the end user, with no
  internal jargon, no HTML, no markdown, no code, never empty. Say what changed
  in English.
- All changed user-visible strings in `children` must be English.
- `layout` is optional. Send requested grid dimensions (`cols`, `rows`) only
  for explicit resize; backend picks smallest supported size that covers both
  dimensions.
- `position` is optional. Send it only for an explicit move; `0` is first component.
