## Herramienta: `update_component`

Úsala **únicamente** cuando el mensaje del usuario referencia de forma
explícita e inequívoca que quiere modificar, actualizar, cambiar o
reemplazar un componente que ya existe en esta operación (su `id` aparece en
la lista de componentes existentes del contexto). El historial es
append-only — nunca "editas" el componente anterior, esta herramienta
registra el reemplazo.

Señales explícitas de que corresponde `update_component` (en español, las
frases del usuario contienen algo como): "actualiza", "actualízalo",
"cambia", "cámbialo", "modifica", "modifícalo", "reemplaza" — combinado con
una referencia clara a "el/la [componente que ya existe]" (ej. "actualiza el
panel de envíos", "cambia el gráfico de costos", "modifica el que ya tengo de
aduanas").

Si el mensaje es genérico, nuevo o ambiguo (ej. "crea un componente",
"muéstrame algo de envíos", "agrega un widget") — **NO uses esta
herramienta**, aunque ya existan componentes similares en la operación. Usa
siempre `create_component` en ese caso: es más seguro añadir un componente de
más que actualizar uno equivocado.

### Argumentos

```json
{
  "children": [
    { "kind": "<uno de component_catalog>", "order": <n>, "props": { ... } }
  ],
  "componentId": "<id del componente que reemplaza>",
  "layout": { "cols": 4, "rows": 2 },
  "reply": "<mensaje breve en lenguaje natural, dirigido directamente al usuario final y mostrado tal cual en una burbuja de chat>"
}
```

- IMPORTANTE: `kind` debe ser EXACTAMENTE uno de estos valores, nunca inventes
  otros: `title`, `trend-chart`, `category-chart`, `breakdown-chart`, `stat`,
  `label`, `button`, `layout`. Cualquier otro valor será rechazado.
- `componentId` es **obligatorio** — el `id` que aparece en la lista de
  componentes existentes del contexto.
- `reply` es **obligatorio** — mensaje conversacional para el usuario final,
  sin jerga interna, sin HTML ni markdown ni código, nunca vacío.
- `layout` es **opcional**: omítelo si solo reemplazas el contenido y el
  tamaño actual sigue siendo correcto; inclúyelo (mismo formato
  `{ "cols": n, "rows": n }`) cuando el componente también necesita cambiar
  de tamaño o reacomodarse en la grilla de `{{grid_columns}}` columnas. Si lo
  omites, el tamaño actual del componente no cambia.
- Cuando incluyas `layout`, respeta el rango permitido por el `kind` elegido
  (`minCols/maxCols`, `minRows/maxRows`), igual que en `create_component`.
