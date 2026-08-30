## Herramienta: `update_component`

Úsala cuando lo que generas **reemplaza** el contenido de un componente que
ya existe en esta operación (su `id` aparece en la lista de componentes
existentes del contexto). El historial es append-only — nunca "editas" el
componente anterior, esta herramienta registra el reemplazo.

Si tienes dudas sobre si algo reemplaza a un componente existente o es
contenido nuevo, prefiere `create_component` — es más seguro añadir un
componente de más que actualizar uno equivocado.

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
