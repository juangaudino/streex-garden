# Botanical Studio — cierre técnico de Fase 02.1

Fecha: 12 de septiembre de 2026.

**Maintenance está integrado en el código real y validado localmente.** Conserva la dirección aprobada de Fase 01. La entrega no está desplegada en producción y su aceptación en una cuenta real y en Safari de un iPhone físico sigue pendiente. No se implementó Fase 02.2 ni Fase 02.3.

## Resultado

- La ruta de Maintenance usa su propio contexto persistente de jardín, posición, planta y avance. Fotografía protagonista, tres intenciones principales y una única barra de navegación.
- Observaciones, cuidados, hechos confirmados y seguimientos abren hojas contextuales con los formularios y adaptadores existentes.
- Guardar conserva la planta y muestra un comprobante breve. «Registrar algo más» y «Siguiente planta» comparten la misma zona inferior. Se eliminan los antiguos mensajes y botones de continuación duplicados.
- «Se ve bien» requiere una confirmación explícita. Sólo ese camino invoca la operación que puede registrar una revisión visual tranquilizadora.
- «Siguiente planta» actualiza el progreso mediante `markMaintenancePositionInspected`; no crea un hecho de salud. «Omitir» tampoco afirma salud. El resumen distingue revisada, se ve bien y omitida.
- Pausar, retomar y finalizar usan el estado real de la sesión. Finalizar antes de tiempo no convierte las posiciones pendientes en revisadas.
- Las hojas tienen cierre completo, bloqueo durante el guardado, Escape, foco al cambiar de formulario, recorrido de teclado contenido y restitución del foco al volver.
- «Dejarlo planificado» conserva propósito, fecha y asunto opcional, con menor densidad vertical. A 320 px el formulario básico completo cabe en una hoja de 517 px sin scroll interno.

## Dominio conservado

La entrada «Registrar estado o acción» permite germinación, cantidad de plantas, estado observado, evaluación de desarrollo, preparación para cosecha, intervenciones e incidencias. Se siguen usando los formularios y contratos canónicos; no se introduce un segundo modelo de hechos.

El menú conserva cosecha, corrección de siembra, traslado a posiciones vacías u ocupadas, cierre y reemplazo de ciclo. Después de una operación estructural, la pantalla permanece en la posición hasta la navegación explícita. Si el ocupante cambió, bloquea los registros del ciclo anterior sobre el sucesor.

Las observaciones mantienen la cola local, los estados de sincronización y la recuperación del original. Una foto pendiente de sincronizar bloquea avanzar. Los intentos repetidos de hechos, seguimientos, acciones estructurales y progreso reutilizan su identificador cuando el contenido no cambió, y rechazan envíos simultáneos.

Garden AI sigue proponiendo. Abrir una acción sugerida no guarda el hecho. Cancelar ese formulario devuelve a la fotografía y nota pendientes; el análisis no las guarda ni las descarta automáticamente. El adaptador real de AI no se modificó.

La portada de la revisión pertenece al ciclo y posición actuales y mantiene acceso al original y su fecha/provenance. Una fecha desconocida se presenta como desconocida. No se sustituye por la fecha de carga.

## Archivos de producto

| Archivo | Cambio |
| --- | --- |
| `src/components/botanical/BotanicalControls.tsx` | Botón y hoja compartidos, foco, cierre y estados de guardado. |
| `src/components/botanical/botanical.css` | Tokens de Fase 01 y estilos de controles/formularios, limitados a la superficie Botanical. |
| `src/features/gardens/MaintenancePage.tsx` | Contexto, navegación, semántica de progreso, pausa, resumen y finalización reales. |
| `src/features/gardens/MaintenancePortrait.tsx` | Referencia visual del ciclo ya cargado; protección contra ocupante distinto. |
| `src/features/gardens/MaintenancePositionActions.tsx` | Hojas, comprobantes, continuidad tras guardar, AI y recuperación de observaciones. |
| `src/features/gardens/maintenance-botanical.css` | Composición móvil, tablet y escritorio de Maintenance. |
| `src/features/gardens/AttentionTaskTools.tsx` | Adaptación opcional del formulario a la hoja; resultado creado/duplicado e idempotencia. |
| `src/features/cycles/CycleFactRecorder.tsx` | Adaptación opcional, etiqueta del hecho guardado e idempotencia. |
| `src/features/cycles/CycleActions.tsx` | Menú integrado, cierre completo, foco y protección contra envíos duplicados. |
| `src/features/cycles/ObservationComposer.tsx` | Modo hoja, estado de AI, conservación del borrador y prevención de carreras al elegir fotos. |

## Archivos de pruebas y documentación

- `src/features/gardens/MaintenancePositionActions.test.tsx`: 12 pruebas de integración de la página real y los formularios contra adaptadores simulados.
- `src/features/cycles/visual-pass-a.test.tsx`: adapta la protección de fotografía y sustituye las expectativas de la interfaz anterior por las pruebas de integración.
- `qa/maintenance-integration/index.html`, `main.tsx`, `fixtures.ts`, `vite.config.ts`, `tsconfig.json`, `README.md`: entrada aislada de QA y escenarios de error, cambio de ocupante, nombre largo y ausencia de foto.
- `docs/BOTANICAL_STUDIO_PHASE_01.md`: registra el orden aprobado de integración, sin reabrir la dirección.
- Este informe.

## Validación ejecutada

| Comprobación | Resultado |
| --- | --- |
| TypeScript del producto | Incluido en `npm run build`, sin errores. |
| `npm test` | 26 archivos, **88 tests aprobados**. |
| `npm run lint` | Sin errores. |
| `npm run build` | Build del producto y service worker generados. Advertencias abajo. |
| TypeScript del entorno de QA | Sin errores. |
| Build del entorno de QA | Generado independientemente del producto. |

Pruebas visuales y funcionales realizadas en el navegador integrado de Codex, con componentes reales y datos de demostración aislados:

| Tamaño | Resultado |
| --- | --- |
| 320 × 740 | Sin desbordamiento horizontal; botones de navegación de 50 px de alto; nombre extenso legible y formulario básico completo. |
| 390 × 844 | Fotografía, intenciones, estado tras guardar y hojas consistentes; Cancelar/Guardar en una misma zona. |
| 820 × 1180 | Dos columnas, sin recortes laterales y con navegación inferior accesible. |
| 1440 × 960 | Ancho de contenido de 1170 px, fotografía de 550 px de alto y barra inferior dentro del viewport. |

Se verificaron en navegador: guardar un conteo y un seguimiento sin avanzar; navegar después sin afirmar salud; confirmar «Se ve bien» y comprobar su contador separado; abrir/cancelar formularios; error y reintento conservando propósito; foto original; pausa/reanudación; omitir; resumen y finalización; ausencia de foto; nombre largo; bloqueo del ciclo ante cambio de ocupante; Escape y teclado en los extremos de las hojas.

Las pruebas automatizadas cubren además: fecha y propósito del seguimiento, duplicado de seguimiento, reintentos idempotentes, lectura fallida después de escribir progreso, doble envío estructural, continuidad tras recarga, bloqueo/recuperación de una foto pendiente y conservación de foto/nota al cancelar una propuesta de AI.

La semántica de las funciones de progreso existentes se verificó mediante lectura del backend durante esta fase. No se aplicaron migraciones ni se hicieron escrituras de QA sobre los datos del usuario. La revisión de definiciones no equivale a una prueba autenticada de extremo a extremo.

## Evidencia local

Capturas en `artifacts/maintenance-integration/` (artefactos locales, no incluidos en Git):

- `mobile-saved-final.png`: resultado después de guardar, misma planta y navegación unificada.
- `mobile-320-follow-up.png`: densidad del formulario a 320 px.
- `mobile-navigation-semantics.png`: revisión sin conclusión de salud después de avanzar.
- `mobile-error.png`: valores conservados tras error.
- `desktop-1440.png`: composición de escritorio. La vista de tablet se inspeccionó también en el navegador y quedó capturada en el registro de esta sesión.

La fotografía de estas capturas es una referencia de la maqueta repetida para evaluar la composición; no demuestra correspondencia con cada planta ficticia. Las capturas no son pruebas sobre la cuenta del usuario.

## Pendientes y riesgos

1. **QA autenticado de esta integración:** guardar observación con foto, hecho y seguimiento; recargar; comprobar una única escritura y el ciclo correcto. Las API existentes se reutilizan, pero esta nueva composición aún no se ha probado contra una sesión real.
2. **Safari en un iPhone físico:** teclado abierto, selector de fecha, Cámara/biblioteca, safe area, VoiceOver y recuperación tras perder conexión/cerrar la PWA. La emulación de tamaños no acredita estos comportamientos del dispositivo.
3. **Operaciones estructurales reales:** intercambio de dos posiciones ocupadas, cierre y reemplazo deben probarse en datos de ensayo. El simulador y los tests no certifican la transacción del backend ni sus permisos.
4. **Observación pendiente:** se conserva el bloqueo al avanzar y la recuperación del original; falta validar ese recorrido físicamente después de suspender y reabrir Safari/PWA.
5. **Carga inicial:** el build advierte un chunk principal mayor de 500 kB y una importación dinámica inefectiva de `photo-renditions.ts` porque también se importa estáticamente. No impiden compilar; la división global del bundle queda fuera de esta fase. Las fuentes mantienen la descarga externa de la dirección aprobada y sus alternativas locales.
6. **Log de tests:** JSDOM emite `Not implemented: navigation to another Document`; los 88 tests terminan aprobados. Las navegaciones completas necesitan navegador, como en el entorno de QA, y no se acreditan sólo con JSDOM.

El cierre corresponde a **implementación y QA local**, no a publicación ni aprobación de dispositivo. Growth Film, Planta y el preview público de Fase 01 permanecen fuera de esta entrega.
