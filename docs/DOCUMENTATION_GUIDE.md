# Guía de documentación

## Referencias actuales

| Documento | Uso |
| --- | --- |
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | Estado actual del producto, límites y QA prioritaria. |
| [OPERATIONS_AND_DEPLOYMENT.md](OPERATIONS_AND_DEPLOYMENT.md) | Variables, Edge Functions, migraciones y publicación. |
| [QA_FIELD_CHECKLIST.md](QA_FIELD_CHECKLIST.md) | Pruebas manuales de uso real. |
| [GARDEN_AI_V1_IMPLEMENTATION.md](GARDEN_AI_V1_IMPLEMENTATION.md) | Runtime Garden AI V1. |
| [GARDEN_AI_STANDARD_V1_PROPOSED.md](GARDEN_AI_STANDARD_V1_PROPOSED.md) | Reglas de comportamiento y versionado de IA. |
| [AI_EVIDENCE_CONTEXT_ARCHITECTURE.md](AI_EVIDENCE_CONTEXT_ARCHITECTURE.md) | Evidencia, autorización y privacidad. |

## Registros históricos

`PHASE_*`, `PRODUCT_*` y `VISUAL_FIDELITY_*` conservan decisiones, resultados y límites de su fecha. Pueden contener frases como “sin IA”, “pendiente” o conteos de pruebas anteriores que no describen el producto de hoy. No se reescriben como si fuesen evidencia actual; cada archivo enlaza al estado vigente cuando corresponde.

## Regla de actualización

Al cerrar una fase de producto:

1. Actualizar `PROJECT_STATUS.md` y, si cambia el uso, el README.
2. Actualizar el documento de arquitectura o runtime afectado.
3. Mantener la fase original como registro histórico y añadir una nota de supersedencia si su estado deja de ser actual.
4. Separar evidencia local, remota, producción y dispositivo físico.
5. No incluir secretos, fotos privadas, tokens, URLs firmadas ni datos personales.
