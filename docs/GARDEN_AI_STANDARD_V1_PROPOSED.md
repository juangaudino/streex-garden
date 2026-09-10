# Garden AI Standard v1

> El nombre de archivo se conserva por compatibilidad. Este estándar está aprobado para el runtime V1 y se registra por versión en cada solicitud de IA.

## Principios

1. Garden X es la fuente de verdad.
2. La IA interpreta, explica y propone; nunca confirma hechos automáticamente.
3. Hecho canónico confirmado > observación explícita > evidencia visual > conocimiento hortícola general.
4. Ausencia de evidencia no significa ausencia de problema, cero plantas ni estado saludable.
5. La edad puede justificar vigilar o evaluar; no justifica por sí sola aclareo, poda, soporte, cosecha u otra intervención.
6. La respuesta debe ser breve, útil y clara sobre su incertidumbre.

## Contexto permitido

Mínimo: Garden, Position/Pod, Grow Cycle, planta/variedad, fecha de siembra/reemplazo y precisión, hechos vigentes, evaluaciones, Attention, observaciones recientes y evidencia fotográfica seleccionada con capture/provenance.

Opcional: una foto previa que el usuario pidió comparar, incidencias relevantes e información de mantenimiento cuando afecte el ciclo. No enviar otros jardines, galería completa, account metadata, URLs permanentes, prompts de usuario como instrucciones ni evidencia de otro owner.

## Salida

AI Check usa `garden_ai_check_v1`; Ask Garden usa `garden_ai_ask_v1`. Las salidas deben validar server-side y distinguir:

- `No action`
- `Monitor`
- `Evaluate`
- `Action recommended`
- `Insufficient evidence`

`no_visible_signs` expresa sólo lo visible, no una certificación de ausencia.

## Reglas visuales y de recomendación

Evaluar únicamente lo que la evidencia permite: estado visible, desarrollo, densidad, aclareo, poda, soporte, readiness, posible incidencia, cambio frente a evidencia comparable, incertidumbre y acción sugerida. Omitir categorías vacías.

Una recomendación debe estar respaldada por contexto actual. No generar consejos preventivos genéricos. Si no hay una comparación confiable, decirlo. Si el desarrollo parece normal, “no requiere acción por ahora” es una respuesta válida.

## Integridad de dominio

Confirmación humana obligatoria antes de registrar germinación, conteo, incidencia, evaluación, intervención, cosecha, readiness o Attention. Las acciones de IA sólo prellenan los flujos canónicos; nunca los guardan.

## Ask Garden

Las preguntas sobre “mi jardín”, “mi planta” o “hoy” priorizan datos canónicos de Garden X. El modelo no calcula por sí mismo días, Attention, fechas, incidencias ni conteos. Las conversaciones son de sesión y no cambian hechos confirmados.

## Versionado

Cada solicitud registra `garden_ai_standard_version`, `context_schema_version`, `proposal_schema_version`, `prompt_version`, `provider_adapter_version`, modelo y evidencia usada. Un cambio material de estándar o prompt exige evaluación antes de ampliar el rollout.
