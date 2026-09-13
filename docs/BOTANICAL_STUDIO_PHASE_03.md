# Botanical Studio — Fase 03: extensión del sistema visual

Fecha de preparación: 13 de septiembre de 2026. Estado actual: **Home/Jardines cerrados localmente; Hoy + Ask Garden conectados y validados funcionalmente**. CSS y QA visual/responsive final de Hoy/Ask, QA cruzada de Fase 03 y validación autenticada/física siguen pendientes.

Modelo autorizado para el tramo funcional de Hoy + Ask Garden: **GPT-5.6 Sol High**. No se ha identificado una complejidad nueva que requiera Astra Extra High. El siguiente bloque recomendado es **Terra High para CSS + QA visual/responsive**, pendiente de confirmación del usuario.

## Alcance y base aprobada

Extender Living Botanical Cinema a Home, Jardines, Hoy y Ask Garden sobre los componentes reales. La dirección de [Fase 01](BOTANICAL_STUDIO_PHASE_01.md) está congelada. No se reabren benchmarking, arquitectura, decisiones V1 ni contratos de datos.

La integración de [Maintenance 02.1](BOTANICAL_STUDIO_PHASE_02_1.md), [Growth Film 02.2](BOTANICAL_STUDIO_PHASE_02_2.md) y [Planta 02.3](BOTANICAL_STUDIO_PHASE_02_3.md) es la referencia de ejecución. Esta fase no modifica esas superficies. Siguen pendientes sus validaciones autenticadas/físicas que constan en los informes; en particular, fotos reales y fullscreen nativo de Growth Film en Safari de iPhone.

El tramo inicial de mapeo se basó en lectura del código, componentes compartidos y documentación aprobada, sin crear fixtures, estilos ni componentes. Las implementaciones y sus validaciones posteriores se documentan al final. Los tramos funcionales no sustituyen la QA visual, y ninguna prueba local con fixtures constituye validación autenticada o del backend.

Base inspeccionada: `a3460d9`, rama `codex/botanical-plant-integration`. El worktree separado de Maintenance y los archivos no rastreados `docs/VISUAL_DEPTH_STUDY.md` y `qa/depth-study*` quedan fuera del alcance.

## Reglas de presentación

| Elemento | Aplicación de la dirección aprobada |
| --- | --- |
| Color | Papel `#f4f5ee`, superficie `#fdfdf7`, tinta `#193a30`, bosque `#254b39`, salvia `#e7ecdf`, línea `#dbe0d5`. Reutilizar los tokens de `botanical.css`; no crear otra paleta global. |
| Tipografía | Fraunces en títulos editoriales; DM Sans en texto y controles, con los fallbacks existentes. No cambiar la carga de fuentes en esta fase. |
| Fotografía | Portadas reales elegidas por el usuario. Área reservada durante la carga, encuadre estable, contraste del texto garantizado. Sin fotos de stock, especies inferidas ni portadas elegidas automáticamente. |
| Composición | Ritmo de 8 px con ajustes de 4 px. Una jerarquía clara por sección, superficies tranquilas, bordes finos y sombras contenidas. Evitar cajas dentro de cajas. |
| Controles | Primarios de 50 px; controles de icono y acciones de texto con objetivo táctil de al menos 44 px. Un mismo formato para una misma intención. |
| Glass | Reservado a los lugares ya aprobados sobre fotografía/navegación; no convertir formularios y tarjetas de texto en paneles translúcidos. |
| Movimiento | Transiciones breves. Respetar movimiento reducido también en llamadas JS de scroll; sin animaciones ambientales perpetuas. |
| Semántica | El diseño comunica estados existentes. Una navegación nunca se convierte en confirmación de salud, acción o seguimiento. |

No trasladar los datos de demostración de `qa/botanical/model.ts` al producto. Tampoco introducir un nuevo modelo de salud, prioridades, agrupación temporal o narrativa generada para estas cuatro superficies.

## Mapa real: rutas, datos y operaciones

Las rutas viven en `src/app/App.tsx` y permanecen intactas.

| Superficie | Ruta y entrada | Lecturas y datos actuales | Operaciones / navegación actuales |
| --- | --- | --- | --- |
| Home | `/`; `HomePage.tsx`, recibe `user` | `getHomeDashboard(null)`, `getHome()`, `getHomeMedia()`; además solicita `getGardenCoverPhotos()` por jardín. `HomeDashboard`, portadas, frase personalizada. | Jardines, detalle de jardín, ciclo/jardín de una novedad, Hoy. No hay formulario de registro dentro de Home. |
| Jardines | `/gardens`; `GardensPage.tsx`, recibe `user` | `getHomeDashboard(visitId)`, `getHome()`, `getOpenMaintenanceSession()`. Snapshot y visita guardados localmente por usuario. | Crear jardín; iniciar/reanudar/cancelar sesión de Maintenance; Control; detalle de jardín; novedades; Hoy. Reconoce el snapshot online después de renderizarlo. |
| Hoy | `/today`; `TodayPage.tsx` | `getAttention()`, `getHome()`; conserva el jardín seleccionado si sigue disponible. | Crear seguimiento de jardín mediante `AttentionTaskForm`; gestionar cada pendiente mediante `AttentionTaskEditor`; recargar la cola tras una confirmación. |
| Ask Garden | `/ask-garden`; `AskGardenPage.tsx` | `getControlV2()`, `getAttention()`, `getHarvestHistory()`. Sugerencias/intent en `domain/ask-garden.ts`; configuración en `ai-gateway`. | Respuesta determinística o `askGarden()` según el resolver actual; enlaces a Control, Hoy, Home, Jardines o ciclo; nueva sesión limpia el hilo local. |

**Visitas: conservar las llamadas reales.** Home ya llama a `getHomeDashboard(null)`; Jardines reutiliza un ID válido y llama a `acknowledgeHomeSnapshot(visit.id, snapshot_cursor)` tras `requestAnimationFrame`, sin reconocer un snapshot de fallback. No afirmar que Home carece de efectos de visita sólo por no tener un formulario. El efecto remoto de `garden_get_home_dashboard` no se ha revalidado aquí. Esta extensión no mueve ni añade llamadas de visita, no modifica cursores y no intenta corregir por presentación discrepancias con documentos históricos. Hoy no llama a las APIs de visita.

## 03.1 — Home: entrada al jardín

### Composición propuesta

1. Mantener la portada y la frase personalizadas como apertura editorial. Fotografía protagonista, marca secundaria y acción «Ver jardines» en posición consistente. Reservar su área antes de resolver la URL; el título debe funcionar también sin fotografía.
2. «Tus jardines»: colección de tarjetas fotográficas contenidas. Fotografía arriba, nombre y ocupación debajo sobre papel; el nombre no queda perdido dentro de un overlay. En móvil, una columna que no requiera descubrir un carrusel; en tablet/desktop, cuadrícula según el ancho disponible.
3. «Desde la última vez»: diario breve con los **tres** cambios que Home ya muestra. Respetar `summary`, orden y destino. No convertirlos en supuestos hitos ni añadir fechas que el componente no muestra actualmente.
4. «Atención»: pendientes con título, contexto y etiqueta temporal visibles. La sección actual se llama «Para hoy», pero recibe la cola completa, incluidas fechas futuras y ausencia de fecha. Corregir el encabezado mediante copy, conservando todos los elementos y su orden.

La edición de frase/portada continúa en `SettingsPage.tsx`; no duplicar ese editor en Home. El ordinal decorativo de las tarjetas no es un número de posición física. Los valores `active_positions` y `position_capacity` son ocupación/capacidad, nunca una evaluación de estado.

### Estados que deben sobrevivir

- Preparando Home; error con Reintentar; datos ya visibles junto a un error posterior cuando ocurra así en el componente.
- Cero jardines, uno o muchos; portada ausente; resolución tardía o fallida de imagen; nombres/frase largos.
- Cero novedades; tres novedades como límite actual; pendientes vacíos o con contexto parcial.

El vacío puede orientar a «Ver jardines», usando la ruta existente. No insinuar que «sin novedades» o «sin pendientes» significa que todas las plantas están sanas.

## 03.2 — Jardines: colección y acceso al recorrido

### Composición propuesta

1. Encabezado editorial «Tus jardines», con crear jardín como acción primaria del catálogo. Control y acceso a Maintenance siguen disponibles como acciones diferenciadas, sin competir todos como primarios.
2. Colección de tarjetas con el mismo lenguaje fotográfico de Home: portada real, nombre, modelo y ocupación. Jardines conserva la información de equipo que Home resume. Toda la tarjeta mantiene su destino `/garden/:gardenId`.
3. El acceso a Maintenance y el aviso de sesión abierta forman un bloque operativo reconocible. Reanudar, seleccionar jardines e iniciar conservan sus estados y confirmaciones. Cancelar una sesión sigue siendo explícito y no cambia las revisiones ya guardadas.
4. «Desde la última vez» continúa como diario completo de `HomeChange`, con su fecha y destino actuales. «Atención» permanece como resumen navegable, sin controles de resolución añadidos aquí.

No añadir ordenación, filtros, agrupación por especie ni métricas de salud. No limitar los pendientes porque `compact` sólo modifica presentación. La creación conserva todos los campos de `CreateGardenForm`: nombre, sistema, 8/12 posiciones o sistema personalizado con capacidad de 1 a 36.

### Estados que deben sobrevivir

- Carga; catálogo vacío y primer jardín; uno/muchos jardines; imágenes ausentes/fallidas.
- Primera visita; ausencia/presencia de novedades; fallback cacheado con fecha de snapshot visible.
- Formulario de creación; capacidad personalizada; error/busy; selector de jardines para Maintenance y selección vacía.
- Sesión abierta, inicio, reanudación, confirmación/cancelación de abandono y error de operación.
- Inicio bloqueado sin conexión; snapshot cacheado **sin ack**; error no oculto por la composición.

Los formularios pueden ganar densidad visual mediante etiquetas compactas y controles alineados. Se mantienen inline en este primer bloque: no hace falta introducir nuevos ciclos de modal/cierre para extender el diseño. Si posteriormente se propone una hoja, deberá justificar y probar la preservación de busy, foco y cancelación antes de adoptarse.

## 03.3 — Hoy: gestionar lo que quedó pendiente

### Composición propuesta

1. «Hoy» sigue siendo el nombre de la ruta. Introducción breve: «Revisa lo que dejaste pendiente». No prometer que toda la cola vence hoy.
2. Un único bloque «Añadir seguimiento» con selección de jardín cuando corresponda. Formulario progresivo actual, con el campo de asunto sólo cuando se elige crear por separado.
3. Cola operativa legible: título primero; jardín/posición/planta y temporalidad como contexto; controles de registrar, posponer y descartar con jerarquía coherente.
4. Resolución inline junto al pendiente, conservando la tarea visible. Compactar espacio vertical sin ocultar resultados, campos requeridos, errores ni confirmación final. No crear un segundo editor del dominio.

Reutilizar `AttentionList` con `onChanged` y `AttentionTaskEditor`. Mantener **orden y totalidad** de la cola: no introducir secciones «urgente», filtros «hoy» ni cambios de prioridad. Las etiquetas temporales siguen saliendo de `attentionTimingLabel` y su fecha local actual: Vencida, Para hoy, Programada, Sin fecha.

### Semántica de confirmación

| Propósito actual | Flujo que se conserva |
| --- | --- |
| `evaluate_visual_review` | Guardar revisión → elección explícita entre Se ve bien, Vigilar, Requiere acción o Evidencia insuficiente → guardar observación visual. |
| Otros `evaluate_*` | Guardar evaluación → Listo, Todavía no, No requerido o No determinado → confirmar y completar. |
| `perform_*` | Registrar y completar; no sustituirlo por una afirmación de salud. |
| Posponer | Fecha requerida y nota opcional; operación `deferAttentionItem`. |
| No hace falta | Motivo requerido y confirmación; operación `dismissAttentionItem`. |

Conservar payloads, valores por defecto, request IDs y protección contra doble envío. Cancelar el formulario no invoca ninguna operación de escritura. Crear seguimiento conserva `purpose`, `growCycleId`, `subjectKey`, fecha opcional y distinción entre crear y devolver uno ya existente.

### Estados que deben sobrevivir

Cola vacía; ausencia de jardines; selección de jardín válida tras reload; tareas de jardín y ciclo; contexto incompleto; todos los tipos anteriores; validación nativa; sin conexión; busy; error; cancelación; confirmación y recarga. «Sin pendientes» describe tareas, no salud.

## 03.4 — Ask Garden: conversación editorial

### Composición propuesta

1. Conservar encabezado «Ask Garden», marca discreta y Nueva sesión accesible. Inicio breve con tres sugerencias en filas claras bajo su propia etiqueta.
2. Pregunta del usuario contenida y alineada a la derecha. Respuesta sobre papel, ancho de lectura cómodo y texto seleccionable. Evitar decoración cinematográfica en conversación: el cine sigue siendo Growth Film.
3. Mientras responde, indicador pequeño que ocupa su contenido. La pregunta no cambia de altura al llegar la respuesta. El hilo crece en altura natural, sin estirar filas para llenar la pantalla.
4. Mantener fuentes en el desplegable existente y la distinción **Fuentes confirmadas / Interpretación de Garden AI**. El enlace de acción va junto a la respuesta y conserva el destino actual.
5. Composer persistente dentro de la composición existente: texto legible, enviar con objetivo táctil de 44 px, margen para navegación/safe area. Un único scroll de conversación, sin convertir cada respuesta en otro scroll.

### Evidencia concreta de ajustes de presentación

- `src/styles.css` contiene una regla antigua de sugerencias con `display:flex !important` y otra posterior con `display:grid` sin esa prioridad. La implementación debe resolver esa colisión **en el scope de Ask Garden**, no añadir overrides indiscriminados para toda la app.
- El hilo usa grid y altura delimitada; las filas de mensaje necesitan alineación al inicio y tamaño por contenido. Verificarlo con una respuesta artificialmente lenta, no sólo con la respuesta terminada.
- `threadEndRef.scrollIntoView` solicita `behavior: 'smooth'` desde JS. Respetar `prefers-reduced-motion` en ese punto es un ajuste de presentación acotado; CSS por sí solo no cambia ese argumento.

### Contratos que no se tocan

- `buildAskGardenSuggestions`, rotación en sessionStorage, resolución de intención y las ramas determinísticas existentes.
- El gateway habilitado/deshabilitado, condiciones de llamada a AI, request key, últimas cuatro conversaciones completadas y sus límites actuales.
- Fuentes, texto de respuestas, fechas de cosecha, resultados de Control e historial. No reescribir las respuestas del resolver con copy decorativo.
- Mensaje optimista inmediato, error de petición, textarea de 2.000 caracteres, Enter para enviar y Shift+Enter para salto.
- Nueva sesión limpia el hilo local; no guarda ni elimina fotos, eventos, ciclos o pendientes. No añadir persistencia de conversaciones ni nuevos costes.

El listado determinístico de germinación actualmente muestra posición/planta sin jardín; la respuesta de última cosecha conserva su formato de fecha actual. No convertir esta fase en una modificación del resolver. La cancelación de una petición AI en curso y un nuevo mecanismo de reintentos tampoco forman parte de este bloque.

### Estados que deben sobrevivir

Carga; fallo inicial con Reintentar; vacío con sugerencias; AI deshabilitada; respuesta determinística; interpretación AI; aclaración; respuesta lenta; respuesta larga/multilínea; múltiples fuentes o ninguna; acción con enlace; error de petición; nueva sesión; teclado móvil y movimiento reducido.

## Copy de interfaz permitido

| Actual | Presentación propuesta | Límite |
| --- | --- | --- |
| Home: Para hoy | Atención | No filtrar la cola para justificar el título antiguo. |
| Hoy: explicación de cola canónica/visitas | Revisa lo que dejaste pendiente. | No modificar visitas ni prometer vencimiento diario. |
| Crear jardín: explicación larga del mapa físico | Después podrás ajustar los espacios de cultivo, los puntos técnicos y la distribución de tu equipo. | Conservar las capacidades 8/12/personalizado y los límites. |
| Metadata visual de tarjetas | Nombre → sistema/ocupación como contexto secundario | Conservar nombres y cifras reales. |
| Fuentes/interpretación en Ask Garden | Mismos rótulos, mejor jerarquía y legibilidad | No sustituir provenance por una etiqueta genérica de certeza. |

Los títulos de tareas, resúmenes de eventos y respuestas AI/determinísticas son contenido del dominio. Esta lista no autoriza su traducción, resumen o reinterpretación.

## Archivos y componentes afectados en la implementación

| Archivo | Cambio previsto | Restricción |
| --- | --- | --- |
| `src/features/gardens/HomePage.tsx` | Composición, clases de scope, copy del encabezado Atención y vacío del catálogo. | Mismas lecturas, límites y rutas. |
| `src/features/gardens/GardensPage.tsx` | Colección, jerarquía de acciones, bloques de sesión/selector, diario y scope. | Mantener load, fallback, ack, creación y sesión. `AttentionList` conserva su API. |
| `src/features/gardens/TodayPage.tsx` | Introducción, estructura visual del creador/cola y scope. | No filtrar ni ordenar pendientes; mismas operaciones. |
| `src/features/gardens/AskGardenPage.tsx` | Scope, presentación del hilo/composer y scroll que respeta movimiento reducido. | Sin cambios del resolver, gateway, fuentes o payload de conversación. |
| `src/features/gardens/surfaces-botanical.css` — nuevo, propuesto | Estilos acotados a las cuatro superficies; reutilización de tokens. | No restyle de Planta, Maintenance, Film ni formularios en otras rutas. |
| `src/components/AppShell.tsx` | Añadir variantes de presentación para estas superficies, siguiendo el mecanismo existente. | No cambiar navegación, autenticación, logout, borradores, PWA ni comportamiento de las variantes terminadas. |
| `src/features/gardens/CreateGardenForm.tsx` — sólo si el copy lo requiere | Copy breve conservando el formulario. | Sin cambios de validación/capacidad/payload. |
| `src/features/gardens/AttentionTaskTools.tsx` — condicional | Sólo hooks/clases de presentación si el scope CSS no basta. | No duplicar editor, modificar confirmación ni refactorizar request IDs. Preferir cero cambios funcionales. |
| Tests de presentación/contratos de las superficies — propuestos | Comprobar rutas, contenido preservado y ausencia de escrituras implícitas. | Tests de comportamiento significativos; no snapshots de cada clase CSS. |
| `qa/surfaces-integration/` — nuevo, propuesto | Harness aislado con páginas reales y servicios simulados. | Fuera de producto y sin datos/servicios reales. |

**Reutilizar sin modificar sus contratos:** `GardenCoverImage`, `StatePanel`, `AttentionList`, `AttentionTaskForm`, `AttentionTaskEditor`, controles botánicos existentes. Las hojas `BotanicalSheet` siguen disponibles, pero no es obligatorio convertir los formularios inline en diálogos.

**Fuera del cambio:** `src/app/App.tsx` (rutas), `src/lib/garden-api.ts`, `src/domain/types.ts`, `home-visit.ts`, `ask-garden.ts`, `attention-purpose.ts`, gateway, sincronización offline, migraciones y servicios. `SettingsPage.tsx`, `GardenPage.tsx` y los selectores de portada se prueban como destinos/regresiones, sin extender su diseño dentro de esta fase. No extraer `AttentionList` a otro módulo sólo para mover estilos.

## Secuencia de implementación y puntos de parada

1. **03.A — Home y Jardines, Sol High.** Conectar scopes y composición aprobada; integrar tarjetas, estados, acciones y formularios existentes. Crear el harness aislado de estas rutas y probar contratos de visita/navegación con mocks. Es el primer bloque: fija el lenguaje compartido de colección sin tocar lógica de tareas/AI.
2. **Parada natural tras 03.A funcional.** Reevaluar el siguiente trabajo. Si sólo quedan CSS, capturas y ajustes responsive sobre estados ya conectados y probados, recomendar Terra High para ese tramo. Si queda conexión de estados/acciones, continuar con Sol High tras confirmación. No bajar de modelo sólo porque haya terminado un archivo.
3. **03.B — Hoy, Sol High como referencia inicial.** Aplicar el sistema a la cola y a todos los flujos de resolución, validar cancelación/confirmación y recarga. Reevaluar al quedar sólo QA visual.
4. **03.C — Ask Garden, Sol High como referencia inicial.** Integrar conversación y corregir las colisiones de layout dentro del scope; cubrir respuesta lenta, scroll y fuentes con mocks. Reevaluar al quedar sólo QA visual.
5. **Cierre Fase 03.** QA cruzado de las cuatro superficies y regresiones de las fases 02; tests/build finales; entregar cambios, pruebas y pendientes autenticados separados.

Sol High sigue siendo adecuado para comenzar 03.A: la dirección está resuelta y los datos/formularios ya existen. No hay trabajo específico ni entregable actualmente identificado que requiera Astra Extra High. Sólo se propondría escalar con evidencia nueva, por ejemplo una incompatibilidad real de contratos que obligue a replantear cómo conectar la UI; se documentaría el caso y se detendría el trabajo antes de intervenir.

## Matriz de QA prevista

La matriz siguiente es el plan original. Las entregas al final registran la evidencia local alcanzada; una prueba con mocks no aprueba su contraparte autenticada/física. No repetir como pendientes los controles que el usuario ya aprobó en fases anteriores. Aquí se comprueban la extensión y sus regresiones concretas.

| ID | Superficie / escenario | Resultado esperado | Evidencia necesaria |
| --- | --- | --- | --- |
| V01 | Todas: 320, 390, 820 y 1440 px | Jerarquía aprobada; sin overflow horizontal, texto cortado ni controles superpuestos; botones 50/iconos 44 px. | Capturas y mediciones de navegador. |
| V02 | Móvil horizontal y zoom de texto 200% | Contenido y confirmaciones accesibles; títulos/nombres largos reflow; sin pérdida de controles. | Navegador; corroboración física móvil. |
| V03 | Todas: teclado/foco/movimiento reducido | Foco visible, orden lógico, controles etiquetados; scroll/animación adecuados. | Interacción con teclado y emulación de preferencia. |
| V04 | Shell / safe area / teclado iPhone | Navegación y composer no ocultan confirmaciones ni input enfocado. | Safari de iPhone físico; emulación no sustituye esta prueba. |
| H01 | Home: portada/frase personalizadas | Misma foto y frase; legibilidad con imagen clara/oscura; ninguna portada automática. | Fixtures visuales; luego cuenta autenticada. |
| H02 | Home/Jardines: imagen lenta/fallida/ausente | Área estable y fallback tranquilo; título/control siguen accesibles; rendition/fallback existente preservados. | Mock de URL/carga y captura. |
| H03 | Home: cero/uno/muchos jardines | Todas las tarjetas/destinos correctos; acceso al catálogo en vacío; cifras intactas. | Fixtures y navegación. |
| H04 | Home: novedades 0/1/4+ | Cero con copy neutro; máximo tres como antes; orden, resumen y destino iguales. | Test de contenido/rutas. |
| H05 | Home: pendientes futuros/sin fecha | Sección Atención; mismas tareas y temporalidad; no afirmación de salud. | Fixture de cola mixta. |
| H06 | Home: carga/error/reintento | Ningún estado desaparece; Reintentar vuelve a llamar las lecturas actuales. | Servicios simulados. |
| J01 | Jardines: crear 8/12/personalizado | Todos los campos/límites y payload se conservan; destino al jardín creado. | Test con API mock; luego validación autenticada. |
| J02 | Jardines: abrir/cancelar crear | Cancelar no crea jardín; sin campos ocultos por densidad visual. | Interacción + registro de llamadas mock. |
| J03 | Jardines: seleccionar Maintenance | Selección exacta; iniciar vacío/offline bloqueado; mismo request/destino de sesión. | API mock, offline simulado. |
| J04 | Jardines: reanudar/abandonar | Sesión correcta; abandono sólo tras confirmar; cancelar confirmación no opera. | API mock; luego cuenta de prueba. |
| J05 | Jardines: primera visita/novedades | Diario completo, fechas/destinos iguales; sin interpretar un vacío como salud. | Fixtures de snapshot. |
| J06 | Jardines: online vs fallback cacheado | Mismas llamadas e ID; ack online tras render; cero ack de fallback; fecha de cache visible. | Tests de frontera `getHomeDashboard`/ack y storage. |
| J07 | Home ↔ Jardines ↔ Hoy | No añadir/mover llamadas de visita por composición; links iguales; Hoy no reconoce visitas. | Spies de llamadas + navegación; efecto remoto pendiente. |
| T01 | Hoy: sin tareas / sin jardines | Vacío de tareas neutro; creador sólo cuando hay jardín disponible. | Fixtures. |
| T02 | Hoy: tareas de jardín/ciclo y fechas mixtas | Orden y totalidad preservados; contexto real y etiquetas correctas. | Fixtures/test de contenido. |
| T03 | Hoy: crear seguimiento | Fecha opcional, asunto distinto y respuesta «ya existente» preservados; reload conserva jardín válido. | Test con payload mock. |
| T04 | Hoy: revisión visual | Cuatro resultados actuales; escritura sólo tras confirmación explícita; no confundir nav con Se ve bien. | Mock de complete + cuenta autenticada. |
| T05 | Hoy: evaluación / acción | Cuatro resultados de evaluación o Registrar y completar según propósito; payload intacto. | Test por familia de propósito. |
| T06 | Hoy: posponer / descartar / cancelar | Fecha/motivo requerido; cancelar no escribe; confirmar llama sólo la operación correcta. | API mock y validación nativa. |
| T07 | Hoy: offline / busy / error / doble envío | Bloqueos y request ID existentes preservados; no confirma éxito falso; no oculta error. | Tests de interacción/frontera. |
| A01 | Ask: carga/error/inicio | Reintentar funcional; etiqueta encima de tres sugerencias; rotación actual. | Fixture y test. |
| A02 | Ask: determinístico / AI deshabilitada | Mismos textos, fuentes y destinos; gateway no llamado cuando no corresponde. | Mock gateway + resolver/test existente. |
| A03 | Ask: AI / aclaración / fuentes | Mismo payload/contexto; distinción confirmado/interpretación visible; enlace correcto. | Mock AI y contenido. |
| A04 | Ask: respuesta lenta y larga | Pregunta compacta durante espera; sin estiramiento de burbujas; texto legible y un scroll del hilo. | Latencia simulada, capturas antes/después y scroll. |
| A05 | Ask: composer/Enter/Shift+Enter | Pregunta aparece inmediatamente; límite/disabled actuales; salto no envía; input legible. | Test de interacción + móvil. |
| A06 | Ask: error/Nueva sesión | Error accesible; limpiar hilo no modifica datos del jardín; comportamiento de petición en curso no se refactoriza. | Registro de llamadas mock. |
| R01 | Componentes compartidos | `AttentionList` y formularios en GardenPage/Planta/Maintenance no reciben estilos inesperados. | Smoke/capturas de rutas terminadas + tests existentes. |
| R02 | Shell / logout / borradores / PWA | Rutas, aviso de update y diálogo de cierre conservados; nuevas clases no alteran variantes anteriores. | Tests/smoke aislado; flujo autenticado separado. |
| R03 | Dominio y servicios | Sin cambios de contratos/migraciones; render/nav/AI no añade hechos, fotos o Attention implícitamente. | Diff + spies; conteos autenticados antes/después posteriormente. |

### Harness y validación técnica posterior

Seguir el aislamiento de `qa/plant-integration/vite.config.ts`: páginas reales con APIs simuladas, resolución que rechace imports de Supabase, PWA desactivada y `publicDir: false`. Mockear también los servicios de logout/borradores que importe AppShell; el harness no debe abrir una conexión real por una importación indirecta.

Fixtures tipadas y explícitamente sintéticas: jardines 0/1/muchos, portadas claras/oscuras/ausentes, visitas online/cache, sesiones, tareas de cada propósito, respuesta AI lenta/error y nombres/textos largos. Proveer sólo la marca autorizada y fotografías sintéticas locales o data URI, sin copiar todo `public/`, pistas o fotos privadas. Aislar storage del harness del producto; simular escrituras en memoria y registrar llamadas. Inspeccionar el bundle/red para verificar que no haya endpoints internos, secretos o servicios reales.

Reutilizar como regresión `src/domain/home-visit.test.ts`, `src/domain/ask-garden.test.ts` y `src/features/gardens/GX00Navigation.test.tsx`; ampliar con pruebas de las páginas donde falte cobertura de los escenarios indicados. Los tests de dominio existentes no prueban por sí solos la composición de estas rutas.

Tras cambios de producto: `npm test`, `npm run build`, `git diff --check` y revisión de CSS compartido. Ejecutar lint/typecheck según los archivos afectados y registrar cualquier deuda previa por separado. No atribuir a esta fase los resultados de build/tests de 02.3.

La QA autenticada posterior verificará portadas/frase existentes, creación, sesiones y resolución de pendientes en cuenta de prueba; comparará eventos, fotos, Attention y ciclos antes/después de navegación/Ask y después de cancelar formularios. Los resultados de mocks no establecen ausencia de efectos remotos. Mantener pendiente explícito cualquier escenario físico/autenticado no ejecutado.

## Riesgos y límites del siguiente bloque

- **Cascade compartido:** no cambiar reglas globales para arreglar las cuatro rutas. Revisar también selectores antiguos con `!important` y `:has`, y las variantes de AppShell ya integradas.
- **Visitas:** los mocks pueden demostrar que se conservan llamadas y condiciones de ack; no prueban los efectos remotos del dashboard. No corregir esa frontera sin evidencia nueva y una decisión de alcance.
- **Creación en curso:** `CreateGardenForm` actualmente no deshabilita Cancelar durante busy. Cancelar un formulario sin envío no escribe; cancelar tras enviar no garantiza anular una creación remota. J02 cubre la cancelación antes de enviar. Conservar y documentar esta limitación; no prometer abortar la petición ni cambiar el contrato dentro de una mejora de densidad visual.
- **Carga de portadas:** Home espera también consultas de biblioteca por jardín antes de mostrar el dashboard. Este tramo no autoriza eliminarlas, cambiar caching o rediseñar el servicio de imágenes; una mejora visual no certifica una mejora de latencia.
- **Prueba física/autenticada:** URLs firmadas, efectos guardados, teclado/safe area real y fullscreen de Film siguen requiriendo evidencia independiente. El harness no sustituye esa pasada.

## Entrega y siguiente decisión

El mapeo, límites, cambios visuales, lista de archivos y matriz de QA quedan definidos. El usuario autorizó después 03.A funcional con «Avanza». Su entrega y el siguiente punto de parada se documentan abajo; la matriz completa no queda aprobada por arrastre.

## Entrega 03.A — conexión funcional de Home y Jardines

Estado: **terminada localmente la conexión funcional; la capa visual de Home y Jardines se cierra en la entrega 03.B**. No es un cierre de Fase 03 completa ni una aprobación de Hoy o Ask Garden.

### Implementación

- `AppShell.tsx`: variantes aditivas `collection-home` / `collection-gardens`, con scope `botanical-surface botanical-collection`. Las variantes previas y las rutas permanecen intactas.
- `BotanicalGardenCard.tsx`: tarjeta compartida exclusivamente por estas dos superficies. Portada elegida, nombre y ocupación existentes; sistema visible en Jardines. Fotografía y copy en bloques separados, sin overlays de metadata ni números decorativos que parezcan posiciones físicas. Reutiliza `GardenCoverImage` y los tokens botánicos existentes.
- `HomePage.tsx`: apertura editorial con frase/portada existentes; colección; vacío con acceso al catálogo; diario con el límite de tres novedades; encabezado Atención para la cola completa. Se retiran los anillos decorativos de la apertura.
- `GardensPage.tsx`: catálogo con la misma tarjeta; crear jardín/Control en el encabezado; recorrido, sesión abierta y confirmaciones en un bloque operativo separado; diario y atención en un contenedor compartido de presentación. Crear primer jardín abre el formulario existente.
- `CreateGardenForm.tsx`: copy más breve del mapa físico. Campos, límites, payload y comportamiento no cambian.
- `CollectionPages.test.tsx`: 16 pruebas nuevas de media/contenido, rutas, visitas, fallback por usuario, creación 8/12/personalizado, cancelación, selección/offline, sesión existente, abandono confirmado y error de operación.

Se compararon contra HEAD los bloques de carga/efectos de Home y los bloques de carga/ack/inicio/abandono de Jardines: **sin cambios**. No se tocaron APIs, dominio, migraciones, Hoy, Ask Garden, Planta, Maintenance ni Growth Film. Los formularios siguen inline; `AttentionList` no cambia de módulo ni de API.

### Entorno aislado preparado

`qa/surfaces-integration/`: `QaCollections.tsx`, `fixtures.ts`, `main.tsx`, `index.html`, `vite.config.ts`, `tsconfig.json`.

Usa Home/Jardines y AppShell reales, con nueve escenarios sintéticos, lecturas lentas, errores y registro de llamadas simuladas. Rutas fuera de las dos superficies sólo muestran un destino simulado. Reemplaza APIs, borradores y exportación; rechaza imports de Supabase; desactiva PWA; no copia `public/`. Sólo permite los dos assets de marca conocidos. No tiene cuenta autenticada ni operaciones sobre datos reales.

Build de revisión: `artifacts/surfaces-integration/build`. Contiene HTML, JS/CSS y los dos assets de marca; no contiene originales ni música. El escaneo de marcadores del bundle no encontró endpoints Supabase, cliente Supabase, bucket privado ni marcadores de claves. Este escaneo y el bloqueo de imports no sustituyen una inspección de red en navegador, que queda para el siguiente tramo.

Comandos para el relevo, desde la raíz del repo:

```sh
npx vite --config qa/surfaces-integration/vite.config.ts
npx tsc -p qa/surfaces-integration/tsconfig.json --pretty false
npx vite build --config qa/surfaces-integration/vite.config.ts
```

El servidor se limita a `127.0.0.1:4198` y se detiene con Ctrl+C. No se publica preview y el harness no se traslada al build del producto. La UI identifica que usa CSS de colección aplicada, pero continúa siendo una superficie sintética.

### Validación realizada

| Comprobación | Resultado |
| --- | --- |
| Tests específicos de colección | 16/16 aprobados. |
| Suite completa `npm test` | 32 archivos, 160 pruebas aprobadas. |
| `npm run build` | Aprobado, incluido TypeScript y build PWA. |
| Typecheck del harness | Aprobado. |
| Build aislado del harness | Aprobado. |
| ESLint de los archivos de producto afectados, tests y harness | Aprobado, sin salida de errores/warnings. |
| `git diff --check` | Aprobado. |
| Revisión de React | Tarjeta sin lecturas/estado propios; keys estables; datos derivados sin nuevos efectos; fuentes/operaciones existentes; headings y secciones etiquetados; ninguna duplicación de dominio. |

El build avisa de un chunk de producto superior a 500 kB y de import dinámico inefectivo de `photo-renditions.ts`, también importado estáticamente por la API. No se cambió esa arquitectura para esta integración. La suite imprime el aviso de jsdom «navigation to another Document» sin fallar; no equivale a prueba de navegación física.

### Entrega 03.B — cierre visual de Home y Jardines

Estado: **cerrada localmente la presentación de Home y Jardines**. `surfaces-botanical.css` aporta una capa estrictamente acotada a `botanical-collection`; no cambia datos, rutas, formularios, lógica de visita ni los contratos funcionales de `fbdce7b`.

#### Ajustes aplicados

- Apertura editorial con fotografía existente como protagonista, gradiente de legibilidad, jerarquía tipográfica y acción primaria contenida.
- Tarjetas de jardín con encuadre consistente, portada vacía expresiva, datos de sistema secundarios y grid progresivo: una columna móvil, dos desde 620 px y tres desde 820 px.
- Diario, Atención, estados vacíos y bloque operativo de Maintenance con superficies de papel, borde suave y densidad acorde a cada tamaño.
- Espaciado, tamaños y tipografía fluidos en 320/390/820/1440 px mediante `clamp`, columnas `minmax(0, 1fr)`, `overflow-wrap:anywhere` y padding con `safe-area-inset-bottom`.
- Foco y reducción de movimiento se conservan: no se elimina el foco nativo; las transiciones de tarjeta se desactivan con `prefers-reduced-motion`.

#### Evidencia de QA local

| Comprobación | Resultado |
| --- | --- |
| Scope y regresión funcional | El diff contiene únicamente import de CSS, stylesheet acotado y etiqueta del harness; no hay cambios de TypeScript funcional, APIs, navegación ni formularios. |
| 320 px | Captura headless local de Home vacío; `scrollWidth=320`, controles fuera de viewport `0`, seis headings y sin carga/error persistente. |
| 390 px | Captura headless local de Home normal con dos tarjetas; `scrollWidth=390`, controles fuera de viewport `0`. La variante `read-error` también renderiza el estado de error sin overflow. |
| 820 px | Captura headless local de Jardines denso con siete tarjetas y el grid de tres columnas; `scrollWidth=805` frente a viewport 820 y controles fuera de viewport `0`. |
| 1440 px | Captura headless local de Jardines sin portada; `scrollWidth=1425` frente a viewport 1440, controles fuera de viewport `0` y sin estiramiento horizontal. |
| Foco y movimiento reducido | Tab enfoca el enlace de marca con `:focus-visible`, outline sólido de 2 px; emulación `prefers-reduced-motion: reduce` devuelve transición de tarjeta `0s`. |
| Estados densos, vacío, sin portada, lectura lenta/error y sesión | Nueve fixtures del harness y 16 pruebas de colección; las capturas cubren vacío, normal, denso, sin portada y error. La composición aplica al mismo DOM de los estados restantes. |
| Carga visual local | Harness real servido en `127.0.0.1:4198`, aislado de cuenta y APIs: Home abre con hero, colección, diario, Atención y navegación. Capturas sin controles de QA mediante `embed=1`. |
| `npm test` | 32 archivos, 160 pruebas aprobadas. |
| `npm run build` | Aprobado. |
| Typecheck/build del harness | Ambos aprobados. |
| `git diff --check` | Aprobado. |

Las cuatro medidas se verificaron mediante Chromium headless local con el DOM real de Home/Jardines, capturas y métricas de viewport. Safari local mantiene deshabilitada su automatización remota; no se cambió ningún ajuste del navegador. La evidencia anterior no sustituye la comprobación física/autenticada en Safari de iPhone.

#### Riesgos y pendientes

1. **QA autenticada/física:** portadas reales, teclado y safe area iPhone, efectos de dashboard/visita y operaciones guardadas de jardines/sesiones siguen pendientes. Ninguna operación real se ejecutó aquí.
2. **Prueba física:** comprobar Safari de iPhone, teclado/safe area y zoom de texto 200 % con una cuenta de prueba; los cuatro breakpoints ya tienen evidencia local headless, pero no sustituyen el dispositivo real.
3. Se conservan los límites anteriores: crear tras enviar no aborta la petición, Home espera consultas de biblioteca y URLs firmadas requieren comprobación independiente.
4. El build aún avisa por un chunk de producto mayor a 500 kB y un import dinámico inefectivo previo de `photo-renditions.ts`; no pertenecen a esta capa visual.

Al cerrar 03.B, Hoy y Ask Garden quedaron sin cambios para el siguiente bloque. La entrega funcional posterior figura a continuación. Los pendientes físicos/autenticados de Film y Planta se mantienen separados.

**Parada natural cumplida. Siguiente bloque recomendado: GPT-5.6 Sol High para Hoy + Ask Garden.** El trabajo será una extensión visual sobre flujos ya existentes, pero Hoy reúne estados operativos y Ask Garden requiere conservar con precisión sus garantías de lectura/propuesta sin escrituras implícitas. Sol High ofrece revisión suficiente de esos contratos y la aplicación de patrones aprobados. Elevar a Astra sólo si la inspección muestra una frontera nueva de AI, navegación o persistencia que no esté cubierta por los contratos actuales. No avanzar sin confirmación del usuario.

### Entrega — Hoy + Ask Garden: tramo funcional

Estado: **tramo funcional cerrado localmente**, sobre base `9627fae`. El usuario autorizó reunir ambas superficies en este bloque; se mantiene la separación respecto del siguiente tramo de CSS/QA visual. No se considera cerrada toda la Fase 03.

#### Conexión aplicada

- `AppShell` añade variantes `today` y `ask`, con scopes `botanical-today` y `botanical-ask`. No reciben el scope de colección; Home/Jardines mantienen sus clases, navegación y reglas de visita.
- Hoy adopta la introducción aprobada «Revisa lo que dejaste pendiente.» y secciones etiquetadas de creación y cola. Conserva `getAttention`/`getHome`, orden completo, jardín seleccionado válido y todos los editores canónicos existentes. No hay una nueva capa de tareas, prioridades o persistencia.
- Ask Garden separa la etiqueta de las tres sugerencias y expone un marcador del mensaje pendiente para ajustar su tamaño posteriormente. Conserva composición, fuentes desplegables, enlaces y composer. El scroll JS usa `auto` con movimiento reducido y `smooth` en el resto.
- El resolver determinístico, textos de respuesta, rotación, condición del gateway, request keys, contexto acotado y submit permanecen intactos. **Garden AI no se activó**. Las respuestas AI de las pruebas y del harness son fixtures locales.
- `AttentionList`, `AttentionTaskForm` y `AttentionTaskEditor` no fueron modificados. Se probaron desde Hoy: evaluación explícita, acción realizada, posposición, descarte y creación siguen llamando a las mismas operaciones sólo tras confirmar.

#### Archivos de esta entrega

| Archivo | Cambio |
| --- | --- |
| `src/components/AppShell.tsx` | Variantes aditivas de presentación, sin modificar rutas/acciones del shell. |
| `src/features/gardens/TodayPage.tsx` | Introducción y secciones accesibles alrededor de la cola/formularios existentes. |
| `src/features/gardens/AskGardenPage.tsx` | Sugerencias separadas, marcador de pendiente y scroll con movimiento reducido. |
| `src/features/gardens/OperationalPages.test.tsx` | 27 pruebas de los componentes reales con servicios/gateway simulados. |
| `qa/surfaces-integration/QaCollections.tsx` | Rutas Hoy/Ask y selector de escenarios. |
| `qa/surfaces-integration/fixtures.ts` | Cola mixta de trece propósitos, contexto parcial, tareas vacías, proyección/cosecha sintéticas y respuestas AI simuladas. |
| `qa/surfaces-integration/main.tsx` | Inicialización del escenario fuera del render para cumplir las reglas de hooks. |
| `qa/surfaces-integration/vite.config.ts` | También sustituye el gateway por fixtures; mantiene el bloqueo de imports Supabase. |
| `qa/surfaces-integration/index.html` | Etiqueta del harness de Fase 03. |
| Este documento | Cierre funcional, evidencia, riesgos y siguiente parada. |

No se modificaron CSS, rutas de producto, APIs, dominio, contratos V1, variables de entorno, migraciones ni dependencias. Los archivos no rastreados de `depth-study` siguen fuera de alcance.

#### Evidencia funcional

| Matriz | Evidencia alcanzada | Validación restante |
| --- | --- | --- |
| T01–T02 | Vacío/sin jardines, orden/fechas/contexto parcial y trece propósitos con editores correctos; pruebas de DOM. Harness mixto renderiza 13 tareas. | Presentación final en los cuatro tamaños; cola real autenticada. |
| T03 | Payload de seguimiento distinto, fecha opcional, respuesta ya existente, conservación de jardín válido y fallback si desaparece. | Operación/persistencia real y densidad del formulario. |
| T04–T05 | Cuatro resultados visuales y cuatro de desarrollo; acción realizada con `reviewResult:null`; nada se escribe al elegir/visualizar. | Resultado/evento canónico real tras confirmar. |
| T06–T07 | Fecha/motivo requerido comprobados mediante validez nativa del DOM; cancelar no escribe; payloads de posponer/descartar; offline, error, request ID reutilizado y doble submit bloqueado durante busy. | Interacción nativa en Safari y persistencia autenticada. |
| A01–A03 | Carga/error/reintento, tres sugerencias separadas, ruta determinística aunque gateway esté ready, fallback disabled, cosecha confirmada y destino, AI lenta/aclaración/fuentes/no fuentes con mocks. Rotación/resolver conservan las pruebas de dominio existentes. | Fuentes reales autenticadas; no habilitar AI por esta entrega. |
| A04–A06 | Pregunta optimista durante espera, render de respuesta larga, contexto limitado a cuatro preguntas/respuestas y longitudes 300/500, request keys nuevas, error conservando pregunta, Enter/Shift+Enter, maxlength y Nueva sesión sin escrituras. | Tamaño de burbujas, selección/copia, lectura/scroll y teclado físico. |
| V03 / R03 | Scroll JS `auto` con movimiento reducido; tests de navegación/Ask sin llamadas de escritura de Attention; diff sin cambios de dominio/gateway/persistencia. | Foco/objetivos táctiles y comparación de conteos reales. |

**Prueba de carga e interacción en Chromium local:** harness en `127.0.0.1:4198`, sin errores de navegador ni overlay de Vite. Hoy mostró trece tareas; tras seleccionar «Vigilar» y confirmar, el registro simulado contiene una sola llamada `completeAttentionItem` con `reviewResult:"watch"` y quedan doce tareas. Ask recibió una pregunta por Enter y produjo una llamada `askGarden (SIMULATED)`, fuentes de interpretación y cero operaciones de escritura. Los recursos externos observados fueron las hojas de Google Fonts existentes, no servicios de Garden ni proveedores AI.

Capturas locales de carga, **no aprobación visual final**:

- `artifacts/surfaces-integration/phase03-functional/garden-phase03-hoy-smoke.png`
- `artifacts/surfaces-integration/phase03-functional/garden-phase03-ask-smoke.png`

Se cerraron navegador y servidor al terminar. Para retomar el harness: `npx vite --config qa/surfaces-integration/vite.config.ts`; entradas locales `/?surface=today&scenario=mixed-attention&embed=1` y `/?surface=ask-garden&scenario=ai-answer&embed=1`. No son URLs remotas ni despliegues. Los escenarios `ai-*` sustituyen el gateway, nunca configuran el AI real. El checkbox de lectura lenta permite observar la espera; los botones de fallar lectura/guardado sólo afectan fixtures.

| Validación final | Resultado |
| --- | --- |
| `npm test` | 33 archivos, 187 pruebas aprobadas (27 nuevas). |
| `npm run build` | Aprobado; incluye typecheck del producto. |
| `npm run lint` | Aprobado sin errores ni advertencias. |
| Typecheck del harness | `npx tsc -p qa/surfaces-integration/tsconfig.json --pretty false` aprobado. |
| Build del harness | `npx vite build --config qa/surfaces-integration/vite.config.ts` aprobado. |
| Revisión React | Keys de tareas/mensajes/sugerencias conservadas; sin nuevos efectos de datos, estado duplicado o formularios alternativos; secciones/input etiquetados; render del harness sin acceso a refs. |
| `git diff --check` | Aprobado. |

#### Riesgos y límites

1. **CSS y QA visual/responsive pendientes.** En la prueba de Hoy a 1280×720, un botón de confirmación quedó bajo la navegación fija en su punto de clic; después de centrarlo con scroll se pudo confirmar normalmente. El siguiente tramo debe garantizar que navegación/composer no cubran controles, sin recurrir a clics forzados. Se conservan las colisiones CSS ya identificadas para sugerencias y los tamaños de mensajes pendientes.
2. V01/V02/V04 y la parte visual de A04/R01/R02 no se cierran aquí: faltan 320/390/820/1440 px, zoom 200%, teclado/foco, tamaños táctiles, contenidos abundantes y regresiones visuales cruzadas.
3. **QA autenticada/física pendiente:** tareas reales, persistencia de evaluaciones/acciones/posposición/descarte y conteos antes/después de Ask; teclado/safe area y Safari de iPhone. Mocks/build/browser sintético no prueban el backend, RLS ni el dispositivo.
4. Se mantienen los límites de comportamiento existentes: Nueva sesión no aborta una consulta AI en curso; Hoy puede conservar contenido previo junto al error de recarga; cambiar presentación no modifica esos contratos. Los fixtures ilustran estados, no reproducen toda la idempotencia/semántica del servidor.
5. Build conserva avisos previos de chunk >500 kB e import dinámico inefectivo de `photo-renditions.ts`. La suite conserva el aviso no fatal de jsdom sobre navegación a otro documento.

**Parada natural: recomendar Terra High para CSS + QA visual/responsive de Hoy y Ask Garden.** La dirección, datos y operaciones ya están definidos y probados; el siguiente trabajo consiste en aplicar estilos acotados, resolver las colisiones documentadas y obtener evidencia de navegador en los tamaños previstos. No hay una complejidad nueva de arquitectura o AI que justifique Astra. No continuar ni publicar hasta nueva autorización.
