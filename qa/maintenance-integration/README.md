# Maintenance: entorno de QA de la integración

Esta entrada renderiza **MaintenancePage y sus formularios reales**, con la misma CSS que la aplicación. Sustituye los adaptadores de datos por fixtures en memoria. No inicia sesión, no llama a Supabase ni a Garden AI, no registra service workers y no guarda hechos en ninguna cuenta.

Desde la raíz del repositorio:

```sh
npx vite --config qa/maintenance-integration/vite.config.ts
npx tsc -p qa/maintenance-integration/tsconfig.json --pretty false
npx vite build --config qa/maintenance-integration/vite.config.ts
```

Abrir `http://127.0.0.1:4192/`. El servidor escucha sólo en loopback. Detenerlo con Ctrl+C. El build de esta entrada queda en `artifacts/maintenance-integration/build`; no sustituye el build del producto.

La fotografía de referencia local de Fase 01, si existe en `artifacts/botanical/reference.jpg`, se reutiliza exclusivamente para probar el encuadre. Se repite en las tres posiciones y **no representa las tres plantas de demostración**. Sin ese archivo, el entorno funciona con el estado sin fotografía. No hay URLs firmadas, fotos privadas de una cuenta ni credenciales en los fixtures.

Variantes de URL:

| Sufijo | Caso |
| --- | --- |
| `?error` | Falla una escritura; permite reintentar conservando el formulario. |
| `?empty` | Ciclos sin fotografías. |
| `?long` | Nombre extenso en el contexto de la revisión. |
| `?changed` | El ocupante actual no coincide con el ciclo capturado. |
| `?empty&long` | Combina nombre largo y ausencia de foto. |

Los datos del simulador se reinician al recargar. La aplicación real conserva un marcador de continuación en sessionStorage, por sesión y ciclo; en este entorno sus IDs son fijos, así que usar una pestaña nueva para un escenario limpio. La sustitución de un ciclo sólo simula el cierre: no prueba la transacción de creación del sucesor. Las funciones no implementadas en los fixtures fallan explícitamente.

Para pruebas de semántica, errores e idempotencia repetibles:

```sh
npx vitest run src/features/gardens/MaintenancePositionActions.test.tsx
```

El éxito de estos escenarios no sustituye el QA autenticado ni las pruebas físicas de Safari/iOS. Resultados y límites: [informe de Fase 02.1](../../docs/BOTANICAL_STUDIO_PHASE_02_1.md).
