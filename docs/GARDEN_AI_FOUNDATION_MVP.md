# Garden X — AI Foundation & MVP Preparation

Estado: infraestructura preparada, proveedor real desactivado.

## Arquitectura implementada

`Garden X → garden-ai Edge Function (JWT) → provider adapter → output validator`.

La Edge Function valida sesión, operación, identificadores y tamaño de pregunta, y permanece fail-closed mientras `GARDEN_AI_ENABLED` no sea `true`. No recibe `owner_id` del cliente, no escribe hechos y no firma ni publica fotografías.

El contrato y el validador viven en `src/domain/ai.ts`. Las acciones resultantes son descriptores para abrir los flujos existentes: seguimiento, incidencia, cantidad y evaluación de cosecha. Ninguna acción guarda por sí misma.

## Base reutilizada

- `garden.resolve_cycle_evidence(...)` como resolver interno.
- RPCs de Home, Control V2, Attention, Garden y Cycle.
- Fotos privadas y renditions `display`/`preview`.
- provenance, precisión temporal, correcciones e invalidación.

El resolver interno conserva su ejecución restringida. Antes del proveedor real deberá añadirse un wrapper owner-scoped autenticado que valide `auth.uid()` y limite las fotos/notas seleccionadas.

## Persistencia y retención

La migración `20260910010126_ai_foundation_mvp.sql` añade `garden.ai_requests`:

- metadata de request, versiones, evidencia, adapter/modelo, duración, uso, costo y error;
- `proposal` opcional, siempre no canónica;
- propuesta expira a los 7 días;
- metadata de auditoría expira a los 90 días;
- identidad única por owner + request key;
- RLS owner-scoped y acceso operativo `service_role`.

`garden.cleanup_expired_ai_requests()` elimina filas cuya auditoría venció. No guarda prompts, imágenes, URLs firmadas, SQL ni razonamiento interno.

## Mock y provider adapter

`MockAiProvider` permite ejecutar tests sin red ni costo. `OpenAiResponsesAdapter` está preparado sólo para servidor; recibe la key por inyección, envía `store: false` y no está importado por el cliente.

La función `garden-ai` no activa ningún provider real. Con la flag apagada responde `503` de forma segura.

## Benchmark

El catálogo contiene 15 fixtures: 10 de AI Check y 5 de Ask Garden. `runAiBenchmark()` mide:

- validez estructurada;
- latencia;
- tokens;
- errores.

Los criterios de evaluación posteriores deben añadir grounding, falsas recomendaciones de intervención y comparación visual. El benchmark debe usar fixtures sin datos productivos y conservar versiones del estándar, contexto, prompt, adapter y modelo.

## Modelo mínimo recomendado

Todavía no corresponde fijar el modelo de producción sin ejecutar el benchmark. La primera prueba debe usar el modelo económico de texto/visión de la familia vigente que soporte Structured Outputs y entrada de imagen. OpenAI documenta entradas de imagen y Structured Outputs en Responses. [Responses API](https://platform.openai.com/docs/api-reference/responses)

| Capability | Mínimo para probar | Preferido si el benchmark demuestra mejora | Excesivo para MVP |
|---|---|---|---|
| AI Check | Modelo económico multimodal con JSON Schema estricto | Modelo multimodal de mayor razonamiento sólo si reduce falsos positivos | Modelo flagship para cada consulta |
| Ask Garden | Modelo económico de texto con buen seguimiento de instrucciones | Modelo de razonamiento medio sólo para preguntas ambiguas | Visión o agente multi-herramienta autónomo |

Umbrales sugeridos antes de elegir:

- 100% de salidas estructuralmente válidas en fixtures;
- 0 hechos inventados en evaluación humana;
- 0 acciones canónicas automáticas;
- menos de 10% de recomendaciones de intervención innecesarias en casos normales;
- grounding completo de fechas, conteos y Attention;
- costo mensual proyectado dentro del presupuesto acordado.

## UX canónica prevista

AI Check se invoca desde un Grow Cycle o Maintenance con una foto ya almacenada. Devuelve una propuesta compacta y acciones prellenadas. La acción abre el flujo existente y requiere confirmación. No existe un uploader ni un modo AI paralelo.

Ask Garden usa preguntas independientes y un catálogo fijo de intenciones. No se implementan conversaciones persistentes.

## Requisitos administrativos posteriores

1. Proyecto OpenAI dedicado a Garden X.
2. Billing/créditos y límites de gasto.
3. Permisos sólo para modelos evaluados.
4. Service account y key específica del proyecto.
5. Secret `OPENAI_API_KEY` sólo en Supabase Edge Functions.
6. `GARDEN_AI_ENABLED=false` hasta el rollout aprobado.
7. Revisión de retención y controles de datos antes de enviar fotografías. [OpenAI data controls](https://platform.openai.com/docs/guides/your-data)

No se solicitan credenciales en esta fase.
