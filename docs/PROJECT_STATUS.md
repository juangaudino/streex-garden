# Streex Garden — estado actual del producto

**Actualizado:** 10 de septiembre de 2026
**Código de referencia:** `main`
**Producto:** Garden X, aplicación privada de Streex Garden

Este documento es la referencia de estado actual. Los documentos `PHASE_*`, contratos fechados y pasadas visuales conservan la decisión o evidencia de su momento; no deben leerse como una descripción del runtime actual.

## Qué está operativo

- Autenticación privada, jardines, posiciones físicas y Grow Cycles con historial de ocupación.
- Observaciones, hechos estructurados, fotografías privadas, precisión temporal, checksum y provenance.
- Control V2, Hoy, seguimientos/Attention y mantenimiento contextual.
- Portadas manuales para Home, Garden y ciclo, con fallback visual para fotografías registradas nativamente.
- Plant Story, Historial exhaustivo, comparación de exactamente dos fotos del mismo ciclo y Growth Film basado únicamente en evidencia real.
- Historical Photos v1: importación histórica privada, idempotente y separada de hechos canónicos.
- Guest Plant Story y Guest Garden Story: enlaces revocables de solo lectura; las fotos se entregan mediante URLs firmadas de corta duración desde funciones dedicadas.
- Garden AI V1: Ask Garden, AI Check sobre foto guardada y análisis temporal de una foto antes de guardarla durante Maintenance.

## Garden AI V1

Garden X conserva los hechos. La IA interpreta contexto autorizado y propone; nunca guarda germinación, conteos, incidencias, intervenciones, cosechas, readiness ni Attention por sí misma.

- **Modelo operativo:** `gpt-5.6-luna` detrás de la Edge Function autenticada `garden-ai`.
- **Ask Garden:** primero resuelve preguntas determinísticas sobre atención, Control V2, germinación, cosechas, cambios e incidencias. Para preguntas abiertas utiliza síntesis grounded con contexto owner-scoped y conversación breve no persistente.
- **AI Check:** usa una foto seleccionada del mismo ciclo. Puede sugerir una acción canónica prellenada, pero el usuario confirma el registro mediante el flujo normal.
- **Draft AI Check:** analiza una rendition temporal de una foto recién tomada o elegida. No sube ni conserva esos bytes hasta que el usuario decide guardar la observación.
- **Seguridad:** fotos privadas, sin URLs públicas, sin claves en el cliente, Responses API con `store: false`, salida estructurada validada y auditoría no canónica.
- **Control operativo:** `GARDEN_AI_ENABLED` habilita explícitamente el runtime. Al estar desactivado, Garden X conserva todas sus funciones manuales y responde de forma segura.

## Límites vigentes

- No hay acciones autónomas, creación automática de hechos, memoria persistente de chat, análisis masivo de fotos ni conversaciones de Ask Garden almacenadas.
- No hay MCP, OAuth, Sofi/ChatGPT Bridge ni proveedor múltiple.
- Growth Film no inventa etapas, no altera fotos y no modifica datos. El clip se genera localmente a partir de las fotos reales disponibles cuando el navegador lo permite.
- Historical Photos, ciclos, eventos y precisión temporal no se reinterpretan por la IA.

## Evidencia reciente

- Historical Photos y los ciclos asociados se mantuvieron aislados de Control V2.
- QA de campo confirmó Home editable, nombres de Garden editables, paginación de Historial, Growth Film, AI Check sobre foto nueva y foto guardada.
- Ask Garden cuenta con contexto owner-scoped, sugerencias rotativas según estado canónico y manejo auditable de fallos.
- La verificación local más reciente del código de producto reportó 79 pruebas Vitest, typecheck, lint, build y `git diff --check` correctos.

## Próximas validaciones de uso

Consulta [QA_FIELD_CHECKLIST.md](QA_FIELD_CHECKLIST.md). La prioridad es confirmar uso real continuado de observaciones, hechos, seguimientos, Ask Garden y AI Check en iPhone antes de ampliar producto.

## Documentación relacionada

- [README](../README.md): visión de portfolio, arquitectura y uso local.
- [GARDEN_AI_V1_IMPLEMENTATION.md](GARDEN_AI_V1_IMPLEMENTATION.md): runtime actual de IA.
- [GARDEN_AI_STANDARD_V1_PROPOSED.md](GARDEN_AI_STANDARD_V1_PROPOSED.md): estándar de comportamiento versionado; el nombre de archivo se conserva por compatibilidad.
- [AI_EVIDENCE_CONTEXT_ARCHITECTURE.md](AI_EVIDENCE_CONTEXT_ARCHITECTURE.md): frontera de evidencia y autorización.
- [OPERATIONS_AND_DEPLOYMENT.md](OPERATIONS_AND_DEPLOYMENT.md): despliegue, variables y validación operativa.
