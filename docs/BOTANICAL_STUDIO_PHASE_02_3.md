# Botanical Studio — Fase 02.3 · Planta

Estado al 12 de septiembre de 2026: **integración funcional y validación automatizada de Sol High terminadas; CSS aprobado y QA visual/responsive pendientes de Terra High**. La Fase 02.3 todavía no está cerrada.

El usuario aprobó la dirección de la Fase 01, la preparación con Astra Extra High y la integración funcional con Sol High. No se abre otra exploración visual. Esta guía conecta la maqueta aprobada con las capacidades existentes; no introduce otra fuente de verdad.

## Base y alcance

- Base de código: `69654f3`, sobre `77f6959` y `28b368f` de Growth Film y `9b42fea` de Maintenance.
- Rama de preparación: `codex/botanical-plant-integration`, creada desde esa base. El worktree de Maintenance sigue separado. Los archivos sin seguimiento `docs/VISUAL_DEPTH_STUDY.md` y `qa/depth-study*` son ajenos a esta entrega.
- **Growth Film 02.2: implementación y QA responsive cerrados por el usuario.** Permanecen pendientes la QA autenticada con fotos reales y el fullscreen nativo en Safari de un iPhone físico. No dependen del cierre de esta preparación ni quedan aprobados por arrastre. [Informe y límites](BOTANICAL_STUDIO_PHASE_02_2.md).
- Referencia visual inalterable: `qa/botanical/Plant.tsx`, las reglas de Planta y sus breakpoints en `qa/botanical/design.css`, y las hojas de `qa/botanical/RecordSheet.tsx`. [Dirección aprobada](BOTANICAL_STUDIO_PHASE_01.md).
- Integrar `/cycle/:cycleId`. Mantener las rutas de historia, comparación, compartir y Growth Film. No integrar el contenedor de demostración, sus fixtures ni su almacenamiento en memoria.
- Sin cambios de esquema, RPC, reglas V1, autenticación o publicación. No ampliar Home, Jardines, Hoy, Ask Garden o Maintenance.

## Composición que debe conservarse

1. Contexto jardín/posición y opciones discretas; fotografía protagonista con acceso a su original y origen.
2. Retrato e identidad en dos columnas en escritorio, apilados en móvil. Misma tipografía, jerarquía, tamaños, alineación, espacios, radios y tratamiento fotográfico de la referencia.
3. Nombre común principal; debajo, en el bloque de nombre botánico ya existente, **inglés · científico**. Ejemplo aprobado: `Albahaca genovesa` / `Genovese Basil · Ocimum basilicum`. No añadir otra tarjeta, etiqueta ni bloque que desplace la composición.
4. Datos breves del ciclo, «Registrar un momento» como entrada principal y «Recorrer su historia» como acceso al diario.
5. Pestañas «Su presente» / «Su historia». El presente muestra la última observación registrada, preparación para cosecha, invitación a Growth Film y acceso a Garden AI. La historia conserva tira de fotos y registros consultables.
6. Hojas contextuales para registrar, revisar y consultar detalles. Un solo modal activo; no recuperar la pila de formularios abiertos bajo la página ni duplicar mensajes de guardado.

Los textos de ejemplo de la maqueta no son datos del producto. Sin observación, la tarjeta indica que aún no hay una registrada; sin fotografía, presenta el estado vacío correspondiente. «Ciclo activo» describe el ciclo, no la salud de la planta. No convertir edad, una imagen o una sugerencia AI en una conclusión confirmada.

## Decisiones de integración

### Lectura y presentación

Mantener `CyclePage.tsx` como controlador de ruta, carga, revisiones, borradores y operaciones posteriores al guardado. El componente interno continúa identificado por `cycleId` para aislar ciclos. Separar la composición visual en `PlantStudio.tsx`; no copiar la lógica de simulación de `Plant.tsx`.

Crear un adaptador puro `plant-presentation.ts` que derive sólo lo que la pantalla necesita de `GrowCycleDetail` y de los formateadores actuales:

- Identidad del ciclo y su estado; jardín/posición como ubicación informada actualmente por el servicio, sin atribuirla automáticamente a capturas anteriores.
- Foto de portada elegida; en su ausencia, fotografía disponible del mismo ciclo. Nunca sustituir una portada válida por «la última foto» al refrescar.
- Cantidad de fotografías únicas por ID, sin contar dos veces portada e historial ni presentar número de eventos como número de fotos. Si las lecturas disponibles no permiten afirmar un total completo, describir el número como fotografías disponibles.
- Siembra y precisión exacta/aproximada/desconocida. No usar horas UTC para convertir arbitrariamente una fecha de calendario en otro día. No mostrar una edad exacta con fecha desconocida; en ciclos cerrados, no seguir incrementando una supuesta edad de crecimiento sin fecha de cierre confirmada.
- Última observación real con su nota y fecha. Revisiones, intervenciones y sugerencias AI conservan su propio significado y origen.
- Estado de cosecha desde `harvest_readiness`, sin inferir que está lista por edad o fotografía.
- Historial y correcciones conservando IDs, tipo, datos estructurados, precisión temporal y orden del contrato actual. Mantener `eventLabel`/`eventDetail` y su compatibilidad, incluida su exportación desde `CyclePage` usada por pruebas existentes.

No crear un estado paralelo de salud, germinación o incidencias dentro del adaptador. Cuando sea necesario mostrar esos datos, usar los eventos y proyecciones existentes, preservando su incertidumbre.

### Nombres sin cambiar los registros

La respuesta actual de ciclo contiene `crop_name`; no proporciona campos separados de nombre común, inglés y científico. Por tanto:

- Usar un pequeño módulo de presentación `plant-names.ts` con correspondencias explícitas y verificadas. La correspondencia Genovese Basil / Ocimum basilicum ya forma parte del ejemplo aprobado por el usuario.
- Para ampliar ese catálogo, verificar la identidad de cada especie/cultivar; no usar coincidencias difusas ni un modelo para adivinarla. Normalizar sólo espacios y mayúsculas de alias conocidos.
- Conservar siempre el `crop_name` original para operaciones y trazabilidad. Una traducción visible no renombra el cultivo en el backend.
- Si no existe correspondencia fiable, mantener el nombre original como título y declarar en la línea secundaria que el nombre botánico no está confirmado. No inventar un nombre científico ni una precisión de cultivar que los datos no contienen.
- Mantener el estilo y separación del bloque aprobado. Probar nombres largos con salto de línea natural, sin reducir la fuente para ocultar problemas de anchura.

### Formularios existentes dentro de las hojas

`CycleActions`, `CycleFactRecorder`, `ObservationComposer` y `AttentionTaskForm` ya admiten presentación integrada (`embedded`) y callbacks de cancelación/guardado. Reutilizarlos con `BotanicalSheet`/`BotanicalButton`. No reescribir su persistencia.

Crear `PlantRecordSheet.tsx` para coordinar un estado discriminado: selección de registro, observación, estado/acción confirmada, operaciones de ciclo, seguimiento o análisis. Las vistas de detalle pueden usar la misma infraestructura modal, con una única hoja visible.

La entrada «Registrar un momento» debe exponer opciones comprensibles y completas:

| Entrada visible | Destino real | Semántica |
| --- | --- | --- |
| Una observación | `ObservationComposer` | Nota y/o foto; guardar mediante el flujo de borradores y sincronización existente. |
| Registrar estado o acción | `CycleFactRecorder` | Germinación, conteo, estado visual, desarrollo, preparación para cosecha, intervención, abrir o resolver una incidencia. Descripción breve con estos ejemplos para que sea encontrable. |
| Algo que hice / operaciones de la planta | `CycleActions` | Cosechar, trasladar/intercambiar, corregir siembra, cerrar, reemplazar/resembrar, según disponibilidad actual. |
| Algo para revisar después | `AttentionTaskForm` | Seguimiento explícito, con o sin fecha, conservando la prevención de duplicados y la opción de crear por separado. |

La fila de «otros registros» pendiente en la maqueta se sustituye por acceso funcional a germinación/conteos/incidencias. No dejar un aviso de «próximamente» ni limitar el producto a las tres opciones simuladas.

Las operaciones de ciclo también pueden alcanzarse desde las opciones de la planta. Se abre el formulario existente antes de escribir; no se ejecutan al elegir una categoría. Evitar un formulario genérico que transforme cosecha o traslado en una mera nota.

### Conservar todas las capacidades

| Capacidad | Implementación que se conserva | Regla de montaje |
| --- | --- | --- |
| Germinación y conteos | `CycleFactRecorder` → `germination_observed`, `plant_count_observed` | Preservar clase de conteo, cantidades y fechas; no sustituir por texto libre. |
| Estado, desarrollo y preparación | `visual_review`, `development_review`, `readiness_review` | Evaluación explícita; no concluir estado al navegar. |
| Intervenciones y soporte | `intervention` y campos actuales | Mantener añadido/ajustado/retirado y demás distinciones existentes. |
| Incidencias | `incident_opened`, `incident_resolved` | Resolver una incidencia identificada del mismo ciclo; no fabricar ni cerrar otra por coincidencia de texto. |
| Cosecha | Formulario actual de `CycleActions` | Conservar resultado, fecha y evento real de cosecha. |
| Traslado e intercambio | Formulario actual de `CycleActions` | Permitir los destinos vacíos y ocupados que ya ofrece; mantener intercambio en el mismo jardín y validaciones actuales. No prometer traslado entre jardines si el formulario no lo ofrece. |
| Corrección/cierre/reemplazo/reapertura | Operaciones actuales de `CycleActions` | Preservar revisiones, motivos y restricciones. Reemplazar navega al nuevo ID devuelto; nunca escribe en el ciclo anterior por una respuesta tardía. |
| Seguimientos | `AttentionTaskForm` y `AttentionTaskEditor` | Crear, evaluar/completar, posponer o descartar con la semántica actual. Una evaluación completada no afirma que se hizo la intervención. |
| Fotos, originales y recuperación | `DocumentaryPhoto`, `PhotoEvidence`, sincronización actual | Mantener precisión de captura, tipo original, carga pendiente, reintento y recuperación del archivo. |
| Portada de planta/jardín/Home | `PhotoCoverActions` | Reutilizar el ID; no duplicar la foto. Actualizar el retrato tras un éxito confirmado. |
| Historia, comparación y fuentes | Formateadores y rutas actuales | Mantener fotos históricas, límites del ciclo y acceso al original; no fusionar ciclos por posición o especie. |
| Invalidación/correcciones | `CycleActions` y `cycle.corrections` | Mantener acceso desde el detalle del registro elegible y operaciones existentes. Una foto histórica sin evento no adquiere un evento inventado para poder invalidarla. |
| Compartir y Growth Film | Rutas y mecanismos actuales | Conservar permisos y enlaces existentes. Planta no genera un clip ni una URL pública al abrirse. |
| AI | `AiCheckPanel`, análisis de foto pendiente y acciones tipadas | Sólo interpretar/proponer. Abrir una propuesta no confirma un hecho ni crea un seguimiento. |

### Seguimientos y accesos contextuales

`GrowCycleDetail` no incluye una lista de Attention. Cuando una hoja de revisión necesite los seguimientos existentes, usar la lectura disponible `getAttention()` y filtrar estrictamente por `grow_cycle_id === cycle.id`. No colocar pendientes de todo el jardín dentro de la planta ni añadir un listado nuevo al presente aprobado. Cargar al abrir la hoja y refrescar tras una modificación; un error es «No se pudieron cargar», nunca «Sin pendientes».

Reutilizar `AttentionTaskEditor` para completar, posponer o descartar los elementos compatibles, preservando los resultados de evaluación actuales. Si necesita presentación `embedded`/callbacks de ocupación, añadirlos como props opcionales con el comportamiento de Hoy conservado.

La fila de cosecha abre su contexto y acciones disponibles: evaluar preparación o planificar una revisión. No registrar una cosecha al pulsar «Revisar».

### AI, enlaces y borradores

- Conectar `AiCheckPanel.onCanonicalAction` a la hoja correspondiente. Los enlaces existentes con `#cycle-fact`, `#cycle-attention` y `location.state.aiAction` deben abrir esa hoja tanto al entrar como al navegar dentro de la misma ruta, sin recargar.
- Validar que la acción corresponde al ciclo actual. Un enlace puede preseleccionar un formulario, nunca enviarlo. Limpiar el estado de apertura consumido para que cancelar no lo reabra en cada render/refresco; seguir permitiendo otra apertura explícita posterior.
- La acción global «Registrar» del shell debe abrir la misma hoja; no seguir buscando por scroll un formulario inline que ya no existe. Ofrecer un callback opcional, conservando el comportamiento de otras rutas.
- Analizar requiere un toque explícito. Mantener una salida visible para cerrar el análisis y cancelar un formulario sin guardar. No usar un resultado AI como observación real del presente.
- Si una propuesta parte de una foto aún sin guardar, mantener su formulario y borrador al cambiar temporalmente a otra hoja. Usar el patrón de conservación de `MaintenancePositionActions`, sin importar su controlador de avance entre plantas.
- Conservar sincronización y recuperación de borradores del ciclo; mantener separadas confirmación local y confirmación del servidor. No anunciar «guardado» remoto si sólo está en cola.
- Proteger selecciones y peticiones contra resultados tardíos de otro ciclo/foto. Cerrar una vista o recibir una propuesta atrasada no debe reabrirla ni disparar una operación.

### Guardado, errores y navegación

Los formularios retienen sus IDs de petición, validaciones, revisiones y protección de doble envío. Durante una operación, `busy` protege el cierre de la hoja; al fallar se conservan campos y posibilidad de reintentar. Si la escritura tuvo éxito y falla la lectura posterior, mostrar que falta actualizar la vista y reintentar la lectura: no repetir la escritura como si hubiera fallado.

Después de guardar, refrescar los datos relevantes y mostrar una única confirmación breve. Permanecer en la planta salvo una operación existente que devuelva otro ciclo, como reemplazar. Cambiar de pestaña, abrir una foto, cerrar AI, ir a historia o volver al jardín son navegación pura.

Los ciclos cerrados conservan consulta de historia, fotos, correcciones, compartir y película. Las escrituras siguen las restricciones existentes y la reapertura conserva sus condiciones. No reutilizar los permisos del ciclo activo al abrir uno anterior.

## Archivos previstos y límites

| Archivo | Cambio previsto |
| --- | --- |
| `src/features/cycles/CyclePage.tsx` | Coordinar datos/formularios y montar Planta aprobada; conservar carga, sincronización y aislamiento por ciclo. |
| `src/features/cycles/PlantStudio.tsx` (nuevo) | Retrato, identidad, presente, pestañas y entradas de navegación fieles a la maqueta. |
| `src/features/cycles/PlantHistory.tsx` (nuevo) | Presentación del historial, detalles, fotos/correcciones y paginación inicial de diez; «Ver 10 más» y «Mostrar menos». |
| `src/features/cycles/PlantRecordSheet.tsx` (nuevo) | Hojas y selección de capacidades reales; cancelar, retorno y conservación de borradores. |
| `src/features/cycles/plant-presentation.ts`, `plant-names.ts` (nuevos) | Adaptación pura de datos y nombres verificados; ninguna escritura. |
| `src/features/cycles/plant-botanical.css` (nuevo) | Reglas de Planta extraídas de la referencia y limitadas a `.plant-page` / `.plant-sheet`. |
| `src/components/AppShell.tsx` | Variante/slots opcionales para esta presentación, eliminar título duplicado y conectar Registrar. Conservar navegación, sesión y protección de borradores al salir. |
| `src/features/cycles/PhotoCoverActions.tsx` | Si hace falta, callback opcional de éxito para recargar el retrato; no deducir éxito de un mensaje traducido. |
| `AiCheckPanel.tsx`, `AttentionTaskTools.tsx`, formularios compartidos | Sólo adaptaciones opcionales necesarias para hojas/retornos y protección asíncrona; no cambiar el dominio ni el comportamiento de otras superficies. |
| `qa/plant-integration/*` (nuevo) | Entorno aislado con componentes reales y API simulada; estados abundantes, errores y medios sintéticos. Sin cuenta ni servicios internos. |

No reemplazar `BotanicalPortrait` globalmente: otros consumidores pueden mantenerlo. La nueva composición vive en Planta. No importar todo `qa/botanical/design.css`; los estilos de Film y Maintenance quedan fuera del alcance. Respetar el shell autenticado y sus destinos reales, sin trasladar los controles de demostración del Studio. Usar una sola jerarquía de encabezados y evitar un segundo `<main>`.

## Validación de implementación

### Funcional y de datos — Sol High

Pruebas de comportamiento sobre componentes reales con lecturas/escrituras simuladas, además de los tests existentes. Cubrir:

1. Planta activa/cerrada, datos ausentes, fotos pendientes, fechas aproximadas y nombres desconocidos. No inferir estado ni mezclar ciclos.
2. Navegación, pestañas, original, AI y cancelación sin mutaciones; propuesta prellenada abierta al instante, incluso en la misma ruta.
3. Germinación, conteo, intervención e incidencia mantienen payloads y formularios actuales. Prueba representativa de doble toque/error/reintento con una sola escritura; conservar los tests del resto del dominio.
4. Seguimiento creado y completado con resultados explícitos; error de carga distinguible de lista vacía. Filtrado por ID del ciclo.
5. Traslado a posición ocupada y vacía; reemplazo al ID nuevo; ciclo cerrado y reapertura con las restricciones existentes. Probar como operaciones simuladas antes de pedir validación con datos reales.
6. Observación y foto conservadas al abrir/cancelar AI; borrador en cola no contado como foto remota; recuperación/sincronización sin duplicados.
7. Portada cambia al confirmar y se mantiene tras recarga; no upload adicional para elegir portada.
8. Historia inicial de diez, ampliación y contracción sin perder originales, fuentes, acceso a invalidación/correcciones o precisión temporal.
9. Respuestas tardías y error de lectura tras una escritura exitosa no provocan reenvíos, retornos ni datos de otro ciclo.

Mantener la suite de Maintenance y Growth Film como regresión si se cambia un componente compartido. `CyclePage.presentation.test.ts` sólo prueba formateo; por sí sola no prueba la integración de Planta.

### Visual y responsive — Terra High, después del relevo

Comparar con la Planta aprobada, no con otro referente. Capturar 320/390/820/1440 px con nombre corto/largo, fotografía vertical/horizontal, sin foto y contenido abundante. Revisar la página y cada hoja funcional que tenga distinta densidad, no sólo la portada.

Verificar encuadre, línea inglés/científico, tamaños de toque, contraste, teclado/foco, Escape/cierre, retorno al disparador, pestañas accesibles, `prefers-reduced-motion`, ausencia de desplazamiento horizontal de página y campos/botones alcanzables con pantalla corta. Las tiras de fotos sí pueden tener scroll horizontal deliberado. Probar «Dejarlo planificado» sin dobles títulos, márgenes redundantes o footer que tape campos.

El entorno aislado debe usar los componentes de producción y medios identificados como sintéticos, con todos los métodos de API sustituidos explícitamente. No exponer `.env`, clientes autenticados, archivos privados o URLs firmadas. La maqueta Fase 01 sirve como referencia visual, no como prueba funcional de la integración.

### Cierre y prueba real

Ejecutar tests pertinentes, `npm run build`, ESLint de los archivos modificados y build del entorno de QA. Registrar por separado evidencia automatizada, navegador con fixtures y cuenta/dispositivo real. Publicar un preview sólo cuando se autorice ese paso; no reutilizar túneles caducados como entrega.

La prueba autenticada requiere fotos/ciclos reales y confirmar cambios efectivamente guardados. No realizar traslados, cierres o reemplazos destructivos sobre cultivos reales sólo para obtener un check de QA. Usar datos de prueba autorizados o dejar el caso explícitamente pendiente. El fullscreen físico pendiente de Growth Film continúa en su informe, sin convertirlo en requisito ya verificado por esta fase.

## Tramos y regla de modelos

| Tramo | Modelo recomendado | Punto de detención |
| --- | --- | --- |
| Preparación: contratos, capacidades, composición y matriz de validación | Astra Extra High | **Terminado en el corte previo `3ac29e4`.** |
| Integración de datos, componentes, formularios y pruebas de comportamiento | **Sol High** | **Terminado en este corte.** Componentes reales conectados y pruebas de comportamiento aprobadas. |
| Traslado fiel del CSS y QA responsive con contratos funcionales resueltos | Terra High | **Siguiente tramo. Detención para cambio de modelo.** Aplicar CSS aprobado y completar QA visual/responsive. |
| Consolidación mecánica del informe/checklist con evidencia ya obtenida | Luna, si sólo queda esa tarea | Avisar antes; no delegarle una incertidumbre de datos, concurrencia, media o UX por ahorro. |

Si durante Sol/Terra aparece un contrato insuficiente que exija cambiar el modelo de evidencia, permisos, ocupaciones/ciclos o transacciones, detener ese tramo y explicar el problema concreto antes de recomendar Astra Extra High. Un error localizado con contrato ya definido puede corresponder a Sol High. No elevar por rutina ni seguir a escondidas con un modelo distinto del acordado.

No hay ahora una dependencia nueva que requiera rediseñar el dominio. Las carencias de nombres y lista de seguimientos tienen una adaptación delimitada arriba. Los contratos funcionales ya están implementados. El siguiente trabajo corresponde a Terra High: extracción fiel del CSS aprobado y revisión visual/responsive.

## Evidencia del corte previo de preparación

Revisión del estado Git/worktrees, de la maqueta aprobada, de `CyclePage` y los componentes/interfaces citados. Se contrastaron los accesos con formularios reales, no sólo con los menús del prototipo. Se actualizaron el estado de Growth Film y el orden de integración.

Este corte cambia documentación únicamente. No se ejecutan ni se atribuyen nuevos tests/build de la aplicación a esta preparación; esas comprobaciones corresponden a los cortes de implementación. Sin migraciones, deploy, push ni cambios a datos de usuario.


## Corte funcional Sol High — 12 de septiembre de 2026

### Implementado

- `CyclePage` conserva carga, sincronización, revisión de conflictos y recuperación del original; ahora monta la estructura aprobada de `PlantStudio`, `PlantHistory` y una sola `PlantRecordSheet`.
- Las hojas reutilizan `CycleFactRecorder`, `CycleActions`, `ObservationComposer`, `AttentionTaskForm` y `AttentionTaskEditor`. Se conservan tipos, payloads, revisiones, fechas, restricciones y operaciones reales. «Registrar estado o acción» hace encontrables germinación, conteos e incidencias.
- `plant-presentation`, `plant-names` y `plant-intents` adaptan datos y accesos sin escribir. Portada elegida por ID, fotos disponibles únicas, precisión de siembra, ciclos cerrados y última observación mantienen su semántica.
- Enlaces contextuales y Registrar abren el formulario inmediatamente. Una propuesta AI no escribe; la foto/nota pendientes se conservan al abrir, guardar o cancelar una propuesta. Una selección anterior no recibe el resultado de otra foto.
- Guardados permanecen en Planta; reemplazo usa el ID devuelto. Un error de lectura posterior no repite una escritura exitosa. Peticiones tardías de un ciclo anterior no sustituyen ni navegan sobre el siguiente.
- Portadas de planta/jardín/Home mantienen el ID de foto y tienen callback opcional de actualización. El editor de seguimiento añade ocupación y protección de doble envío como props/comportamiento compatibles con Hoy.
- Historia ofrece diez registros, ampliación/contracción, originales, recuperación, datos/procedencia, revisiones e invalidación elegible. Los IDs de fotos históricas sin evento canónico no se envían como eventos.
- `qa/plant-integration` monta estos componentes con servicios simulados, medios sintéticos y escenarios de datos/errores. No importa Supabase, no usa cuenta, IndexedDB real ni `public/`; una importación de Supabase falla el build. El bundle sólo contiene URLs de bibliotecas y namespaces, no endpoints del servicio.

### Evidencia obtenida

| Comprobación | Resultado |
| --- | --- |
| Suite completa `npm test` | **31 archivos, 144 pruebas aprobadas**, incluidas **30 pruebas nuevas de Planta** y regresiones existentes de Maintenance/Film. |
| `npm run build` | **Aprobado**, TypeScript y build Vite/PWA. |
| TypeScript del entorno aislado | **Aprobado** con `npx tsc -p qa/plant-integration/tsconfig.json`. |
| ESLint de todos los archivos nuevos/modificados de código y QA | **Aprobado sin errores ni avisos**. |
| Build QA `npx vite build --config qa/plant-integration/vite.config.ts` | **Aprobado**; salida local en `artifacts/plant-integration/build`. |
| `git diff --check` | **Aprobado**. |
| Navegador / QA visual responsive | **Pendiente de Terra High.** No se atribuye evidencia visual al build ni a JSDOM. |
| Cuenta, RPC/Storage y dispositivo real | **Pendiente.** Las lecturas/escrituras de los tests están simuladas. |

Los tests nuevos cubren identidad/proyecciones, navegación sin mutación, formularios de germinación/conteo/intervención/incidencia/resolución, double submit y request ID de reintento, error de lectura tras éxito, enlaces de la misma ruta, seguimiento/evaluación filtrados por ciclo, traslado vacío/ocupado, reemplazo/reapertura/cosecha/cierre/corrección, foto/nota y AI conservadas, portada, historial/correcciones/invalidación, offline, recuperación del original y respuestas tardías. También comprueban que un borrador interrumpido en `syncing` se reintenta, mientras `needs_review` nunca se envía automáticamente.

### Pendientes y límites concretos

1. **Terra High:** crear/importar `plant-botanical.css` extraído de la referencia. La estructura está conectada, pero aún no tiene el acabado visual aprobado. Mantener ámbitos `.plant-page`/`.plant-sheet` y la variante del shell; no importar globalmente el CSS del prototipo.
2. Ejecutar la matriz visual indicada arriba en 320/390/820/1440 px, incluyendo hojas largas, errores, teclado/foco, accesibilidad y movimiento reducido. El entorno aislado está preparado; no se abrió un servidor ni se publicó preview en este corte.
3. Catálogo de nombres: únicamente la correspondencia aprobada Genovese Basil está confirmada. Los demás cultivos conservan `crop_name` y «Nombre botánico sin confirmar»; ampliar especies sólo con correspondencias verificadas, sin cambiar datos del servicio.
4. El contrato actual no tiene `evaluate_harvest_readiness` como propósito de seguimiento. «Guardar mi evaluación» usa el hecho `readiness_review`; «Planificar revisión» abre el seguimiento existente `evaluate_visual_review`. No se introdujo otro propósito ni RPC.
5. Fotos del entorno aislado y análisis son sintéticos. Su sincronizador simulado no conserva el contenido del archivo elegido; sirve para probar presentación/retornos. Originales reales, integridad, guardado remoto y permisos necesitan QA autenticada independiente.
6. Persisten los avisos previamente documentados: bundle principal mayor a 500 kB e import dinámico inefectivo de `photo-renditions`; JSDOM avisa de navegación a otro documento. Tests/build terminan correctamente. No se abrió una refactorización del empaquetado.
7. **Growth Film 02.2** mantiene pendiente la QA autenticada con fotos reales y el fullscreen nativo en Safari de un iPhone físico.

Sin migraciones, deploy, push ni escrituras sobre datos de usuario. Los archivos `VISUAL_DEPTH_STUDY`/`depth-study*` ajenos se preservaron. Se entrega un corte local de integración funcional, no un cierre visual ni una validación en producción.
