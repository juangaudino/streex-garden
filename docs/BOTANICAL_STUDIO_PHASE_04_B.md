# Botanical Studio — Fase 04.B · Continuidad y accesibilidad

Base: `78a8385` (04.A cerrada). Alcance autorizado: **B1–B7 exclusivamente**.
Living Botanical Cinema, composiciones, contratos y semántica siguen congelados.
Este bloque es local: no push, deploy, preview, servicios reales ni Garden AI.

## Evaluación técnica del plan restante

La estrategia propuesta es adecuada. 04.A convirtió una revisión transversal abierta
en destinos DOM, propietarios, invariantes y correcciones concretas. B1 requiere
criterio sobre lifecycle de navegación/animación y B6 sobre cancelación/errores de
salida; justifican **Sol High**, sin una necesidad técnica adicional de Astra.

- **04.C: Terra High**, mientras siga siendo propiedad de cascade, selectores,
  tokens/aliases, overrides y QA responsive. V01 y V02 ya tienen causa y aceptación
  identificadas con el mismo bundle integrado; no requieren reabrir componentes.
- **04.D: Terra High por defecto** para chrome, densidad y estados existentes.
  Detenerse y recomendar Sol High si la intervención exige alterar lifecycle,
  guards, request IDs, persistencia, Attention o formularios canónicos. Compartir
  presentación no autoriza compartir o cambiar operaciones de dominio.
- **04.E: Sol High** para la revisión global final, con la cobertura integrada y
  las pruebas canónicas como evidencia. Astra xhigh deja de ser requisito; sólo
  se vuelve a proponer ante un problema concreto que exceda razonablemente esos
  modelos, explicando evidencia y entregable necesario antes de continuar.

Cadence: commit local en B; commit en C y evaluar push acumulado + preview para un
recorrido del producto real; commit en D, sin deploy automático; cierre y push
final en E, como candidato a publicación. Una preview acumulada tras C aporta una
validación nueva de continuidad y cascade; desplegar cada ajuste interno no la
sustituye. Esta evaluación no autoriza publicar ahora ni fusionar QA física con QA
local. Las recomendaciones históricas de Astra en preflight/04.A quedan superadas
por esta decisión, conservadas como registro del contexto anterior.

## Cambios cerrados

| Diff | Implementación y límite |
| --- | --- |
| B1 · N01 | El badge de posición actual expone lugar/origen/ciclo; el h1 aprobado recibe foco programático. Breadcrumb usa PlaceBackLink. El adaptador espera identidad lista del ciclo exacto, cancela trabajo obsoleto con AbortController y limpia observers, clones, visibilidad y nombres nativos. Retorno contextual a fila/mapa conserva foco y scroll registrado al clic; se reafirma tras terminar la transición para evitar desplazamiento por layout. |
| B2 · N02 | Fixtures usan PlantStudio real. Cubren fila/mapa, breadcrumb/POP, state `place`, carga de 1500ms, ciclo sustituto, entrada directa, reduced motion, API ausente, snapshots nativos y su fallo/cancelación, vuelo pendiente/activo y limpieza. Runner integrado admite `QA_PHASE=04b` y exige los resultados corregidos; 04.A conserva salida separada de caracterización. |
| B3 · V03 | Sólo `main padding-bottom:0` y `chat min-height:0` se extienden hasta 719px. Las demás variantes ≤640 y ≥720 permanecen intactas. |
| B4 · A01 | Viewport mantiene width e initial-scale; se retiran maximum-scale y user-scalable. Reflow local con CSS zoom al 200%; zoom/pinch Safari físico permanece pendiente. |
| B5 · A02 | Controles medidos bajo 44px amplían altura mínima sin reescalar copy: Registrar, icon link del header, marca/nav superior, breadcrumb, Revisar, Ver su película, range Film y fuente móvil. Nav superior mantiene ancho mínimo de 44px. No hay reescritura general de botones. |
| B6 · A03 | Salida con borradores usa BotanicalSheet, copy original, busy/error y tres caminos existentes. Pruebas verifican cancelación, foco, trap, bloqueo busy y orden export → signOut → borradores → claves → navegación. Fallos de export, signOut y limpieza no adelantan pasos posteriores. Fixture pending-drafts sólo habilita lectura/cancelación; export/salida/escrituras siguen bloqueadas en navegador. |
| B7 · A04 parcial | Ambos navs usan aria-current según exactamente las condiciones activas existentes. Sin política universal de foco de llegada. |

**Propietarios:** PlaceNavigationOwner mantiene el adaptador contextual durante la
carga del Shell; no confirma salud, modifica datos ni enfoca otras superficies.
Los links siguen siendo adaptadores locales, no una nueva arquitectura de rutas.
Al abandonar su contexto o desmontar sus propietarios se cancela trabajo pendiente.
La espera de identidad está acotada a 5s: vencimiento mantiene navegación ordinaria
sin enfocar un destino incorrecto o ocupado. Entrada directa no fabrica origen.
Shell carga y navegación usan los contratos existentes; BotanicalSheet conserva
su propio foco, Escape, bloqueo de body y restauración del trigger.

No se modificaron backend, schema, AI, dominio, persistencia, rutas, mapa V1, renderer
ni contratos de formularios. Abrir, volver, consultar y cancelar no escribe hechos.
El registro de visita de Home permanece separado de los datos canónicos.

## Validación y evidencia local

Artefactos ignorados por Git: `artifacts/phase04-b/`.

- `integrated/report.json`: geometrías, foco/retorno, llamadas, comparación del grafo
  sintético, áreas de interacción, zoom y errores del navegador.
- Capturas del recorrido real Home → Jardines → fila/mapa → Planta → detalle → Film
  → fuentes → Planta → Maintenance → Hoy → Ask. Detalle V02 tiene diagnóstico
  CSSOM temporal restaurado; no se modifica su CSS de 04.C.
- Ask: 320/390/640/641/690/719/720/820/1440 × 844 y 390/690 × 480. Las expectativas
  móviles exigen compositor sobre nav, padding cero y ausencia de scroll externo
  redundante. Desktop conserva su geometría previa.
- B6: sheet de borradores a 390px; Escape devuelve foco y no exporta/sale/borra.
- Llegada lenta real: 1500ms al ciclo correcto; datos y servicios permanecen intactos.
- `tests.log`, `lint.log`, `typecheck.log`, `product-build.log`,
  `harness-typecheck.log`, `harness-build.log`, `browser.log`: ejecuciones de este bloque.

Resultados ejecutados sobre el estado final:

- `npm test`: **35 archivos / 222 pruebas aprobadas**.
- `npm run lint`: aprobado, sin errores ni warnings.
- `npm run typecheck` y typecheck del harness: aprobados.
- Build del producto y del harness: aprobados. CSS idéntico en ambos bundles,
  SHA-256 `f6269a50c32a0db6c6f30a7ea017888e168392cf5a2898891f2c87d07457f91f`
  (`css-fingerprint.json`). Permanecen avisos históricos de chunk >500kB e import
  dinámico inefectivo de photo-renditions; no son errores ni cambios de este bloque.
- Runner integrado: salida 0, **25 capturas**, **12 comparaciones de grafo sin
  cambios**, cero errores JS, intentos de escritura/AI o fetch remotos bloqueados.
  La visita de Home se registra separadamente. Fila vuelve a `scrollY=807` y su
  enlace; mapa con browser-back vuelve a `scrollY=204` y su enlace. Llegadas enfocan
  el h1 del ciclo correcto y no dejan clones.
- Controles Planta/Film: altura ≥44px (tolerancia geométrica de 0.01px para floats),
  centros alcanzables; header/nav/utility sin intersección de controles vecinos ni
  overflow horizontal a **320/390/820/1440** (`targets-check.mjs` / `targets-report.json`,
  artefactos locales). No se declara con esto el cierre responsive global de E.
- Zoom local: `CSS zoom:2` a 820px, `scrollWidth=820`; no equivale a pinch o zoom
  físico Safari. Viewport ya no impide ampliar.
- Inspección visual focal de Planta/llegada, Ask 690, Film 390 y salida con borradores
  390: composición preservada y sheet con tres acciones legibles. El resto de
  capturas apoya caracterización, no una reaprobación conceptual de las superficies.
- **Nueve esperas de fuentes excedieron 8s** en la ejecución final, registradas por
  ruta en `fontChecks`. Geometría/interacción pasó, pero esas capturas no acreditan
  estabilidad tipográfica definitiva. Dependencia de Google Fonts pendiente de la
  revisión global E; no se sustituyeron ni descargaron fuentes en B.
- `git diff --check`: aprobado. Los archivos ajenos de VISUAL_DEPTH_STUDY/depth-study
  permanecen sin modificar ni incorporar al checkpoint.

## Archivos afectados

- Navegación/chrome: `src/components/PlaceLink.tsx`, `PlaceLink.test.tsx`,
  `AppShell.tsx`, nuevo `AppShell.test.tsx`.
- Planta: `src/features/cycles/PlantStudio.tsx`, `PlantStudio.test.tsx`,
  `plant-botanical.css`.
- CSS acotado: `src/components/botanical/botanical.css`,
  `src/features/gardens/surfaces-botanical.css`, `src/features/cycles/growth-film.css`,
  `src/styles.css`; entrada `index.html`.
- Cobertura: `qa/experience-integration/baseline.mjs`, `data.ts`, `services.ts`,
  `fixtures.test.ts`, `README.md`.
- Documentación: esta guía y notas de continuidad en 04.A/preflight.

## Pendientes y siguiente parada

**04.C no iniciado.** V01 (modificador de portada Home) y V02 (diez reglas globales
record-detail de Film) permanecen pendientes deliberadamente, junto al inventario
CSS/tokens/overrides autorizado para C. No se extrajo AttentionList, reordenó CSS,
retocó resolver, rediseñó formularios ni se adelantaron N03/F01/F02.

QA autenticada/física de Growth Film, Planta y Fase 03 sigue pendiente: fotos reales,
permisos/datos de cuenta, operaciones persistidas, teclado/safe areas/pinch de iPhone,
fullscreen nativo Safari y export/render/audio reales. El harness no verifica estas
capacidades ni sustituye esa evidencia. Fuentes externas y avisos históricos de
bundle permanecen límites explícitos, sin abrir optimización en este bloque.

**Recomendación de siguiente bloque: Terra High para 04.C**, porque lo que queda
ahora tiene propietarios y diffs CSS identificados, con el runner integrado como
regresión. Detenerse ante una dependencia funcional nueva; no cambiar modelo por
rutina. Parada obligatoria antes de implementar C.
