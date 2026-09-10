# Garden AI V1 — implementación

Garden X continúa siendo la fuente de verdad. La IA sólo interpreta evidencia y propone acciones; cualquier escritura canónica requiere confirmación humana mediante los flujos existentes.

## Estado

- Modelo de producción V1: **GPT-5.6 Luna** para AI Check, AI Compare y síntesis de Ask Garden.
- Intenciones determinísticas de Ask Garden: sin proveedor.
- `GARDEN_AI_ENABLED=false` durante esta fase. La activación controlada es una decisión posterior.
- Responses API, Structured Outputs, `store:false`, Storage privado y contexto owner-scoped.
- Las propuestas AI son auditables y no se convierten en eventos de Plant Story automáticamente.

## Superficies

- **AI Check** vive dentro del Grow Cycle y analiza una fotografía ya guardada. No exige una segunda carga. Expone como máximo una acción canónica prellenada.
- **AI Compare** recibe exactamente dos fotografías explícitas del mismo ciclo.
- **Ask Garden** es una ruta principal. Resuelve primero intents canónicos (Hoy, germinación, cosecha, historial y cambios). La síntesis Luna es opcional y usa contexto ya resuelto.
- **Growth Film** es determinista: reproduce fotografías reales e hitos confirmados de un único Grow Cycle. No genera imágenes ni llama a IA.

## Integridad y evidencia

La jerarquía es: hecho confirmado, observación humana, foto, interpretación AI y conocimiento general. Ausencia de evidencia no prueba salud, ausencia de incidencia ni cero plantas. Se conserva la precisión temporal, los conteos mínimos y el provenance de fotografías históricas.

## Costes y fallos

El presupuesto interno inicial es configurable y bloquea nuevas llamadas al alcanzar 100%. Las solicitudes llevan propósito (`production`, `benchmark`, `development`), idempotencia y metadatos de uso. Un fallo de proveedor nunca modifica hechos, ciclos, atención, fotos ni mantenimiento. Ask Garden determinístico, Growth Film y el resto de Garden X siguen funcionando con IA apagada.

## Reglas visuales

La salida debe ser breve, contextual (Garden · Pod · planta), prudente y con incertidumbre explícita. No se debe declarar germinación, daño, enfermedad, conteo o intervención a partir de una imagen ambigua. La ausencia de señales visibles se expresa como `no_visible_signs`, no como una certificación.

## Activación posterior

Antes de activar: revisar el panel de coste, confirmar límites del proyecto OpenAI, comprobar secretos server-side, ejecutar smoke controlado con una cuenta de prueba y validar que la UI distingue hechos confirmados de sugerencias AI. No activar el flag como parte de un deploy rutinario.

El benchmark/model-selection phase quedó cerrado en el commit `b3178bc`; sus resultados permanecen como evidencia histórica de la elección de Luna.
