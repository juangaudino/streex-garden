# Garden AI V1 — runtime actual

Garden X es la fuente de verdad. Garden AI interpreta evidencia autorizada, explica y propone. No confirma ni guarda automáticamente hechos canónicos.

## Estado

Garden AI V1 está implementado y su activación depende de la flag server-side `GARDEN_AI_ENABLED`. El runtime operativo usa `gpt-5.6-luna` mediante la Edge Function autenticada `garden-ai` y OpenAI Responses API con Structured Outputs y `store: false`.

La flag es una decisión explícita de operación, no una constante de cliente: Garden X debe seguir funcionando correctamente con IA apagada.

## Superficies

- **Ask Garden:** chat de sesión no persistente. Resuelve primero intenciones determinísticas —Atención, Control V2, germinación, cosechas, cambios e incidencias— y usa síntesis grounded para preguntas abiertas. No genera SQL ni recibe acceso libre a la base.
- **AI Check:** analiza una foto ya almacenada y autorizada de un Grow Cycle. La propuesta es estructurada, validada y no canónica.
- **AI Check temporal:** durante Maintenance puede analizar una rendition local antes de guardar. La foto original permanece local hasta la confirmación explícita de Guardar; la IA no crea Storage, fotos, eventos ni hechos.
- **AI Compare:** compara exactamente dos fotos seleccionadas del mismo ciclo. No busca ni analiza una galería completa de forma automática.
- **Growth Film:** no es IA. Reproduce fotos reales e hitos confirmados de un solo ciclo; no inventa imágenes ni datos.

## Flujo de seguridad

```text
Sesión autenticada
  → autorización owner-scoped
  → contexto/evidencia mínima
  → garden-ai Edge Function
  → adapter OpenAI server-side
  → Structured Output validado
  → propuesta privada no canónica
  → flujo canónico existente con confirmación humana
```

El navegador no envía `owner_id`. El resolver interno `garden.resolve_cycle_evidence(...)` sigue restringido; los wrappers autenticados validan dueño, ciclo y foto antes de construir contexto. Las fotos proceden de Storage privado o de una rendition temporal; nunca de URLs públicas o permanentes.

## Propuesta y auditoría

La propuesta V1 conserva versiones de estándar, contexto, contrato, prompt y adapter, además de evidencia usada, duración, uso/coste cuando esté disponible y un error seguro. No persiste prompts completos, razonamiento interno, signed URLs ni bytes de imágenes. La propuesta no se convierte en Plant Story ni en un evento.

Una acción sugerida puede abrir un flujo existente prellenado —seguimiento, incidencia, conteo o readiness—. El usuario revisa y confirma el formulario normal de Garden X antes de cualquier escritura.

## Límites de V1

- Sin memoria persistente ni conversación larga almacenada.
- Sin acciones autónomas, tareas programadas ni análisis masivo de fotos.
- Sin MCP, OAuth, Sofi/ChatGPT Bridge ni proveedor múltiple.
- Sin hechos, ciclos, Attention o fotos creados por la IA.
- Sin interpretación de Historical Photos que cambie fechas, mapping o hechos existentes.

## Operación

Los secretos se configuran sólo en Supabase Edge Functions. Consulta [OPERATIONS_AND_DEPLOYMENT.md](OPERATIONS_AND_DEPLOYMENT.md). Las pruebas de uso real están en [QA_FIELD_CHECKLIST.md](QA_FIELD_CHECKLIST.md).
