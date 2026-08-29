# Hackaton-InteractiveUI

**El escenario: automatización logística impulsada por IA.** Agentes de IA leen los correos y documentos de importadores y exportadores, hacen seguimiento de contenedores, detectan problemas y ejecutan acciones — y los humanos los supervisan.

## Definiciones clave

**El dominio logístico:**

- **Cliente:** empresa importadora/exportadora que usa la plataforma
- **Operación logística:** un embarque — agrupa órdenes de compra, contenedores y documentos
- **Booking:** la reserva de espacio en un buque para transportar contenedores; confirmada por la naviera
- **Contenedor:** la unidad física que se rastrea desde el origen hasta el destino
- **ETD / ETA:** hora estimada de salida / llegada del embarque
- **Estados del contenedor:** booking confirmado → en tránsito → arribado a puerto → aduana → entregado
- **Documentos:** Orden de Compra (PO: el pedido del cliente a su proveedor) · Booking Confirmation (la naviera confirma buque, ruta, fechas) · Bill of Lading (BL: el contrato de transporte; identifica el embarque) · Factura / Packing List (factura comercial y detalle de la carga) · Arrival Notice (aviso de llegada al puerto de destino)

**Los agentes:**

- **Agente:** un sistema de IA que ejecuta trabajo de forma autónoma usando herramientas — no solo conversa, hace
- **Flujo (workflow):** la secuencia de pasos y decisiones que un agente ejecuta cuando se dispara un trigger
- **Trigger:** el evento que inicia un flujo (llega un correo, cambia un ETA, una hora programada)
- **Run:** una ejecución individual de un flujo; el mismo flujo corre muchas veces
- **Human-in-the-loop:** un punto del flujo donde un humano debe revisar, aprobar o decidir

## 1. El problema

Los agentes ejecutan flujos que toman decisiones reales: revisan documentos, detectan demoras, escalan problemas, notifican clientes. Pero los humanos que supervisan esos agentes no necesariamente entienden cómo funcionan estos sistemas, y están acostumbrados a ver el mundo a través de interfaces que:

- Fueron **diseñadas** para escenarios que alguien anticipó
- Requieren **trabajo de frontend** cada vez que nace un flujo nuevo
- **No pueden mostrar lo inesperado**: cuando el agente se topa con un caso raro, la pantalla no existe

El resultado: humanos ciegos frente a agentes que están trabajando; decisiones y aprobaciones lentas y sin contexto; y el frontend se convierte en **el cuello de botella de la automatización** cuando se trata de confianza y adopción del usuario final.

## 2. Objetivo

Construir un sistema donde **un agente que ejecuta un flujo genera y renderiza su propia interfaz (UI/front) en tiempo real**:

- ☐ La UI **nace del estado del flujo** y de las decisiones que el agente toma en el camino, no de pantallas predefinidas
- ☐ La UI está **viva dentro de un mismo run**: a medida que el flujo avanza paso a paso, la interfaz se reestructura en tiempo real — en streaming mientras el agente trabaja, no un refresh cuando el run termina
- ☐ La UI **evoluciona con cada run**: el agente ejecuta, la interfaz cambia
- ☐ Si el flujo **cambia**, la interfaz **cambia**
- ☐ Es **bidireccional e interactiva, en el mismo run**: lo que el humano responde en la UI generada vuelve al agente, cambia lo que hace a continuación, y la interfaz renderiza inmediatamente la consecuencia de esa decisión — un round-trip completo, no un reporte renderizado

> **Prueba de fuego.** Los jueces van a modificar el flujo en vivo (agregar un paso, cambiar una decisión) — la interfaz debe adaptarse sola.

## 3. Resultados esperados

Un demo o prototipo que muestre:

- ☐ Un agente ejecutando un flujo con decisiones visibles
- ☐ Una interfaz **generada en runtime** que refleje el estado del flujo
- ☐ La interfaz **reestructurándose en vivo a mitad del run** mientras el agente avanza por el flujo — la audiencia la ve cambiar mientras el agente trabaja
- ☐ Runs sucesivos del agente → **la interfaz se actualiza con cada run**
- ☐ Un momento **human-in-the-loop** resuelto a través de una interfaz generada (aprobar, elegir, corregir) — y el agente **cambia visiblemente de rumbo por eso**, con la UI mostrando la consecuencia
- ☐ El flujo modificado → **la interfaz se adapta sin trabajo manual**

### Puntos extra

- Coherencia visual: la UI generada respeta un design system — no es un collage
- Varios flujos corriendo a la vez, cada uno con su propia interfaz
- Seguridad: qué puede y qué no puede hacer una UI generada por un agente

## 4. Caso ficticio mínimo

- **Empresa:** "Muebles del Sur", una importadora que trae muebles desde Vietnam a México.
- **Agente:** *Ari* — gestiona los bookings de la empresa y monitorea sus embarques.

**Flujo base:**

1. **Trigger:** llega un correo con un Booking Confirmation
2. Ari extrae los datos: naviera, buque, puerto de origen/destino, ETD/ETA, contenedores
3. Crea la operación y monitorea el viaje en cada run
4. Si detecta un problema serio → un humano decide en la misma interfaz

**Momentos clave (cada run cambia el front):**

1. **Run 1 — booking confirmado** → nace la interfaz: un **mapa con la ruta** (Vietnam → México), la tarjeta del booking y sus contenedores
2. **Run 2 — el buque zarpa** → el front cambia solo: posición del buque en el mapa, contenedores en tránsito
3. **Run 3 — transbordo inesperado** (el buque hace una parada no planificada y el ETA se corre 9 días) → el mapa **redibuja la ruta** y la interfaz genera un panel de decisión human-in-the-loop: *¿esperar, buscar una alternativa o notificar al cliente final?*
4. **La prueba** → agregar un paso nuevo al flujo (por ejemplo, "validar el Bill of Lading contra el booking antes de confirmar") y la interfaz debe reflejarlo por sí sola

Empleados, correos, documentos, buques y datos pueden ser todos inventados.

## Estructura

```
frontend/   # UI generada en runtime
backend/    # agentes, flujos y orquestación
```
