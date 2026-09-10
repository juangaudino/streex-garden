# Garden X — AI Foundation and benchmark record

> **Estado:** base implementada y superada por el runtime V1 actual. Para comportamiento vigente consulta [GARDEN_AI_V1_IMPLEMENTATION.md](GARDEN_AI_V1_IMPLEMENTATION.md).

## Fundación reutilizada

- `garden.resolve_cycle_evidence(...)` como resolver interno, read-only y sin URLs firmadas.
- Wrappers owner-scoped autenticados para contexto de ciclo, contexto temporal y contexto de Ask Garden.
- `garden.ai_requests` para idempotencia, metadatos de auditoría, propuestas no canónicas, uso y errores seguros.
- Storage privado y renditions de lectura para no enviar originales innecesarios al proveedor.
- `MockAiProvider` para tests y `OpenAiResponsesAdapter` server-side para runtime.

## Benchmark V1

El harness conserva 15 fixtures: diez de análisis visual y cinco de Ask Garden. Mide validez de Structured Output, grounding, prudencia ante intervenciones, utilidad, latencia, tokens y coste estimado. Los candidatos de evaluación quedaron explícitos como `gpt-5.6-luna`, `gpt-5.6-terra` y `gpt-5.6-sol`.

El benchmark es una herramienta de comparación; no cambia el modelo operativo por sí mismo. La selección de V1 quedó registrada como `gpt-5.6-luna` y el runtime no ejecuta benchmarks durante uso normal.

## Garantías que se conservan

- La IA no recibe datos de otro propietario.
- No hay secret, SDK ni llamada de proveedor en el bundle cliente.
- Una respuesta inválida no llega a la UI como propuesta válida.
- Errores, límites de gasto, duplicados y foto inaccesible fallan sin modificar datos canónicos.
- Garden X sigue operativo con AI apagada.
