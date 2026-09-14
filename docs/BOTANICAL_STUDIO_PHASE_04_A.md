# Botanical Studio — Fase 04.A: baseline integrado y propietarios

Fecha: 13 de septiembre de 2026. Modelo del bloque: **GPT-6 Astra xhigh**.
Producto de referencia: **`6cc1eba`**. Guía: [preflight](BOTANICAL_STUDIO_PHASE_04_PREFLIGHT.md), commit `2a11e61`.

**04.A cerrado localmente. Parada antes de 04.B.**

Este bloque establece cobertura, evidencia y límites de intervención. **No corrige
todavía la experiencia del producto ni cierra Fase 04.** Living Botanical Cinema,
las composiciones aprobadas y V1 permanecen congelados. No se cambian `src`, entrada
del producto, backend, schema, AI, rutas, persistencia ni infraestructura. No hay
deploy, push o publicación. `docs/VISUAL_DEPTH_STUDY.md` y `qa/depth-study*` siguen
siendo trabajo preexistente ajeno a este bloque.

## 1. Baseline real, con servicios aislados

Se incorpora [qa/experience-integration](../qa/experience-integration/README.md).
Ejecuta el entrypoint, `App`, BrowserRouter, StrictMode y superficies **reales**:
Home, Jardines, detalle de jardín/mapa V1, Planta, Maintenance, Hoy, Film de ciclo,
Film de jardín y Ask Garden. No hay páginas destino simuladas entre ellas.

Se sustituyen únicamente los puertos de servicios y PWA en la configuración del
harness. Un grafo sintético compartido conserva IDs de jardín/posición/ciclo,
ocupante actual e histórico, Attention, sesión, fotos, registros y provenance.
Los datos originales permanecen inmutables; visitas se registran separadas de
lecturas; escrituras/AI/puertos no implementados fallan explícitamente. Se compara
el estado **anterior al montaje de App** con el posterior a los recorridos.

Esto demuestra composición, navegación, lecturas y ausencia de intentos de escritura
en los recorridos ejecutados. No demuestra persistencia autenticada ni el éxito
de guardados. Los tests reales de formularios/operaciones siguen cubriendo sus
contratos locales; no se implementó un backend alternativo para producir éxitos.

### Cascade efectivamente cargada

Orden observado en desarrollo, desde `src/main.tsx` y sus imports transitivos:

1. `src/components/botanical/botanical.css`
2. `src/features/cycles/plant-botanical.css`
3. `src/features/gardens/maintenance-botanical.css`
4. `src/features/cycles/growth-film.css`
5. `src/styles.css`
6. `src/visual-pass-a.css`
7. `src/visual-pass-b.css`
8. `src/features/gardens/surfaces-botanical.css`

El build aislado y el del producto generan **el mismo CSS byte a byte**:
`index-CvY2g-Iu.css`, SHA-256
`56fd690175a663bb7c92dbff35231cf4d3035421ae9549502205f6c90c701fd2`.
JS y PWA difieren deliberadamente por el aislamiento. El viewport se conserva
exactamente, incluyendo `maximum-scale=1.0, user-scalable=no`: A01 sigue pendiente.

La coincidencia de CSS y entrada evita atribuir al producto un resultado obtenido
con hojas parciales. No convierte datos sintéticos en evidencia de fotos reales.

## 2. Hallazgos confirmados y descartados

| ID | Resultado integrado | Límite de la conclusión |
| --- | --- | --- |
| **N01** | Confirmado desde mapa y fila. La ruta llega al ciclo correcto, pero falta `[data-place-origin="profile"]`, el adaptador busca `.botanical-portrait h1` y Planta usa `.plant-identity h1`, sin `tabIndex`. El heading no recibe foco. Desde fila, origen `scrollY=807`; el breadcrumb vuelve al jardín en `0`, sin foco en la fila. | La navegación de ruta funciona. El defecto está en identidad/transición/foco/retorno, no en datos o carga de ciclo. No restaurar markup antiguo para arreglar el test. |
| **N02** | Confirmado como hueco de cobertura anterior: el fixture viejo de PlaceLink no era PlantStudio y las suites por superficie no compartían toda la cascade. El nuevo harness reproduce el cruce real. | La caracterización actual no es todavía un test de aceptación de N01 corregido. Se añadirá en 04.B. |
| **V01** | Confirmado. Home emite `home-hero bc-home-hero home-hero--photo`; `.bc-home-hero--photo` coincide con **0** elementos. Título `rgb(25,58,48)` y eyebrow `rgb(102,116,107)` permanecen oscuros sobre la portada oscurecida. | No se cambia foto, composición ni gradiente. La captura sintética prueba el selector; contraste sobre portadas reales sigue pendiente. |
| **V02** | Confirmado: diez reglas globales de Film llegan al detalle de Planta. Al suprimirlas temporalmente en CSSOM, el párrafo pasa de `rgb(182,194,169)` a `rgb(102,116,107)`, margen de `0 0 20px` a `0`, y line-height de `23.8px` a `21.7px`. Se restauran todas las reglas y se comprueba igualdad con el baseline. | **Se descarta el ejemplo de padding del preflight para esta muestra.** Se mantiene `20px 23px` antes/después: el chrome del sheet gana en specificity. La fuga demostrada es de color/espaciado/tipografía. |
| **V03** | Confirmado a 641/690/719 × 844: documento `942px`, chat `696px`, padding inferior del main `142px`. A 320/390/640 × 844: documento `844px`, mismo alto de chat y padding `0`. | A 690, compositor termina en `742.17px`; navegación comienza en `774px`. **No hay superposición del compositor en esa muestra**. Hay scroll externo redundante además del hilo. |

V02 se reproduce entrando en Planta **antes de visitar Film**: el import estático
ya carga sus reglas. No depende de que el usuario haya abierto Film previamente.
La captura `plant-event-diagnostic-390.png` es una comparación de causa, **no una
corrección implementada** ni una propuesta de rediseño.

En anchos ≥720 se conserva por ahora la composición de tarjeta y navegación
flotante existente. La altura documental adicional allí se registra como parte
de F03; no se declara equivalente al fallo móvil V03 ni se elimina por uniformidad.

A **690×480**, el mínimo scoped de `72svh` además prevalece sobre la altura móvil:
chat `345.59px` y documento `592px`. Diagnóstico temporal, sin editar CSS del producto:
`padding-bottom:0` del main y `min-height:0` del chat, bajo `.botanical-ask` ≤719,
dan chat `332px`, documento `480px`, compositor bottom `378.17px` y nav top `410px`.
Al retirar la regla de diagnóstico vuelven exactamente `345.59/592px`. A 390×480
el baseline ya da documento `480px`. Por ello B3 abarca **esas dos propiedades**,
no una extensión completa de los estilos visuales de móvil pequeño.

El recorrido de Maintenance sin registros ni borradores no presenta enlace de
historial. Éste es condicional a `canContinue` o borradores pendientes en
`MaintenancePositionActions`. La flecha Maintenance→Planta del mapa de preflight
es una capacidad contextual, no un enlace siempre disponible. No se detectó pérdida
de datos ni se simuló un guardado para exponerlo.

## 3. Propietarios e invariantes fijados

Estas son reglas para los siguientes diffs. Describen qué debe poseer cada pieza;
no afirman que todos los defectos actuales ya estén corregidos.

| Área | Propietario | Invariante / prohibición |
| --- | --- | --- |
| Primitivas botánicas | `botanical.css` y `BotanicalControls` | Papel/tinta/espacios/controles y ciclo modal compartido. Mantener valores aprobados. Aliases de tokens, si se incorporan en 04.C, no cambian el resultado computado. |
| Tema cinematográfico | `growth-film.css`, bajo `.film-page` / `.film-sheet` | El tema oscuro es intencional. Ninguna regla de contenido Film puede seleccionar un detalle Planta. Las diez `.record-detail` deben quedar bajo `.film-sheet`; no compensar la fuga con más overrides claros. |
| Detalle documental de Planta | `plant-botanical.css`, `.plant-sheet` | Su chrome recibe padding del sheet; el contenido recibe color, ritmo y metadata de Planta. Retener original, fecha, revisión y provenance desplegable. |
| Colecciones y conversación | `surfaces-botanical.css`, scopes de presentación de AppShell | Home/Jardines/Hoy/Ask conservan jerarquía y variantes aprobadas. V01 se resuelve haciendo coincidir el modificador real; no redefiniendo el encabezado. |
| CSS legacy / A / B | Dueños actuales de rutas aún no migradas | No borrar un pase ni reordenar imports completos para resolver un selector. Jardín/mapa, Control, Register, Settings y fotos siguen dependiendo de ellos. Consolidación incremental en 04.C. |
| Llegada y retorno Jardín↔Planta | `PlaceLink` / `PlaceBackLink`; destino expuesto por PlantStudio | Identidad de posición sobre el badge existente, heading actual enfocable programáticamente. Nunca animar fotografía ambiental ni añadir otra representación visual de identidad. |
| Ruta sin origen / enlace modificado | Router y navegador; fallback ordinario | Entrada directa, otra pestaña, URL y destino funcionan sin origen fabricado. Una identidad de otro ciclo/posición no puede servir como destino. El origen efímero debe invalidarse si no corresponde. |
| Navegación principal | `AppShell` | Dueño de enlaces superior/inferior y `aria-current`. No introducir un efecto global que enfoque/scrollée en cada pathname y compita con PlaceLink, tabs, sheets, Maintenance o Film. El foco de rutas sin adaptador mantiene su comportamiento hasta una intervención explícita. |
| Tabs y navegación interna de Planta | `PlantStudio` | Flechas/Home/End, heading del panel y «Recorrer su historia» mantienen su foco/scroll local. El adaptador de entrada actúa una vez para la llegada, no en cada render/cambio de tab. |
| Modal y foco | `BotanicalSheet` | Apertura nativa, foco inicial, Tab/ShiftTab, fondo modal, body lock, busy, Escape/backdrop y devolución al trigger conectado. El contenido posee estado/guardar/cancelar; el sheet no escribe. No duplicar listeners de foco en cada superficie. |
| Scroll de Shell / clearance | `AppShell` y sus estilos scoped | Nav, avisos y contenido disponen de espacio una sola vez. Safe area pertenece al elemento pegado al borde; los hijos consumen ese espacio sin volver a sumarlo. No aplicar un body lock permanente al shell. |
| Scroll de Ask móvil | Scope `.botanical-ask` y estructura del chat | Hasta 719 px el hilo posee el scroll vertical, con header/compositor visibles. Quitar únicamente el padding inferior redundante; no cambiar tipografía/radios de 641–719 por extender todo el bloque de ≤640. Revisar alturas cortas. |
| Scroll operativo | Maintenance y su footer/sheets | Conserva shell propio, progreso, guardas y foco de posición. «Se ve bien» registra una conclusión sólo tras confirmar; «Siguiente planta» conserva progreso operativo sin salud implícita. |
| Navegación y recursos Film | `GrowthFilmPage` / Studio / editor existentes | Conserva ruta de ciclo o jardín, fuentes y vuelta. Abrir no renderiza ni guarda automáticamente. Selección, música, narrativa y blob común preview/export siguen en sus propietarios actuales. |

### Límites por frontera

- **Home:** preservar dashboard, frase/portadas, tres novedades, destinos y llamadas
  de visita existentes. F02 (lecturas de portadas que bloquean carga) no se retira
  como limpieza CSS. Ausencia de novedades/Attention nunca afirma salud.
- **Jardín→Planta:** no modificar mapa V1, numeración, ocupación ni IDs. Añadir
  atributos al badge actual y `tabIndex=-1` al h1 no cambia composición. Breadcrumb
  puede usar el adaptador existente conservando el mismo destino.
- **Planta/Film:** mismo ciclo, historial, originales y provenance. El scope CSS no
  cambia renderer, selección, orden, título, música ni narrativa. Nada nuevo se
  persiste al abrir/cerrar fuentes o cambiar de superficie.
- **Ask:** conservar resolver determinístico y ruta AI desactivada. Preguntar,
  interpretar, ver fuentes y abrir formularios no confirman hechos. F01 (respuesta
  tardía tras nueva sesión) y S01 (copy/contexto de cola) permanecen decisiones
  funcionales separadas, no refactors visuales implícitos.

## 4. Lista cerrada de diffs candidatos para 04.B

Se mantiene la secuencia del preflight: 04.B continuidad/accesibilidad; 04.C
propiedad visual; 04.D chrome/estados; 04.E revisión global. **Ningún diff siguiente
se ha aplicado en 04.A.** Antes de 04.B debe confirmarse el modelo y este alcance.

| Diff | Archivos concretos | Cambio acotado y aceptación |
| --- | --- | --- |
| B1 · N01 | `src/components/PlaceLink.tsx`, `src/features/cycles/PlantStudio.tsx` | Adaptar identidad/foco al badge y h1 actuales; conectar breadcrumb a PlaceBackLink; conservar ruta/state y clics modificados. Esperar destino listo del ciclo correcto, cancelar transiciones obsoletas y limpiar observer/clone/nombres de transición. Restaurar scroll/foco de mapa o fila sólo con origen válido; entrada directa usa fallback. |
| B2 · N02 | `src/components/PlaceLink.test.tsx`, tests de PlantStudio y `qa/experience-integration/baseline.mjs` | Sustituir destino obsoleto por markup/identidad actuales. Probar mapa/fila, breadcrumb/browser-back, carga lenta, cambio rápido de ciclo, reduced motion y ausencia de View Transition API. Convertir esas expectativas corregidas en regresión; no mantener tests que exijan el defecto. |
| B3 · V03 | `src/features/gardens/surfaces-botanical.css` | Scope Ask ≤719: `padding-bottom:0` en main y `min-height:0` en chat para que su altura móvil gobierne también en ventanas cortas. Mantener las demás reglas visuales actuales de ≤640, 641–719 y ≥720; no extender todo el bloque pequeño. Medir 640/641/690/719/720 y altura 480; sin scroll externo redundante ni compositor cubierto. |
| B4 · A01 | `index.html` | Retirar `maximum-scale=1.0,user-scalable=no`; conservar width e initial-scale. Validar reflow/zoom local y dejar prueba Safari física explícita. El harness hereda exactamente el cambio. |
| B5 · A02 | `src/components/botanical/botanical.css`, `src/features/gardens/surfaces-botanical.css`, `src/features/cycles/plant-botanical.css`, `src/features/cycles/growth-film.css` | Ampliar hit area de controles bajo 44 px que se confirmen al medir, sin imponer una silueta común ni reescalar textos. Alcance inicial: Registrar, icon buttons/acciones Planta, range/control Film. Comprobar que el área ampliada no intercepte controles vecinos. No reescribir todos los botones. |
| B6 · A03 | `src/components/AppShell.tsx`, su test y, sólo si es necesario, chrome modal scoped en `src/styles.css` | Montar confirmación de salida con la infraestructura de BotanicalSheet conservando copy, busy, errores y los tres caminos actuales. No cambiar orden signOut/limpieza/export, ni usar una cuenta real para probar. Ampliar fixture de borradores sólo para este caso y tests de invocación explícita. |
| B7 · A04 parcial | `src/components/AppShell.tsx` y pruebas | Añadir `aria-current="page"` según las condiciones activas existentes en ambos navs; sin nuevo destino ni política de foco universal. El foco contextual de B1 es el único cambio de llegada de este bloque. |

**V01 y V02 quedan perfectamente acotados para 04.C**, según el preflight:

1. En `surfaces-botanical.css`, usar el modificador real `home-hero--photo` bajo
   `.bc-home-hero`/scope colección en las dos reglas de título/eyebrow. Portada
   ausente conserva su contraste actual. No tocar HomePage ni su carga de datos.
2. En `growth-film.css`, prefijar las diez reglas `.record-detail` con `.film-sheet`.
   Verificar el detalle claro y oscuro con el mismo bundle antes de quitar otros
   overrides. No cambiar `PlantRecordSheet` ni renderer para esa corrección.

No adelantar consolidación de tokens, extracción de AttentionList, reordenación
de CSS, copy del resolver, continuidad N03, F01/F02 ni rediseño de formularios.
Si B1/B6 revelan una dependencia que altere rutas, estado de sesión o contratos,
detener y presentar ese defecto nuevo antes de ampliar alcance.

## 5. Evidencia y validaciones

Artefactos locales (ignorados por Git), bajo
[`artifacts/experience-integration`](../artifacts/experience-integration/).
No son un preview remoto.

- `baseline/report.json`: observaciones N01/V01/V02/V03, llamadas y comparación de
  dataset por recorrido, medidas responsive y estado de fuentes.
- `baseline/home-390.png`: V01; `plant-event-390.png` y
  `plant-event-diagnostic-390.png`: causa V02; `ask-empty-690.png` y
  `ask-answer-690.png`: geometría/lectura V03.
- `baseline/garden-map-390.png`, `plant-arrival-390.png`, `film-390.png`,
  `film-source-390.png`, `maintenance-390.png`, `maintenance-confirmation-390.png`,
  `today-390.png`: cadena con superficies reales.
- `browser.log`, `tests.log`, `lint.log`, `product-build.log`, `harness-build.log`:
  salida de ejecución. No usar una ejecución histórica como resultado nuevo.

### Matriz ejecutada en 04.A

| Referencia del preflight | Cobertura real y resultado |
| --- | --- |
| Q01/Q02 · parcial | Fila y mapa → Planta; breadcrumb y browser-back; entrada directa. N01 reproducido. Browser-back desde mapa vuelve a `scrollY=204` por comportamiento del navegador, sin foco de mapa: no atribuir ese scroll al adaptador roto. Navegación rápida/reduced motion/carga lenta del destino se prueban con la corrección B1. |
| Q03/Q04 · parcial | Reanudar sesión existente, abrir «Se ve bien», cancelar y volver con browser-back. No hay escritura intentada ni cambio en fixture. Guardar/avanzar/completar se cubren en la suite del producto; no se ejecutan en este harness de lectura. |
| Q08 · parcial | Pregunta determinística real sobre germinación, respuesta con fuentes y enlace a Control. Resolver usa los mismos ciclos que el resto del recorrido. Sin gateway AI ni escritura. Conversación AI/respuesta tardía no probada en navegador. |
| Q09/Q17 · parcial | Planta → Film → fuente → Planta; Film de jardín con ciclos actual/histórico; detalle claro antes de visitar Film y fuente oscura. IDs, revisión y provenance permanecen visibles. V02 reproducido sin alterar los archivos. Export/render/audio no ejecutados. |
| Q11/Q12 · baseline | 23 capturas inspeccionadas. Recorrido principal a 390×844; Hoy abundante a 320; Hoy vacío/Film jardín a 820; Planta abundante a 1440. Ask medido a 320/390/640/641/690/719/720/820/1440 × 844 y 390/690 × 480. Es muestreo integrado, **no cierre responsive de todas las superficies en todos los tamaños**. |
| Q14 · parcial | Sheet nativo Planta enfoca H2 y bloquea body; Escape lo cierra, restaura overflow previo y devuelve foco al trigger. Confirmación Maintenance cancelada. Trap/busy y demás flujos conservan sus tests locales; salida con borradores sigue A03. |
| Q16 · parcial | Home sin foto y error de lectura; Hoy abundante/vacío; Planta abundante; Film vacío. Error puede coexistir con dashboard por las cargas de StrictMode, sin borrar datos. Escenario `slow` disponible, no se declara ejecutado; PWA/offline/captura/teclado siguen fuera. |
| Q20 | Suite final, lint, typecheck del harness, builds producto/harness y fingerprint CSS. Resultado debajo. |
| Q21–Q25 | **Pendiente autenticada/física**, sin cambios respecto del preflight. |

Resultados ejecutados en este bloque:

- `npm test`: **34 archivos / 195 pruebas aprobadas**; incluye ocho pruebas nuevas
  de coherencia/orden del fixture, lecturas inmutables, visita separada, rechazo de
  escrituras, IDs/medios inválidos, recuperación y loader Film/provenance reales.
- `npm run lint`: aprobado, sin errores ni warnings.
- `npx tsc --noEmit -p qa/experience-integration/tsconfig.json`: aprobado.
- `npm run build` y build aislado: aprobados; CSS idéntico. Permanecen los avisos
  históricos de chunk >500 kB y imports dinámicos inefectivos del producto.
- Runner de navegador: salida 0, **23 capturas**, diez verificaciones de estado
  inmutable, cero errores JS. No equivale a que N01/V01/V02/V03 estén corregidos.
- `git diff 6cc1eba -- src index.html package.json package-lock.json vite.config.ts`:
  vacío. Sólo se añaden cobertura/documentación de QA y la referencia del preflight.

Archivos cambiados: esta guía, la referencia en `BOTANICAL_STUDIO_PHASE_04_PREFLIGHT.md`
y ocho archivos bajo `qa/experience-integration`: `data.ts`, `services.ts`, `setup.ts`,
`vite.config.ts`, `tsconfig.json`, `fixtures.test.ts`, `baseline.mjs` y `README.md`.
Artefactos generados no se incorporan al commit ni se publican.

**Invariantes del recorrido:** diez puntos de comparación de dataset pasan; cero
intentos de escritura/AI/puertos no previstos y cero fetch remotos bloqueados. Hay
una llamada de reconocimiento de visita en la cadena iniciada en Home; se preserva
esa semántica y no se presenta como un hecho canónico. Cero errores JS de navegador
en la ejecución terminada; los fallos de selectores y la espera de fuentes durante
la preparación del runner fueron incidencias del harness, no defectos adjudicados
al producto.

**Fuentes:** seis esperas `document.fonts.ready` excedieron 8 s en las entradas
directas de apoyo. Quedan registradas en `fontChecks`; las capturas se inspeccionaron,
pero no se declaran una aprobación tipográfica definitiva de esos estados. El
recorrido que establece N01/V01/V02/V03 no tuvo ese timeout. Las fuentes continúan
dependiendo de Google Fonts; 04.E debe verificar su estabilidad. No se cambió familia,
se descargó una sustituta ni se retocaron imágenes de evidencia.

El diagnóstico corto adicional se conserva en `clearance-diagnostic.json`. Sólo
modificó CSSOM y lo restauró. Ni esa prueba ni el diagnóstico de V02 constituyen
implementación de B3/04.C.

## 6. Modelo siguiente y parada

**Recomiendo GPT-5.6 Sol High para 04.B**, conservando Astra xhigh para la revisión
global final. La razón no es reducir consumo por rutina: ya están identificados
el destino DOM roto, el origen del padding, el alcance de las dos fugas CSS y los
propietarios de foco/navegación. B1–B7 son adaptaciones y pruebas delimitadas sobre
componentes existentes, sin arquitectura ni diseño nuevos.

Terra High puede ser apropiado para un tramo posterior de CSS mecánico/mediciones
una vez cerrados B1/B6; no es la recomendación para tomar ahora esos dos cambios
con ciclo de vida/foco. Reevaluar al terminar 04.B, antes de iniciar 04.C. Si aparece
una complejidad transversal no cubierta por estos invariantes, explicar evidencia
y volver a detenerse para recomendar Astra xhigh.

**Parada: no iniciar 04.B hasta confirmación.** La QA autenticada/física de
Maintenance, Planta, Growth Film y Fase 03 permanece pendiente y separada, igual
que safe areas/teclado/zoom y fullscreen nativo Safari iPhone. No se considera
cerrada Fase 04 ni se autoriza deploy/publicación por este baseline.
