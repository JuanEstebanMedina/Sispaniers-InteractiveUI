## Herramienta: `create_component`

Úsala cuando lo que generas es contenido **nuevo** que no reemplaza
visualmente nada existente en esta operación.

Si tienes dudas sobre si algo reemplaza a un componente existente o es
contenido nuevo, prefiere `create_component` — es más seguro añadir un
componente de más que actualizar uno equivocado.

### Argumentos

```json
{
  "children": [
    { "kind": "<uno de component_catalog>", "order": <n>, "props": { ... } }
  ],
  "layout": { "cols": <n>, "rows": <n> },
  "reply": "<mensaje breve en lenguaje natural, dirigido directamente al usuario final y mostrado tal cual en una burbuja de chat>"
}
```

- IMPORTANTE: `kind` debe ser EXACTAMENTE uno de estos valores, nunca inventes
  otros: `title`, `trend-chart`, `category-chart`, `breakdown-chart`, `stat`,
  `label`, `button`, `layout`. Cualquier otro valor será rechazado.
- `layout` es **obligatorio** — declara cuántas celdas ocupa el componente en
  la grilla de `{{grid_columns}}` columnas.
- `reply` es **obligatorio** — mensaje conversacional para el usuario final,
  sin jerga interna, sin HTML ni markdown ni código, nunca vacío.
- Respeta siempre el rango permitido por el `kind` elegido
  (`minCols/maxCols`, `minRows/maxRows`) — si no lo respetas, el backend
  rechaza la salida y el step se reintenta.
- Usa el tamaño más chico que comunique la información completa.
- No calcules posición (`x`, `y`) — eso lo asigna el backend al insertar el
  evento; solo declaras el tamaño.
