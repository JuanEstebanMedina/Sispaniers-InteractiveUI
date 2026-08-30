import {
  ACTION_KINDS,
  ATOMIC_NODE_KINDS,
  type ActionKind,
  type AtomicNodeKind,
  DATA_SOURCE_NAMES,
  LAYOUT_DIRECTIONS,
  NESTABLE_ATOMIC_NODE_KINDS,
} from "../enums/widget-kind.js";
import { MAX_COMPONENT_NODE_DEPTH } from "./component-node.js";
import { WIDGET_SIZES, type WidgetSizeName, fitsChart } from "./widget-size.js";

const STATUS_TONES = "neutral | brand | accent | success | warning | danger | info";

export interface NodeSpec {
  purpose: string;
  props: Record<string, string>;
  example: Record<string, unknown>;
  nestable: boolean;
  action?: ActionKind;
}

/**
 * What each kind is for and which props reach the renderer.
 *
 * The kinds, the actions, the directions and the sizes are NOT restated here —
 * they are read from the enums the validator itself uses, so the catalogue
 * cannot offer the agent something the API will reject. Only the prop names
 * live here, because the wire schema accepts any `props` bag and the renderer
 * is the only thing that knows which keys it reads.
 */
const DATA_KEY_PROP = `string — one of ${DATA_SOURCE_NAMES.join(", ")}; it carries no rows itself`;

const NODE_SPECS: Record<AtomicNodeKind, Omit<NodeSpec, "nestable">> = {
  title: {
    purpose: "Heading of a widget. One per widget at most.",
    props: { text: "string — required", tone: "default | muted | agent | accent" },
    example: { text: "Vessel ETA", tone: "default" },
  },
  label: {
    purpose: "Secondary line of text: a caption, a source, an explanation.",
    props: { text: "string — required", tone: "default | muted | agent | accent" },
    example: { text: "Reported by the carrier on 2026-07-02", tone: "muted" },
  },
  stat: {
    purpose: "A single figure with its caption. The workhorse for numbers.",
    props: {
      value: "string — required, the figure itself",
      label: "string — what the figure measures",
      tone: "default | muted | agent | accent",
    },
    example: { value: "+7 days", label: "ETA delay", tone: "accent" },
  },
  button: {
    purpose: "Triggers one business action. Requires a top-level `action`.",
    props: { label: "string — required" },
    example: { label: "Notify client" },
    action: "navigate",
  },
  layout: {
    purpose: "Arranges its children in a row or a column. The only nestable kind.",
    props: {
      direction: `${LAYOUT_DIRECTIONS.join(" | ")} — defaults to column`,
      gap: "none | xs | sm | md | lg",
      align: "start | center | end | stretch",
      justify: "start | center | end | between",
      wrap: "boolean",
    },
    example: { direction: "row", gap: "md", justify: "between" },
  },
  "trend-chart": {
    purpose: "A value over time. Needs a dataset the host already provides.",
    props: {
      dataKey: DATA_KEY_PROP,
      title: "string",
      xKey: "string — the row field on the x axis, defaults to 'x'",
      series: "array of { key, label, colorIndex } — which columns to draw",
    },
    example: {
      dataKey: "schedule-changes",
      title: "ETA over time",
      xKey: "at",
      series: [{ key: "days", label: "Days of slip", colorIndex: 0 }],
    },
  },
  "category-chart": {
    purpose: "A value compared across categories.",
    props: {
      dataKey: DATA_KEY_PROP,
      title: "string",
      xKey: "string — the row field on the x axis, defaults to 'x'",
      series: "array of { key, label, colorIndex }",
    },
    example: {
      dataKey: "containers-by-state",
      title: "Containers by state",
      xKey: "state",
      series: [{ key: "count", label: "Containers", colorIndex: 0 }],
    },
  },
  "breakdown-chart": {
    purpose: "Parts of a whole.",
    props: {
      dataKey: DATA_KEY_PROP,
      title: "string",
    },
    example: { dataKey: "containers-by-state", title: "Containers by state" },
  },
  timeline: {
    purpose: "The sequence of what happened, newest last. The narrative of an operation.",
    props: {
      events: "array of { text, at, status } — the events themselves",
      dataKey: `${DATA_KEY_PROP}; used only when "events" is absent`,
    },
    example: {
      events: [
        { text: "Booking confirmed", at: "2026-07-02", status: "success" },
        { text: "Transshipment in Singapore", at: "2026-07-19", status: "warning" },
      ],
    },
  },
  table: {
    purpose: "Rows to scan side by side. Needs its columns; without them it renders nothing.",
    props: {
      columns: "array of { key, label } — required, and the order of the columns",
      rows: "array of objects keyed by the column keys",
      dataKey: `${DATA_KEY_PROP}; used only when "rows" is absent`,
    },
    example: {
      columns: [
        { key: "container", label: "Container" },
        { key: "state", label: "State" },
      ],
      dataKey: "containers",
    },
  },
  "key-values": {
    purpose: "Label/value pairs: the fields pulled off a document, a booking's data.",
    props: { items: "array of { label, value } — required" },
    example: {
      items: [
        { label: "Vessel", value: "MV Southern Cross" },
        { label: "BL", value: "SGMX0099213" },
      ],
    },
  },
  progress: {
    purpose: "How far along something is. Clamped to its own maximum.",
    props: {
      value: "number — required",
      max: "number — defaults to 100",
      label: "string — what is progressing",
    },
    example: { value: 6, max: 9, label: "Containers delivered" },
  },
  badge: {
    purpose: "A short state marker next to what it qualifies.",
    props: {
      text: "string — required",
      status: STATUS_TONES,
    },
    example: { text: "Delayed", status: "warning" },
  },
  divider: {
    purpose: "A rule separating two blocks of a widget.",
    props: {},
    example: {},
  },
  sparkline: {
    purpose: "The shape of a trend, with no axes. For a size too small to hold a chart.",
    props: {
      dataKey: `${DATA_KEY_PROP} — required`,
      valueKey: "string — the row field to plot, defaults to 'value'",
    },
    example: { dataKey: "schedule-changes", valueKey: "days" },
  },
  file: {
    purpose: "One document of the operation, with its link.",
    props: {
      name: "string — required, the file name",
      type: "string — its extension or MIME type, decides the icon",
      size: "string — human readable, e.g. '284 KB'",
      at: "string — when it arrived",
      url: "string — where to open it",
    },
    example: { name: "booking-confirmation.pdf", type: "pdf", size: "284 KB" },
  },
};

export const COMPONENT_CATALOG = {
  nodes: Object.fromEntries(
    ATOMIC_NODE_KINDS.map((kind) => [
      kind,
      { ...NODE_SPECS[kind], nestable: NESTABLE_ATOMIC_NODE_KINDS.has(kind) },
    ]),
  ) as Record<AtomicNodeKind, NodeSpec>,

  sizes: Object.fromEntries(
    (Object.keys(WIDGET_SIZES) as WidgetSizeName[]).map((name) => [
      name,
      { ...WIDGET_SIZES[name], fitsChart: fitsChart(name) },
    ]),
  ) as Record<WidgetSizeName, { w: number; h: number; fitsChart: boolean }>,

  actions: ACTION_KINDS,
  maxDepth: MAX_COMPONENT_NODE_DEPTH,
} as const;

function renderNode(kind: AtomicNodeKind, spec: NodeSpec): string {
  const props = Object.entries(spec.props)
    .map(([name, description]) => `    - ${name}: ${description}`)
    .join("\n");

  const notes = [
    spec.action ? `requires a top-level "action" (one of ${ACTION_KINDS.join(", ")})` : null,
    spec.nestable ? 'may carry "children"' : 'must NOT carry "children"',
  ]
    .filter((note) => note !== null)
    .join("; ");

  return [
    `- "${kind}" — ${spec.purpose}`,
    "  props:",
    props,
    `  rules: ${notes}`,
    `  example: ${JSON.stringify({ kind, order: 0, props: spec.example, ...(spec.action ? { action: spec.action } : {}) })}`,
  ].join("\n");
}

/**
 * The catalogue as a prompt block. Generated rather than written by hand so a
 * new kind, action or size reaches the agent the moment the enum changes.
 */
export function renderComponentCatalog(): string {
  const nodes = ATOMIC_NODE_KINDS.map((kind) =>
    renderNode(kind, COMPONENT_CATALOG.nodes[kind]),
  ).join("\n\n");

  const sizes = (Object.keys(COMPONENT_CATALOG.sizes) as WidgetSizeName[])
    .map((name) => {
      const { w, h, fitsChart: chartable } = COMPONENT_CATALOG.sizes[name];
      return `- ${name}: ${w} columns x ${h} rows${chartable ? "" : " — too small to hold a chart"}`;
    })
    .join("\n");

  return `## Component catalogue

A widget is one container holding a tree of nodes. Every node is
{ "kind", "order", "props" }, plus "action" on a button and "children" on a layout.
"order" is an integer and decides the sequence; array position does not.
Nesting is capped at ${COMPONENT_CATALOG.maxDepth} levels.

### Node kinds — these are the ONLY valid values of "kind"

${nodes}

### Sizes — these are the ONLY valid values of "size"

${sizes}

A chart in a size marked above as too small is rejected outright.
`;
}
