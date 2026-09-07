# STREEX GARDEN — PRODUCT CONTRACT v1

**Fecha:** 6 de septiembre de 2026. **Idioma del contrato y de la experiencia inicial:** español.

**Carácter:** contrato normativo de producto para el handoff de implementación. Consolida las decisiones aprobadas por el usuario y resuelve las ambigüedades operativas restantes. Sustituye la propuesta de arquitectura como referencia de comportamiento. Los agentes deben poder trabajar con este documento sin reconstruir conversaciones anteriores.

**Aprobación:** v1 aprobada y congelada con las tres enmiendas previas: interpretación de IA separada de revisión visual personal; umbral de visita configurable con valor inicial de 30 minutos; retención de chat configurable con valor inicial de 30 días. **Visual Concept 01 queda aprobado y congelado como dirección visual del MVP**, incorporando los siete ajustes del usuario en §§8, 10–14, 19 y 21. No se requiere una segunda exploración ni otra aprobación general de dirección visual. La [nota de diseño](</Users/juangaudino/Documents/Streex Garden/design/VISUAL_CONCEPT_01_ES.md>) documenta su aplicación; el mapa físico sigue provisional hasta confirmar orientación/numeración de ambos URUQ. La aprobación no inicia implementación.

**Límite de esta entrega:** documentación exclusivamente. Este contrato no inicia ni autoriza por sí solo implementación, migraciones, contratación de servicios o despliegue. No contiene diseños visuales.

“Debe” identifica un requisito verificable; “fuera de MVP” identifica una exclusión. Los valores técnicos por defecto aquí definidos rigen salvo una revisión explícita del contrato. Ningún agente ampliará alcance por conveniencia técnica. Un impedimento real se documenta con su evidencia y la modificación mínima necesaria; no permite reabrir la arquitectura completa.

## 1. Definición del producto

Streex Garden es una aplicación privada, visual e instalable para registrar, cuidar y consultar la historia de jardines hidropónicos personales. La base de datos es la fuente de verdad; la IA facilita interpretar evidencia y formular propuestas. No es un sistema autónomo de cultivo, una herramienta de diagnóstico automático ni una certificación de seguridad alimentaria.

**Principio obligatorio:** el registro del jardín sigue siendo plenamente útil cuando falla, se desactiva o se agota el presupuesto de IA. No debe existir dependencia de una respuesta del modelo para completar operaciones manuales. Falta de IA y falta de conexión son situaciones distintas: el alcance offline se limita en §18.

Nombre de trabajo: **Streex Garden**. URL provisional: **garden.getstreex.com**. No dedicar implementación a branding definitivo.

## 2. Alcance exacto del MVP

- Un propietario autenticado; sin registro público. Dos jardines URUQ iniciales, de 8 y 12 posiciones.
- Configuración de jardines y de sus disposiciones mediante datos; mapas finales cuando se confirme orientación y numeración. Lista numerada disponible desde el principio.
- Cultivos/variedades, ciclos que pueden contener varias plántulas y ocupaciones con historia.
- Registro manual de fotografías, observaciones, revisiones visuales, incidentes, cosechas, aclareo, poda, soporte, siembra adicional y mantenimiento del sistema.
- Alta, cierre, reemplazo y resiembra de ciclos; traslado a una posición vacía del mismo jardín, sin perder identidad ni historial.
- Fechas desconocidas o aproximadas, conteos opcionales, correcciones e invalidaciones con procedencia.
- Estado con evidencia fechada y preparación para cosecha, según §6 y §8.
- Una Attention Queue compartida por Jardines, Hoy y Mantenimiento. Tareas manuales, revisiones de desarrollo, propuestas y las dos recurrencias aprobadas.
- “Desde la última vez” calculado con el contrato de §10.
- Quick Check y AI Check opcional sobre la observación; Ask Garden con consultas autorizadas y referencias.
- Sesiones de mantenimiento para uno o ambos jardines, pausables y reanudables, sin fotografías obligatorias.
- Historial y comparación manual de dos fotos; Control V2 generado desde registros canónicos.
- Importación selectiva asistida con revisión e idempotencia.
- PWA responsive para iPhone, tablet y escritorio, recuperación de interrupciones y borradores offline acotados.
- Texto y dictado del teclado del dispositivo cuando esté disponible. No se requiere servicio propio de voz.
- Exportación manual de datos estructurados y fotografías; backups independientes y prueba de restauración.
- Autorización por propietario, archivos privados, observabilidad operativa y límites de IA.

Las acciones de limpieza, cambio de agua, agua añadida y nutrientes pertenecen al jardín/sistema. Se pueden registrar manualmente pH, EC/TDS y temperatura si el usuario dispone de mediciones; estos campos no son obligatorios ni habilitan automatización de dosificación.

## 3. No objetivos explícitos

Fuera del MVP: interfaz multiusuario, equipos/roles colaborativos, registro público, cobros SaaS, editor universal de equipos, identificación panorámica automática de pods, diagnóstico automático de enfermedades, base vectorial, modelo entrenado específicamente para plantas, sensores, analítica avanzada, rankings de variedades, timelapse automático y notificaciones push.

También quedan fuera: identidades por semilla, separación individual de cada plántula, división/fusión de ciclos, traslados entre jardines, intercambio simultáneo de dos posiciones ocupadas, grabación/transcripción integrada, inventario de nutrientes, dosificación automática, ajuste de dispositivos físicos y reconstrucción exhaustiva de conversaciones pasadas.

Se conservan relaciones y metadatos que permitan crecimiento futuro, sin implementar estas funciones. Una supuesta dependencia no autoriza incorporarlas: debe demostrarse y aprobarse como cambio de alcance.

## 4. Modelo de dominio canónico

| Objeto | Relaciones, propiedad y ciclo de vida |
|---|---|
| Propietario | Cuenta de Auth con preferencias de idioma y zona horaria. Todos los registros privados tienen un propietario verificable. |
| Jardín | Equipo físico y, en estos URUQ, su depósito compartido. Tiene nombre, modelo, capacidad, fecha de inicio independiente de sus cultivos y estado activo/archivado. |
| Posición | Identidad física permanente dentro de un jardín. Número único por jardín, orientación/coordenadas opcionales y estado habilitado/deshabilitado. No contiene directamente una identidad de planta sobrescribible. |
| Cultivo/variedad | Identidad biológica o comercial con nombres localizados y etiqueta original. Variedad y especie científica pueden quedar desconocidas. Las entradas personalizadas pertenecen al propietario. |
| Ciclo | Siembra/cohorte de un cultivo, con identidad estable, fecha inicial, conteos opcionales y cierre. Pertenece a un propietario y a un jardín en MVP. |
| Ocupación | Relaciona un ciclo y una posición durante un intervalo. Un traslado cierra una ocupación y abre otra; no crea otra planta. |
| Evento | Un hecho, acción u observación tipada con sujeto, fechas, versión y procedencia. Su revisión vigente es la referencia canónica. |
| Foto | Archivo original, derivados y metadatos. Puede tener vínculos explícitos con jardín, ciclos y eventos; no se duplica el archivo por sujeto. |
| Sesión de mantenimiento | Agrupa jardines, recorrido, revisiones y acciones. Tiene estado y progreso propios; no prueba que cada acción prevista se haya hecho. |
| Tarea | Trabajo ya aceptado, asociado a un jardín o ciclo, con propósito, criterio de ejecución y estado. |
| Regla de recurrencia | Define repeticiones para un sujeto y propósito. Máximo una regla activa para esa combinación. |
| Evaluación de IA | Resultado inmutable/versionado de una ejecución, con referencias a versiones de evidencia y límites de interpretación. |
| Propuesta | Cambio o tarea sugerida por IA, pendiente de decisión o ya resuelta. Al aceptarse referencia la operación creada; no es un hecho histórico por sí sola. |
| Lote/candidato de importación | Procedencia, datos extraídos, revisión, decisión y referencias a los registros finalmente creados. |
| Visita y checkpoint | Estado operativo por propietario para “Desde la última vez”; no es un evento de cultivo. |

Borradores, colas de sincronización, mensajes de Ask Garden y registros técnicos son objetos auxiliares; nunca sustituyen eventos. Los mensajes del chat no son hechos autorizados.

**Cardinalidades:** jardín → muchas posiciones; posición → muchas ocupaciones históricas y como máximo una actual; ciclo → muchas ocupaciones sucesivas y como máximo una actual; sesión → uno o varios jardines; evaluación → muchas referencias de evidencia y cero o más propuestas.

Un ciclo activo puede tener fecha inicial desconocida, pero debe tener una ocupación actual. Un ciclo histórico cerrado puede importarse con fechas de ocupación desconocidas, asociándolo explícitamente a su posición histórica sin inventar intervalos. No puede usarse ese intervalo desconocido para afirmar dónde estaba en una fecha concreta.

Los nombres visibles siguen **English name (nombre común latinoamericano)**. La etiqueta y traducción no son la clave biológica. El idioma inicial de botones, explicaciones y conversaciones es español. Una identificación desconocida no bloquea registrar evidencia.

## 5. Taxonomía canónica de eventos

Cada evento tiene: `event_id` estable, propietario, tipo, sujeto, fecha/intervalo de ocurrencia y precisión, zona horaria cuando corresponda, `recorded_at` del servidor, autor/origen, revisión y versión de formato. Origen: usuario, importación confirmada o confirmación de una propuesta de IA. Nota, fotos, sesión y tarea relacionada son opcionales.

Una fecha puede ser exacta como día, exacta como instante, aproximada, intervalo o desconocida. Una anotación retrospectiva conserva su fecha de registro. El origen IA confirma únicamente que el usuario revisó y guardó el contenido: no convierte la interpretación en medición científica.

| Tipo estable | Sujeto | Datos obligatorios además del sobre común | Datos opcionales / restricciones |
|---|---|---|---|
| `cycle_started` | Ciclo | Cultivo/etiqueta y motivo: siembra, resiembra o ciclo activo importado | Variedad, fecha inicial y conteo de semillas pueden ser desconocidos. Creado junto al ciclo. |
| `seeds_added` | Ciclo activo | Confirmación de que permanecen plantas del ciclo actual | Cantidad exacta, mínima o desconocida. Crea una fecha adicional; nunca reinicia silenciosamente la edad. |
| `germination_observed` | Ciclo | Observación explícita de germinación | Conteo y referencia a una siembra si se conoce; no presume germinación de todas las semillas. |
| `plant_count_observed` | Ciclo | Conteo entero no negativo y concepto: plántulas visibles o plantas conservadas | Cero no cierra el ciclo por sí solo. |
| `visual_review` | Ciclo | Resultado manual: tranquilizador, vigilar, requiere acción o evidencia insuficiente; confirmación explícita de que refleja lo observado personalmente por el usuario | Nota opcional salvo requiere acción, que necesita motivo breve o referencia a incidente. Aceptar una interpretación IA no satisface esta confirmación. |
| `development_review` | Ciclo | Acción evaluada: aclareo, poda, soporte u otra; resultado: listo, no todavía, no requerido o no determinado | “Otra” requiere descripción. La evaluación de cosecha usa `readiness_review` para evitar dos fuentes. No registra la intervención como realizada. |
| `observation` | Jardín o ciclo | Texto no vacío o al menos una foto vinculada | Seguimiento opcional y explícito. No implica problema. |
| `intervention` | Ciclo | Clase: aclareo, poda, soporte u otra | Cantidad retirada/conservada y notas. “Otra” requiere una descripción; no crea una categoría nueva de forma automática. |
| `harvest` | Ciclo | Confirmación de cosecha realizada | Cantidad ligera/media/abundante o valor y unidad; nunca obligatoria. |
| `incident_opened` | Jardín o ciclo | Descripción y atención manual: vigilar/requiere acción | Fotos, vínculo a observación previa. Es un reporte del usuario, no diagnóstico automático. |
| `incident_resolved` | Mismo sujeto | Referencia a incidente abierto y resultado: resuelto/no observado actualmente | Nota opcional. No invalida la evidencia pasada. |
| `system_maintenance` | Jardín | Clase: cambio completo de agua, relleno, nutrientes o limpieza | Agua: volumen; nutrientes: producto/dosis/unidad; limpieza: descripción. Los valores pueden desconocerse. |
| `measurement` | Jardín | Magnitud, valor y unidad admitida | pH sin unidad; EC con unidad explícita; TDS con unidad y factor opcional; temperatura con °C/°F. No convertir EC/TDS sin factor conocido. |
| `readiness_review` | Ciclo | Resultado manual: Todavía no / Evaluar / Lista / No aplica, según el vocabulario de §8 | Evidencia/foto/evaluación IA aceptada y nota opcionales. |
| `cycle_moved` | Ciclo | Ocupación anterior, nueva posición vacía y momento efectivo | Operación online atómica dentro del mismo jardín. |
| `cycle_ended` | Ciclo | Motivo: reemplazo, fin productivo, fallo, retirada u otro | “Otro” requiere nota breve. Cierra ocupación actual; fin con precisión desconocida solo en importación histórica. |

Una foto por sí sola puede guardarse como `observation` sin texto. Aclareo y poda son clases de intervención, no tablas de hechos duplicadas. “Reemplazar” es un comando compuesto de cierre y apertura, no un tercer hecho que reemplace esos dos.

Cambios de tarea, sesión, aceptación de propuesta, correcciones y eliminaciones pertenecen al historial operativo/auditoría. No simulan acciones de jardinería. Ampliar la taxonomía exige una versión de contrato; JSON libre no puede eludir requisitos de los tipos existentes.

## 6. Modelos de estado

### 6.1 Ciclo y ocupación

`active → closed`. Una reapertura exige corrección explícita online, revisión de eventos posteriores y disponibilidad de la posición. Si existe un sucesor ocupándola, la operación no se aplica parcialmente ni elimina el sucesor. Los ciclos creados por error se invalidan mediante §16; no se borran en cascada.

Etapa de desarrollo no es estado del ciclo. En MVP se muestran hitos registrados —siembra, germinación observada, primera cosecha registrada—; no se asigna automáticamente una etapa por edad.

### 6.2 Tareas y propuestas

Una tarea existe cuando el usuario la crea, una regla previamente activada la materializa o se acepta una propuesta. Tiene `origin` (usuario/regla/desarrollo/IA), aceptación confirmada con actor y fecha, `state` (`open`, `completed`, `dismissed`) y criterio independiente (§9).

Una sugerencia pendiente se almacena como **propuesta**, no como otra tarea pendiente duplicada. La cola unificada muestra aceptación `pending` para propuestas y `accepted` para tareas. Propuestas rechazadas quedan en historia, fuera de la cola. No se mantiene un segundo estado de aceptación mutable dentro de una tarea ya creada.

Propuesta: `pending → accepted | rejected | superseded | obsolete`. `accepted` referencia el evento/tarea/operación expresamente confirmada, cuando exista. La conformidad con una interpretación IA puede registrarse como respuesta a la evaluación sin crear ningún evento manual. Editar y aceptar conserva propuesta original y valores finalmente aprobados. Una propuesta aceptada no vuelve a pendiente al deshacer su efecto; conserva que fue aceptada y enlaza la reversión.

Tarea: `open → completed | dismissed`. Reabrir es una operación explícita auditada; no deshace hechos físicos. Una recurrencia crea una nueva ocurrencia, nunca reabre automáticamente la anterior.

Ejecución de IA: pendiente/en proceso/completada/fallida/cancelada. Si cambian versiones de evidencia, el resultado queda obsoleto para aplicación automática; sigue siendo consultable con esa advertencia.

### 6.3 Sesión de mantenimiento

`in_progress ↔ paused`; desde cualquiera de esos dos estados se permite `completed` o `abandoned`. Completar/abandonar requieren conexión. Una sesión terminal no se reabre; se inicia otra o se corrigen eventos concretos.

Cada posición incluida al iniciar tiene progreso `not_reviewed`, `reviewed` o `skipped`. `reviewed` exige revisión visual vigente vinculada a la sesión. Fotografía, observación o IA sin revisión manual no equivalen por sí solas a revisión completada. `skipped` no crea salud favorable.

### 6.4 Borrador y sincronización

`draft → queued → syncing → synced`. Fallo transitorio: `syncing → retryable_error → queued`; conflicto de dominio: `syncing → needs_review`. Descartar un borrador sin sincronizar lo elimina localmente; invalidar un hecho sincronizado es otra operación.

“Guardado en este dispositivo”, “Pendiente de subir”, “Sincronizando”, “Guardado en tu cuenta”, “Error: reintentar” y “Revisar conflicto” deben ser distinguibles. Nunca mostrar éxito remoto antes del acuse del servidor. Las fotos tienen estado de carga independiente del texto asociado.

### 6.5 Salud, revisión y frescura

Estados de presentación: **tranquilizador**, **vigilar**, **requiere acción**, **sin evaluar/evidencia insuficiente**. Deben mostrar autor y fecha de la evidencia. Una revisión “Se ve bien” es una observación del usuario; una respuesta IA se rotula como interpretación.

Determinación manual del estado de un ciclo:

1. Un incidente confirmado abierto de requiere acción prevalece. Después prevalecen los de vigilar.
2. En ausencia de esos incidentes, rige la última revisión visual válida. Una revisión de vigilar/requiere acción sigue abierta hasta una revisión explícita posterior o cierre del ciclo; también genera el seguimiento de §9.
3. Para una revisión tranquilizadora, si hay después una intervención, cosecha, incorporación de semillas, traslado o mantenimiento que afecte a ese ciclo, mostrar “Última revisión tranquilizadora; cambios posteriores sin evaluar”. La presentación actual pasa a sin evaluar, conservando el resultado anterior.
4. Sin revisión válida, sin evaluar. Una foto guardada o días transcurridos no generan salud favorable.

Una interpretación IA más reciente se presenta aparte como sugerencia fechada; no sobrescribe esta evaluación manual ni cierra incidentes. Aceptar una tarea de IA no cambia automáticamente salud.

Aceptar, guardar o expresar acuerdo con una interpretación de IA conserva su condición de evidencia IA. Solo se crea `visual_review` cuando el usuario declara explícitamente que el resultado coincide con lo que observa personalmente. La acción directa **Se ve bien** expresa esa observación personal; desde una evaluación IA se requiere una confirmación específica, no preseleccionada, como **“Esto coincide con lo que observo”**. Se conservan por separado evaluación IA, confirmación personal, recomendación y cualquier acción física confirmada.

Para decidir qué revisión es posterior se usa fecha de ocurrencia, no de importación. Con instantes iguales, la revisión explícitamente vinculada como sucesora prevalece; si no hay vínculo y sus resultados discrepan, mostrar evidencia contradictoria pendiente de revisión. Fechas desconocidas o intervalos que impiden ordenar revisiones no permiten sustituir una advertencia por tranquilidad: mostrar sin evaluar/orden incierto y conservar los incidentes y seguimientos abiertos.

Frescura muestra fecha y días transcurridos; no hay umbral biológico que vuelva amarillo o rojo un registro antiguo. Si existe revisión programada pendiente se muestra ese hecho por separado. Fechas aproximadas llevan “aprox.”; desconocidas, “fecha no registrada”.

El resumen de un jardín agrupa sus ciclos activos y sus incidentes propios: requiere acción si alguno tiene acción confirmada pendiente; si no, vigilar si corresponde; si no, sin evaluar cuando falte evidencia en alguno; solo tranquilizador cuando todos los ciclos activos tengan revisión tranquilizadora aplicable. Muestra conteos y fechas/rango, no una falsa fecha única. Un jardín vacío dice “Sin cultivos activos”. Tareas vencidas no convierten por sí solas la salud en roja.

## 7. Invariantes de integridad

1. Todo acceso y vínculo respeta propietario. Conocer un identificador no concede acceso.
2. Fecha de inicio de jardín nunca es valor por defecto de siembra de todos sus ciclos.
3. Como máximo una ocupación actual por posición y por ciclo. No se permiten intervalos conocidos incompatibles; los intervalos históricos desconocidos no prueban continuidad.
4. Reemplazo, traslado, cierre/reapertura y sus efectos relacionados son atómicos.
5. Una acción física futura no puede guardarse como completada. Una intención futura es tarea. Importes temporales contradictorios permanecen candidatos hasta revisión.
6. Fecha de captura, ocurrencia, registro y modificación no se confunden. Un valor aproximado no se transforma en exacto.
7. Cero, desconocido y mínimo conocido son distintos. Cantidad cualitativa no se convierte en peso ni volumen.
8. Ninguna recomendación, fecha prevista, cierre de sesión o tarea descartada prueba una acción física.
9. Una confirmación aprueba un contenido concreto y unas versiones concretas. La IA nunca escribe libremente tablas ni modifica silenciosamente hechos. Aceptar una interpretación no crea una revisión visual manual: esta exige confirmación explícita de observación personal, con autor y fecha.
10. Reintentar el mismo comando no duplica registros. Cada intención usa una clave de idempotencia estable; la misma clave con otro contenido se rechaza.
11. Correcciones preservan identidad, autor, contenido anterior y motivo. Lecturas corrientes usan solo revisiones vigentes no invalidadas.
12. Los efectos de correcciones sobre tareas, estados y datos derivados se recalculan; no se reescribe una evaluación IA antigua como si hubiera visto información nueva.
13. Cerrar ciclo descarta sus tareas abiertas con razón “ciclo cerrado” y vuelve obsoletas propuestas pendientes. No marca esas tareas como realizadas ni borra fotos.
14. “Se ve bien” y “Omitir” no son equivalentes. Una sesión no cambia retrospectivamente su lista de revisados porque apareció otro cultivo en la posición.
15. Ningún fallo de IA revierte un registro manual exitoso ni borra su borrador o foto.
16. La eliminación de un archivo no permite que una restauración lo vuelva a publicar (§23).

## 8. Valores derivados y Control V2

Las consultas aceptan un `as_of` y usan zona horaria del jardín, por defecto la del propietario. El cambio de preferencia no reinterpreta fechas locales históricas como otra fecha.

| Valor | Definición normativa |
|---|---|
| Edad desde siembra | Diferencia de días calendario locales entre fecha inicial y fecha de consulta; día de siembra = día 0. Si fecha es intervalo, devolver intervalo de edades; aproximada, marcar aproximación; desconocida, no calcular. |
| Siembra adicional | Mantener edad del inicio y mostrar “siembras mixtas” con fechas adicionales; no presentar esa edad como edad de cada plántula. |
| Último aclareo/poda/cosecha | Máxima fecha de ocurrencia conocida entre eventos vigentes del tipo. Si otro evento pertinente tiene fecha desconocida o intervalos solapados, decir “último con fecha conocida” o “orden incierto”, no inventar un orden. |
| Último mantenimiento | Última acción de sistema vigente, rotulada con su clase. Mostrar aparte último cambio completo de agua y última sesión terminada. |
| Próximo mantenimiento esperado | Resultado de regla activa según §9; sin regla/ancla disponible, “sin programar”. Nunca inferirlo de una sesión abandonada o prevista. |
| Edad de evidencia | Días desde ocurrencia/captura pertinente con precisión visible; no desde carga salvo etiqueta explícita “cargada el…”. |
| Conteos vigentes | Última observación válida comparable; no asumir supervivientes = semillas sembradas. |
| Germinación / primera cosecha | Primera **registrada** con fecha conocida; cobertura parcial/importación tardía visibles. |

**Harvest Readiness:** se guarda evidencia en eventos `readiness_review`, y la vista vigente se deriva. Valores: `not_yet`, `evaluate`, `ready`, `not_applicable`. Sin revisión manual válida, `evaluate` con motivo “sin evaluación registrada”. Una interpretación IA sin aceptar se muestra como sugerencia, separada del valor manual.

Vocabulario único para perfil, AI Check, tareas que referencien preparación, informes y cualquier otro lugar que muestre Harvest Readiness:

| Valor canónico | Inglés | Interfaz en español |
|---|---|---|
| `not_yet` | Not yet | Todavía no |
| `evaluate` | Evaluate | Evaluar |
| `ready` | Ready | Lista |
| `not_applicable` | Not applicable | No aplica |

La etiqueta española del concepto es **Preparación para cosecha**; se permite **Cosecha** en espacios compactos. “Lista” se refiere a la preparación para cosecha. No introducir sinónimos como nuevos estados ni usar salud, origen de tarea o “comestible” como preparación. Texto adicional puede explicar incertidumbre o antigüedad, pero no crea un quinto estado. Ningún estado certifica seguridad alimentaria.

Una cosecha, poda, aclareo, siembra adicional o incidente posterior a la revisión hace que la vista pida `evaluate`; se conserva la revisión previa fechada. Una revisión posterior restablece el estado elegido. El paso del tiempo solo cambia edad de evidencia, no convierte no todavía en lista. Cerrar ciclo elimina preparación actual y conserva su historia. “No aplica” debe ser una decisión explícita, no una deducción del nombre común.

**Control V2** se genera para una fecha de consulta usando posiciones, ciclos activos y revisiones vigentes. Columnas: Pod, Plant, Planted, Age, Last Thinning, Next Thinning/Evaluation, Harvest Readiness, Status, Action. En posiciones vacías muestra vacío; nunca el cultivo anterior como actual. “Próximo aclareo” es la tarea aceptada pertinente o “evaluar/sin programar/no requerido” si hay una revisión explícita que lo justifique. Una sugerencia IA se etiqueta como sugerida.

La acción principal se elige desde la misma cola de §9. El semáforo agrupa verde tranquilizador, amarillo vigilar/pendiente y rojo acción requerida confirmada. Se omiten grupos vacíos; sin evaluar se muestra como bloque neutro. Un pendiente de calendario o de aceptación no se convierte en problema rojo. Generar el informe y su resumen básico no consume IA. Incluye hora de consulta y permite exportación CSV; la interfaz puede ofrecer impresión del mismo contenido.

## 9. Contrato de Attention Queue y recurrencias

### 9.1 Única fuente de pendientes

La cola es una proyección de tareas abiertas aceptadas y propuestas accionables pendientes. Jardines, Hoy y Mantenimiento filtran esa misma proyección. No mantienen listas editables independientes.

Entran por: creación manual; regla activada; seguimiento explícito de una observación; revisión visual de vigilar/requiere acción; incidente abierto; propuesta de IA de crear tarea. Una observación corriente, una foto, evidencia vieja o una evaluación “normal” no entran automáticamente.

Las revisiones e incidentes que exigen seguimiento crean tarea en la misma confirmación manual, con la acción visible en el guardado. Su propósito predeterminado es revisar, salvo que el usuario elija una intervención. Sin fecha, sigue siendo atención aceptada sin plazo; no se inventa vencimiento.

### 9.2 Identidad, deduplicación y orden

Clave canónica de seguimiento: propietario + sujeto (jardín/ciclo) + propósito tipado + asunto. El propósito combina modo (realizar/evaluar) y objetivo (revisión visual, aclareo, poda, cosecha, soporte, cambio completo de agua, relleno, nutrientes, limpieza u otro). Evaluar aclareo y realizar aclareo son distintos; cambio completo y relleno también. Asunto general por defecto; un incidente usa su identificador; un seguimiento distinto necesita creación explícita de otro asunto. El texto libre de IA no es clave de identidad.

Máximo una tarea abierta por clave. Si una propuesta coincide con tarea abierta, se adjunta a ella como sugerencia pendiente de cambio; no crea otra fila ni altera silenciosamente fecha/prioridad. Propuestas pendientes equivalentes se agrupan por clave, conservando evaluaciones y referencias originales. Una nueva versión con evidencia diferente puede sustituir una propuesta pendiente, dejando la anterior como `superseded`.

La UI permite “seguimiento distinto” si el usuario realmente quiere dos asuntos. Una propuesta rechazada no reaparece con la misma evaluación y clave; nueva evidencia o solicitud explícita del usuario puede producir una nueva propuesta. Reanalizar sin cambios no debe regenerar pendientes descartados.

Orden estable: acción requerida confirmada; tareas aceptadas vencidas; para ahora; aceptadas sin fecha que necesitan revisión; próximas; propuestas por revisar. Dentro del grupo: fecha si existe, creación e identificador. Se muestran grupos sin confundir urgencia de salud con calendario.

### 9.3 Criterios temporales y desarrollo

Tipos: fecha concreta; ventana inclusiva inicio/fin; condición de desarrollo descrita; sin fecha. La condición puede tener fecha opcional para **evaluarla**, nunca para darla por cumplida.

Con fechas locales: antes del inicio = próxima; dentro de ventana o en la fecha = para ahora; después del fin = vencida. Sin fecha no existe atraso. Posponer guarda `next_review_on` y su historial: cambia cuándo vuelve a destacarse, pero mantiene fecha comprometida original y permite verla en Todas.

Completar una tarea de acción exige seleccionar/crear el evento correspondiente, o enlazar uno ya registrado. Completar “evaluar aclareo” guarda `development_review` con su resultado y no registra aclareo. “No hace falta” descarta una tarea de intervención con motivo; no inventa una acción. Registrar una acción fuera de la tarea ofrece cerrar la coincidencia; no completa todas las tareas parecidas automáticamente.

Una nueva revisión manual del mismo asunto puede completar el seguimiento de revisión que la solicitó, mostrando ese efecto al guardar. Si el resultado sigue siendo vigilar/requiere acción, mantener una próxima revisión abierta o crear la siguiente en la misma transacción, conservando el resultado de la anterior; sin plazo indicado, permanece sin fecha. “Se ve bien” resuelve el seguimiento general de revisión visual aplicable, pero no cierra incidentes ni tareas de intervención independientes. Si no puede establecerse que la revisión es posterior a la que originó el seguimiento, requiere revisión del orden antes de resolverlo.

Cerrar un incidente genera `incident_resolved` y resuelve su tarea de revisión vinculada en la misma confirmación. Completar una intervención vinculada no declara el incidente resuelto si no se confirmó ese resultado.

### 9.4 Recurrencia

**Intervalo desde acción real:** siguiente fecha = última acción pertinente confirmada con fecha exacta + N días calendario. Requiere N positivo y al menos una acción con fecha conocida para activarse. Si se registra tarde con fecha retrospectiva, se usa cuándo ocurrió, no cuándo se cargó. Una sesión o un relleno no reinician la regla de cambio completo de agua. Sin acción conocida, el usuario debe programar una primera tarea concreta.

**Martes alternos anclados:** fechas = martes de ancla + 14 × k días. El ancla debe ser martes en zona local y queda inactiva hasta ser seleccionada. Cambiar agua tarde no mueve el ancla. Cambiar el ancla crea versión de regla, conserva ocurrencias históricas y reprograma solo lo pendiente con vista previa.

Una regla materializa como máximo una ocurrencia abierta por clave; fechas futuras adicionales son previsiones. Para martes anclados, si hay varios períodos incumplidos, conserva la ocurrencia pendiente más antigua y muestra cuántos puntos del calendario pasaron, sin crear una avalancha de tareas. Al completarla/descartarla, materializa el siguiente punto del ancla estrictamente posterior a la mayor entre fecha local actual y fecha de ocurrencia resuelta; conserva auditoría de períodos omitidos sin marcarlos hechos.

Para intervalo desde acción real, la siguiente fecha siempre se recalcula desde el último evento pertinente vigente, incluso si la fecha calculada ya está vencida: no se desplaza artificialmente al futuro. Descartar su pendiente pausa la regla; para continuar se puede registrar una nueva acción real o programar una tarea inicial concreta y reactivar la regla cuando esa acción ocurra. Nunca reiniciar el intervalo desde la fecha de descarte. Corregir/invalidar la acción base recalcula la fecha; si ya no hay acción fechada válida, pausa la regla y muestra “falta acción base con fecha”.

Para coordinación conjunta existen reglas y ocurrencias por jardín con el mismo ancla y un grupo de presentación compartido. Marcar agua cambiada en un jardín no completa el otro. Guardar una acción en ambos crea dos eventos y resuelve únicamente las tareas confirmadas en esa operación.

## 10. Contrato de “Desde la última vez”

**Definición:** una visita es una sesión lógica del propietario al consultar Jardines. Se comparte entre sus pestañas/dispositivos. Es nueva si no existe visita o se cumple el intervalo configurable desde el último acceso confirmado a Jardines. El parámetro de producto `since_last_time_visit_gap_minutes` tiene **30 minutos como valor inicial**, no como invariante del dominio. Su valor debe ser positivo y resolverse desde configuración; no debe quedar codificado como constante biológica o disperso entre clientes. Navegar por otras vistas o un proceso en segundo plano no confirma una visita a Jardines.

Cada visita conserva el valor/versión de configuración con que se abrió. Cambios del parámetro se aplican a visitas posteriores, sin reinterpretar checkpoints ni vaciar el resumen de una visita activa. No se exige un control de usuario adicional en el MVP para que el valor sea configurable por producto.

La base de datos mantiene un cursor monotónico de cambios **confirmados** por propietario y un checkpoint compuesto por cursor y hora de la última instantánea mostrada. No basta con un ID reservado antes del commit o con la hora del dispositivo. El servidor debe garantizar orden de commit/snapshot coherente para no perder cambios concurrentes.

Al abrir una visita nueva se fija una base inmutable B desde el último checkpoint mostrado con éxito. Jardines obtiene una instantánea H y presenta cambios en (B.cursor, H.cursor], junto a transiciones temporales entre B.hora y H.hora. Tras renderizar el resumen correctamente, el cliente acusa recepción de H y el servidor avanza el checkpoint de forma monotónica. Un fallo de carga/render o una consulta en segundo plano no avanza nada.

Durante esa visita, recargas y otros dispositivos reutilizan B: no vacían el resumen que el usuario está leyendo. Nuevas instantáneas amplían H y su acuse actualiza el checkpoint para la próxima visita. Solicitudes concurrentes crean/reutilizan la misma visita mediante control transaccional. Un acuse tardío de una visita anterior no sustituye el estado de la actual.

**Separación en Home:** **Desde la última vez** responde “qué ocurrió desde mi última visita”; **Atención** responde “qué requiere atención ahora”. Son bloques con encabezados y contenidos diferenciados, nunca una única lista indiferenciada. Comparten referencias canónicas, no estados editables duplicados.

Desde la última vez incluye acciones/eventos nuevos, cosechas, correcciones significativas, importaciones rotuladas “añadido al historial”, propuestas/evaluaciones nuevas y transiciones de tareas a para ahora/vencida que ocurrieron en el intervalo. Una tarea que sigue pendiente desde antes de B no cuenta como novedad: pertenece a Atención. La previsión “próximos 7 días” también pertenece a Atención y usa el calendario actual, no representa algo que ya ocurrió.

Una transición reciente puede resumirse como novedad y enlazar la misma tarea que aparece en Atención; no crea dos pendientes ni duplica su conteo. Acusar lectura de novedades nunca completa, acepta o descarta tareas. Es válido mostrar “No hay cambios registrados” junto a Atención con asuntos abiertos; cada bloque tiene su estado vacío independiente.

Primera visita: estado actual y “Tu primera vista”; no afirmar que hubo una visita anterior. Sin cambios: “No hay cambios registrados desde tu última visita”. Tiempo transcurrido jamás produce crecimiento, mejora o empeoramiento ficticio.

Offline: mostrar la última instantánea cacheada con fecha y borradores locales diferenciados; no avanzar checkpoint remoto. Al reconectar se recupera el intervalo real. El cursor de cambios no se modifica por renderizar esta sección ni por sus propios acuses, evitando bucles de novedades.

## 11. Contrato de AI Check

**Entrada:** identificadores autorizados de jardín/ciclo/observación; foto actual utilizable; comentario opcional; identidad y fechas con precisión; revisiones vigentes; acciones pertinentes; incidentes abiertos; contexto del depósito; como máximo dos fotos históricas elegidas inicialmente por fecha, sujeto y pertinencia. No enviar toda la biblioteca. Se permite ampliación puntual por solicitud explícita y presupuesto.

La imagen actual no se procesa hasta que su original y derivado de análisis estén disponibles. “Guardar y analizar” primero confirma/guarda la observación y luego solicita IA. Si falla la segunda operación, el registro permanece. “Guardar” nunca obliga a analizar. Análisis sin foto queda en Ask Garden, sin presentarse como inspección visual.

**Respuesta estructurada obligatoria:** versión de formato; sujeto y versiones de evidencia; hallazgos visibles; interpretación; limitaciones; resultado (`normal`, `insufficient_evidence`, `another_photo`, `reassess`, `suggested_intervention`); propuestas opcionales; referencias; modelo/esfuerzo/versión de instrucciones y momento del análisis. La descripción visible debe separar qué se observa de qué se infiere.

Las propuestas permitidas son: crear/actualizar tarea, ofrecer una revisión visual para que el usuario confirme su propia observación, o sugerir una corrección para el editor. Aceptar la interpretación de IA solo registra conformidad con esa evaluación y conserva su origen IA. Para crear `visual_review`, el usuario debe activar expresamente **“Esto coincide con lo que observo”** y guardar su revisión; esa confirmación nunca viene seleccionada por defecto ni se deduce de aceptar una recomendación. Una recomendación de instalar soporte no crea un evento de soporte instalado. Para registrar una acción pasada extraída del comentario, la confirmación dice qué acción y fecha se registrarán, y permite corregirlas.

**CTA de confirmación personal:** **Guardar mi observación visual** sustituye a “Guardar revisión manual”. Antes del botón se muestran el resultado que se registrará, cultivo/ciclo, jardín, pod/posición y fecha. Solo se habilita tras la declaración personal explícita anterior. Guarda esa revisión visual del usuario; no registra una intervención física, no convierte la evaluación IA en evidencia manual ni acepta otras propuestas en bloque. **Crear tarea de revisión** sigue siendo un CTA distinto para una intención futura. Cada CTA identifica su efecto; no usar un “Aceptar” o “Guardar” genérico para efectos diferentes.

No ofrecer porcentajes de confianza no calibrados. Explicar limitaciones concretas y abstenerse si falta evidencia. No diagnosticar automáticamente enfermedades, garantizar seguridad de consumo, fabricar crecimiento medido ni deducir pH/nutrientes de colores.

**Permisos:** el modelo no ejecuta comandos de escritura. El servidor crea evaluaciones/propuestas separadas del historial confirmado. Una aceptación requiere usuario autenticado, contenido concreto revisado, `proposal_id`, revisiones esperadas e idempotencia. El servidor revalida sujeto activo, fechas, permisos y vigencia de evidencia; si cambió el contexto, bloquea la aplicación y explica el cambio. No se exige otra llamada de IA para poder registrar manualmente la decisión.

Si una propuesta duplica una tarea, se fusiona conforme a §9 y se muestra qué cambiará. Rechazarla conserva foto/observación y registra la decisión. Una nueva llamada no modifica la evaluación anterior.

**Modelos runtime:** Terra durante el piloto visual; Luna para extracción acotada cuando pase evaluación; Sol solo para casos complejos con evidencia suficiente y mejora demostrable. Astra no es modelo rutinario de la app. Imagen insuficiente provoca abstención o nueva captura, no escalada automática.

**Fallos y gasto:** solicitudes idempotentes, máximo una ejecución activa por intención. No repetir automáticamente una llamada de resultado incierto que pudo facturarse; recuperar resultado si el proveedor lo permite o ofrecer reintento informado. Límite inicial de espera interactiva: 60 segundos; si no hay resultado, conservar registro y presentar estado recuperable. No prometer cancelación de un cargo ya iniciado.

**Piloto de aceptación:** conjunto versionado de al menos 30 casos, con mínimo 20 basados en los jardines reales y 10 casos de límite que pueden usar combinaciones preparadas de registros/imágenes. Debe incluir fechas corregidas, información ausente, foto insuficiente, planta sin problema aparente, comparación, cohortes y conflicto de identidad. Usuario/revisor valida la rúbrica; en ese conjunto: cero escrituras sin confirmación, cero fechas históricas inventadas, abstención en todos los casos marcados como evidencia insuficiente y al menos 90% de evaluaciones útiles sin corrección sustancial según rúbrica. Si falla, el núcleo manual sigue funcionando pero la liberación del MVP completo queda pendiente de corrección del módulo IA. Estos umbrales son criterios del piloto, no certificación botánica general.

## 12. Contrato de Ask Garden

La entrada puede ser libre o una pregunta rápida desde un jardín/ciclo. El contexto seleccionado es visible y se valida en cada consulta. Ante “esa planta” ambiguo, pedir identificación; no elegir una planta por intuición.

Herramientas de lectura permitidas: resolver sujeto autorizado; consultar ciclo; filtrar eventos por tipo/fecha; consultar tareas/recurrencias; obtener fotografías autorizadas; calcular resúmenes y métricas simples; obtener evidencia de una evaluación. Parámetros y límites se validan en servidor. No hay SQL libre, acceso por `service_role` expuesto al modelo ni consulta transversal de propietarios.

Preguntas rápidas como “último aclareo” o “último cambio de agua” consultan base y plantilla sin LLM. En lenguaje libre, Luna puede identificar la intención y redactar; la fecha, cálculo u orden proceden del resultado determinista. Si la IA está caída, esas consultas rápidas, el historial y Hoy siguen disponibles. El chat libre muestra su indisponibilidad sin bloquear el resto.

Respuestas factuales referencian eventos/revisiones existentes y su fecha. “No consta” se usa cuando no hay registro; “último con fecha conocida” cuando corresponde. Para juicio, separar explícitamente hechos registrados, evidencia visual, inferencia y conocimiento general. Este último no se presenta como observación del jardín.

Las referencias son IDs resueltos por la aplicación, no URLs inventadas por el modelo. No debe presentarse una afirmación histórica como confirmada sin evidencia recuperada. Validar la existencia y acceso de cada referencia, y usar resultados/plantillas para fechas y cantidades. Si se eliminó una foto o corrigió un evento, no reutilizarlo como evidencia vigente.

**Referencias interactivas:** cada referencia a un hecho/evento abre directamente su registro fuente, con fecha, procedencia y versión citada; cada referencia fotográfica abre la fotografía correspondiente en su visor de evidencia, con acceso al original autorizado. No basta una etiqueta decorativa, un tooltip o un enlace a la portada del jardín. Si una versión fue corregida, se muestra la versión citada como histórica y se ofrece la vigente; no se sustituye silenciosamente la evidencia que sostuvo la respuesta. Una foto eliminada o un recurso sin permiso muestra indisponibilidad, sin reconstruirlo ni saltar autorización. Volver a la conversación conserva contexto y posición de lectura.

El MVP no incluye búsqueda web automática. Puede incorporar un pequeño conjunto revisado de manuales o referencias aportadas/documentadas durante implementación, con versión y fuente. Sin referencia, una afirmación general se etiqueta como orientación no verificada y debe evitar precisión no sustentada, particularmente en dosificación o intervenciones irreversibles.

El chat guarda contexto de conversación privado para continuidad. El parámetro de producto `ask_garden_chat_retention_days` tiene **30 días como valor inicial configurable**, no como invariante permanente del dominio. Se resuelve desde configuración versionada; cada mensaje conserva la política de expiración aplicable cuando se creó. Cambios se aplican a mensajes nuevos; aplicar una reducción a mensajes existentes exige una operación de retención explícita y no restaura mensajes ya eliminados. No se exige un nuevo control de usuario en MVP.

Los eventos/evaluaciones conservan su propia vida histórica independientemente de la retención de chat. Borrar chat no borra hechos, y borrar un hecho no autoriza recuperarlo como hecho vigente desde el chat. Cambiar la retención del chat no modifica por implicación la retención de logs o backups.

Proponer una escritura abre exactamente el mismo editor/confirmación que una Quick Action. “Revisa mañana” no crea tarea hasta aceptación. Una pregunta no es consentimiento para modificar. No se requiere vector database.

## 13. Contrato de fotografías

**Original:** conservar el archivo recibido exactamente, con checksum, formato y tamaño. Es la evidencia fuente inmutable; no sobrescribirlo con compresión, recorte, retoque ni conversión. Esta decisión concreta el requisito aprobado de preservar originales y reemplaza la propuesta anterior de usar solo un maestro reducido.

Originales en bucket privado. Los metadatos originales del archivo pueden contener EXIF; la aplicación no extrae GPS ni lo utiliza. Derivados visibles y enviados a IA eliminan EXIF sensible. El propietario puede descargar el original; ninguna galería es pública. El gateway nunca envía el original con metadatos personales al modelo por defecto.

**Derivados iniciales:** miniatura de hasta 480 px de lado mayor, visualización de hasta 2.000 px y derivado de análisis con resolución adecuada al modelo y detalle observado. JPEG/WebP de alta calidad, orientación normalizada, sin ampliar imágenes pequeñas. Si un detalle requiere más resolución, usar recorte documentado del original, con referencia a su región, sin sustituir la evidencia fuente. Los tamaños se pueden ajustar por prueba de calidad sin alterar estas invariantes.

Aceptar JPEG, PNG, WebP y HEIC/HEIF que produzca el iPhone de prueba. Límite inicial: 30 MB y 60 megapíxeles por original. Validar bytes y dimensiones reales en servidor; un archivo no admitido conserva borrador y explica la causa. HEIC debe convertirse para visualización/análisis sin perder el original; esa ruta se prueba antes de fijar infraestructura de imágenes.

**Metadatos:** propietario, ID, checksum, ruta original y derivados, formato, dimensiones, carga, captura y precisión/fuente de captura, orientación, vínculos a sujetos/eventos y estado de disponibilidad. La fecha propuesta desde EXIF puede corregirse; fecha de carga no sustituye silenciosamente la de captura.

Cada vínculo a ciclo es explícito. Una foto panorámica puede pertenecer solo al jardín o a varios ciclos elegidos manualmente. Un traslado o reemplazo posterior no reasigna fotos antiguas. Una foto cargada hoy pero tomada antes de la resiembra exige seleccionar el ciclo correcto; no basta con usar el ocupante actual.

Se puede guardar primero la observación con un adjunto pendiente identificado. Esa observación muestra “foto pendiente”; no se ofrece como evidencia visual al modelo hasta completar carga y validar el archivo. La pantalla no afirma que la foto está guardada remotamente por el solo hecho de haber sincronizado el texto.

Comparación: exactamente dos fotos seleccionadas, fechas y sujetos visibles, zoom/encuadre de presentación y aviso si pertenecen a ciclos distintos. Por defecto comparar dentro del mismo ciclo. No generar porcentaje de crecimiento ni interpolar fotos ausentes. Mantener metadatos para timelapse futuro; no crearlo.

Las fechas forman parte de la evidencia, no de la decoración: cada miniatura en historia y cada imagen comparada mantiene fecha de captura y precisión claramente asociadas. En comparación las dos etiquetas permanecen visibles al cambiar tamaño de pantalla o hacer zoom; no dependen de hover ni quedan tapadas por controles. Incluir el año cuando haga falta para distinguir fechas. Fecha aproximada se marca como tal; desconocida dice “Fecha de captura desconocida”. La carga puede mostrarse aparte como “Cargada el…”, nunca reemplazar sin etiqueta a la captura.

Eliminar exige confirmación del archivo concreto. Se oculta inmediatamente, se revocan accesos nuevos y se elimina original/derivados activos en un máximo de 24 horas; enlaces ya emitidos duran como máximo 5 minutos. Las evaluaciones vinculadas quedan rotuladas “evidencia eliminada” y sus propuestas pendientes obsoletas. Referencias mínimas de auditoría conservan que hubo una eliminación, no una copia oculta del archivo. Backups expiran en 30 días y aplican las reglas de §23. Copias ya descargadas al dispositivo no pueden revocarse remotamente.

## 14. Contrato de mantenimiento

Inicio online: seleccionar uno/ambos jardines, capturar la lista de posiciones y ciclos actuales, crear sesión `in_progress` y cachearla para recuperación. La sesión no programa por sí sola cambio de agua ni prueba su ejecución.

Puede registrarse primero sistema o plantas. Cada acción confirmada se guarda inmediatamente y se vincula a la sesión. Una operación conjunta muestra jardines y valores, permite editar diferencias y crea un evento por jardín. No copiar una dosis a ambos sin que ambos destinos y cantidades estén visibles en la confirmación.

En el recorrido, **Se ve bien** crea `visual_review` tranquilizador, marca revisado y avanza con un toque. **Omitir** guarda solo progreso omitido. Foto/nota puede guardarse y luego elegir resultado manual de revisión. Una evaluación de IA queda opcional; no decide sola el progreso revisado.

**Contexto siempre visible:** mantener un encabezado persistente **nombre del jardín + Pod/Posición N** durante todo el recorrido, incluido scroll, editores de nota/acción, revisión de captura y reanudación. El contexto no se expresa solo por foto, color, nombre de planta o “5 de 20”. Al pasar de jardín/posición, encabezado, sujeto de captura y destino de las acciones cambian juntos antes de habilitar guardar. En el selector/cámara nativos del sistema, que la PWA no controla, se conserva el destino y se vuelve a mostrar en la revisión de la captura antes de confirmar. La orientación del mapa no confirmada no impide identificar el registro por jardín y número.

Si el ciclo cambió desde el inicio, la pantalla muestra “ocupante cambiado”, conserva el progreso del ciclo anterior y requiere revisar el nuevo explícitamente. No aplica “Se ve bien” ni una foto al sucesor silenciosamente. Posiciones vacías son omitibles sin revisión saludable.

Pausa conserva cursor y todo lo confirmado. Abandono conserva acciones y marca la sesión incompleta. Finalizar exige que no queden comandos locales pendientes/conflictivos de esa sesión. No exige revisar todas las posiciones: muestra conteos y permite cerrar con omisiones explícitas; lo no revisado sigue sin evaluar.

Resumen determinista: jardines incluidos, posiciones revisadas/omitidas/no revisadas, acciones realmente registradas, fotos disponibles/pendientes si solo se consulta una sesión abierta, incidentes y cola de pendientes relacionada. No enumera tareas planeadas como realizadas. Una sesión terminada guarda fecha de cierre y referencias; correcciones posteriores actualizan su vista vigente con indicación “corregido después del cierre”, manteniendo auditoría de lo original.

Reanudar una sesión cacheada offline permite seguir generando borradores para sus sujetos conocidos. Pausar localmente y cerrar la app no borra esos borradores. Iniciar una nueva sesión formal, finalizarla o resolver cambios de ocupante requieren conexión; se puede seguir capturando observaciones simples sin sesión nueva.

## 15. Contrato de Quick Actions

Desde perfil, sujeto preseleccionado y fecha local de hoy visibles. Desde Registrar global, exigir jardín/ciclo antes de confirmar o guardar como borrador sin asignar. Fecha, nota y campos opcionales se revelan progresivamente.

| Acción | Mínimo para confirmar | Efecto |
|---|---|---|
| Foto | Sujeto y archivo | Observación con foto; análisis opcional. |
| Observación | Sujeto y texto o foto | Evento; seguimiento solo si se elige. |
| Cosechar | Ciclo y confirmación “Guardar cosecha” | Cosecha sin cantidad obligatoria. |
| Aclarar / Podar / Soporte | Ciclo y acción elegida | Intervención; conteos opcionales. |
| Se ve bien | Ciclo vigente | Revisión visual manual. |
| Incidente | Sujeto, motivo y vigilar/requiere acción | Incidente y seguimiento visible confirmado. |
| Cambio de agua / Relleno / Limpieza | Jardín y acción elegida | Mantenimiento; volumen/nota opcionales. |
| Nutrientes | Jardín y confirmación de adición | Mantenimiento; producto/dosis opcionales o desconocidos. |
| Medición | Jardín, magnitud, valor y unidad pertinente | Medición manual, sin generar dosificación. |
| Preparación para cosecha | Ciclo y estado elegido | Revisión de preparación, con fecha y fuente. |
| Evaluar desarrollo | Ciclo, acción a evaluar y resultado | `development_review`; no registra intervención realizada. |
| Cerrar ciclo | Ciclo y motivo | Cierre y ocupación finalizada. |
| Reemplazar / Resembrar | Ciclo anterior, motivo, nuevo cultivo/etiqueta y fecha nueva o desconocida | Cierre/apertura atómicos, historial intacto. |
| Añadir semillas | Ciclo activo y confirmación de convivencia con plantas existentes | Siembra adicional, edad mixta. |
| Mover | Ciclo y posición vacía del mismo jardín | Nueva ocupación; identidad intacta. |

“Reemplazar” debe distinguir si se retiró el cultivo anterior o se añadieron semillas junto a plantas vivas. No pedir semilla por semilla. Al resembrar se puede reutilizar cultivo/variedad anterior como opción visible, nunca la fecha de siembra anterior.

Desde perfil, cosecha estándar = tocar Cosechar y Guardar, dos toques. Soporte/aclareo/poda usan el mismo patrón. Deshacer se ofrece tras guardado sin imponer confirmación adicional a cada acción simple. Las operaciones estructurales siempre tienen resumen antes/después y conexión.

## 16. Corrección histórica, invalidación y Deshacer

Solo online para hechos sincronizados. El editor carga revisión vigente y envía revisión esperada. Si otro cambio la sustituyó, no se aplica “último escritor gana”: mostrar comparación y permitir editar sobre la versión nueva.

Una corrección añade revisión con contenido anterior, contenido nuevo, autor, registro temporal, motivo y vínculo estable al hecho. Corrige fecha/identidad/conteo sin crear otra intervención como si hubiera ocurrido dos veces. La vista actual y sus derivados cambian en la misma transacción; la historia de revisión permanece accesible.

Invalidar significa “este registro no debe contar como hecho válido”, con motivo. No borra en cascada ciclo, fotos u otros eventos. Una foto adjunta puede seguir como evidencia independiente o eliminarse explícitamente conforme a §13.

Deshacer un registro reciente invalida esa intención confirmada; no afirma que se deshizo físicamente una poda o cosecha. Deshacer una corrección crea una nueva revisión que restaura valores anteriores. Una operación agrupada puede revertirse de forma atómica solo si no rompe dependencias posteriores; en caso contrario, mostrar qué requiere revisión, sin borrar hechos posteriores.

Si se invalida el único evento que soporta tarea completada, la tarea vuelve a abierta con marca “hecho de cierre invalidado”, salvo que otro evento válido la soporte o que su ciclo esté cerrado; en ese caso queda descartada por ciclo cerrado con auditoría. Invalidar una revisión que originó seguimiento elimina solo ese fundamento: si no quedan fundamentos y la tarea está abierta, se descarta con motivo; nunca se elimina una tarea manual independiente.

Revisiones de siembra, ocupación o cierre validan la línea temporal entera afectada. Fechas definitivamente imposibles se rechazan con explicación; fechas desconocidas no se rellenan para superar la validación. Referencias de evaluaciones IA antiguas conservan la versión que realmente se usó y pasan a “contexto corregido” cuando corresponde.

## 17. Contrato de importación selectiva

Orden: configuración confirmada → ciclos activos → fechas de siembra/resiembra → intervenciones importantes → mantenimiento confirmado → fotos y eventos útiles. No se requiere copiar todas las conversaciones. La app puede entrar en uso con datos desconocidos explícitos.

Cada candidato conserva lote, fuente/fragmento o archivo elegido, localizador estable, campos extraídos, precisión y posibles contradicciones. Estados: pendiente, necesita revisión, aceptado, rechazado. Extracción por IA puede crear candidatos; solo la confirmación los convierte en registros. Revisión agrupada permitida con cada jardín, sujeto, fecha y hecho visibles.

Idempotencia por propietario + origen estable + candidato; hash del contenido detecta repeticiones dentro de una fuente. Una fuente modificada genera nueva versión candidata, no sobrescritura. Coincidencias entre fuentes distintas se presentan como posibles duplicados; sin identidad suficiente no se fusionan automáticamente. Repetir un lote aceptado devuelve referencias existentes.

Una recomendación antigua como “cambia el agua el martes” solo puede importarse como intención revisable, nunca mantenimiento realizado. Conflictos sobre identidad/fecha deben resolverse o dejarse desconocidos; se permite aceptar otros candidatos independientes.

### Configuración inicial contenida en este handoff

**Garden 1:** URUQ, 8 posiciones, inicio del jardín 2026-07-31. Dato señalado por el usuario: posición 7, Chives (cebollín), resembrado 2026-08-28. Se incorpora a la revisión inicial con esa procedencia; no se deduce qué había antes ni la fecha de otros pods. Las otras posiciones carecen aquí de configuración confirmada suficiente.

**Garden 2:** URUQ, 12 posiciones, inicio del jardín 2026-08-24. Candidatos de ocupación suministrados:

| Posición | Etiqueta original / nombre común de presentación | Semillas |
|---|---|---|
| 1 | Genovese Basil (albahaca genovesa) | 2 |
| 2 | Red Romaine (lechuga romana roja) | 2 |
| 3 | Rosemary (romero) | 3 |
| 4 | Lavender Vera (lavanda Vera) | 3 |
| 5 | Bibb Lettuce (lechuga Bibb) | Desconocido |
| 6 | Thyme (tomillo) | 2 |
| 7 | Chives (cebollín) | 7 |
| 8 | Buttercrunch Lettuce (lechuga Buttercrunch) | Desconocido |
| 9 | Cherry Tomato (tomate cherry) | Desconocido |
| 10 | Sage Broadleaf (salvia de hoja ancha) | 3 |
| 11 | Black Seeded Simpson (lechuga Black Seeded Simpson) | Desconocido |
| 12 | Common Mint (menta común) | Mínimo 6, máximo desconocido |

Estas etiquetas no establecen por sí solas identidad científica ni fecha de siembra de cada ciclo. Las traducciones son etiquetas editables de presentación. Mantener datos faltantes como desconocidos. No crear disposición geométrica ni numeración visual a partir de esta tabla.

## 18. Contrato offline y sincronización

| Operación | Offline MVP | Confirmación remota |
|---|---|---|
| Ver jardines/historia/fotos ya cacheados | Sí, con fecha de caché y acceso local previamente autenticado | Refrescar al recuperar conexión. |
| Fotos, observaciones, cosechas, aclareo, poda, soporte | Borrador y cola local para ciclo/jardín conocidos | Validar identidad, fechas y permisos antes de commit. |
| Agua, nutrientes, limpieza y mediciones | Borrador y cola local para jardín conocido | Mismas validaciones; no afirmar respaldo anticipado. |
| Se ve bien/Omitir en sesión cacheada | Sí, progreso local y cola | Revalidar ciclo y versión de sesión. |
| Crear/editar borrador | Sí | No requiere IA. |
| Crear/editar/completar/descartar tareas | Requiere conexión | No cambia estado remoto desde una copia vieja. Una acción offline puede proponer completar la tarea al sincronizar. |
| Reemplazar, resembrar, añadir semillas, mover, cerrar/reabrir ciclo | Requiere conexión al confirmar | Operación estructural atómica. Se puede preparar formulario local. |
| Corregir/invalidar hechos, eliminar foto remota, importar | Requiere conexión | Revisión esperada y auditoría. |
| Iniciar/finalizar/abandonar sesión formal | Requiere conexión | Reanudar/pausar localmente sesión cacheada no requiere red. |
| AI Check / chat libre / aceptar propuesta | Requiere conexión | Falla aislada del núcleo manual. |

Solo los borradores quedan completados **localmente** offline; ningún hecho se presenta como confirmado en la cuenta antes del servidor. La UI puede mostrar acciones locales en historial con su distintivo pendiente.

La cola conserva ID de intención, propietario, sujeto original, versiones de contexto, fecha efectiva, contenido y dependencias. Reintentos conservan la misma clave. El servidor devuelve el resultado original si la intención ya se aplicó. Texto y archivo usan dependencias explícitas, para no repetir eventos por un fallo de upload.

**Conflictos:** si el ciclo está cerrado/reemplazado, o cambió de ubicación desde la captura, no reasignar al nuevo ocupante. Pasar a necesita revisión; el usuario puede confirmar una acción retrospectiva en el ciclo anterior si su fecha es coherente, corregir el sujeto o descartar. Una nueva observación independiente no entra en conflicto simplemente porque otra observación se agregó; se validan versiones pertinentes a identidad, ocupación y hechos que condicionen la acción.

No resolver cambios de identidad/fecha por orden de llegada ni fusionar textos automáticamente. No confundir desfase del reloj local con una acción futura: preservar borrador y pedir fecha válida cuando el servidor detecte contradicción.

Sincronización con app activa al volver a abrir, reconectar o pulsar Reintentar. No depender de ejecución en segundo plano. Una actualización de PWA no recarga una sesión con cambios sin guardar; migraciones del almacenamiento local deben preservar borradores o permitir exportarlos.

La pantalla de sincronización muestra pendientes, errores y conflictos por intención. Tras fallo de cuota/almacenamiento local, advertir que no se guardó y ofrecer guardar/descargar la captura; no dar falso éxito. El caché no es backup.

Al cerrar sesión, bloquear acceso visual a caché y borradores. Si hay pendientes, ofrecer sincronizar, exportar borradores o descartarlos explícitamente antes de borrar datos locales. Si expira la sesión, bloquear y pedir autenticación del mismo propietario para recuperar sus pendientes; nunca mostrarlos a otra cuenta.

## 19. Arquitectura de información del MVP

Navegación primaria: **Jardines · Hoy · Preguntar**. Acción persistente **Registrar**. Ajustes y estado de sincronización accesibles desde la navegación secundaria. La presentación exacta puede adaptarse a tamaños de pantalla, sin cambiar destinos ni semántica.

Jerarquía: Jardines → Jardín → Posición → Ciclo actual → Historia/evento/foto. Desde Posición se accede a ciclos anteriores. Desde un ciclo se puede ver dónde estuvo y navegar a su posición actual/histórica.

Jardines presenta **Desde la última vez** y **Atención** como bloques distintos, según §10. Hoy es la vista completa del mismo sistema de atención, con filtros aceptadas/propuestas/fechas/jardín. Preguntar mantiene contexto visible y referencias interactivas a evidencia. Control V2 es informe secundario de un jardín o ambos, nunca la navegación móvil principal.

Plantas y fotografía tienen prioridad visual; indicadores acompañados de texto, objetivos táctiles de al menos 44 × 44 CSS px, controles comunes utilizables con una mano y foco/etiquetas accesibles. Animaciones no impiden registrar ni comunican por sí solas un cambio de estado.

Ningún estado crítico depende exclusivamente del color: salud que requiere acción, conflicto/error de sincronización, evidencia no disponible o bloqueo de guardado conservan **texto explícito e iconografía distinguible**, además de nombre accesible. Un punto rojo o un borde ámbar solos no satisfacen el contrato. Verificar comprensión en escala de grises y mediante lectura asistida, sin depender de hover.

## 20. Inventario obligatorio de pantallas y vistas

El inventario fija capacidades; una vista puede resolverse como pantalla, panel o diálogo accesible. No obliga a una URL por fila.

| ID | Vista | Propósito |
|---|---|---|
| V01 | Acceso y recuperación | Iniciar sesión privada, restablecer acceso y tratar expiración. |
| V02 | Configuración inicial / datos del propietario | Zona horaria, jardines y acceso a importación. Sin registro público. |
| V03 | Jardines | Ambos sistemas, evidencia fechada y bloques distintos de Desde la última vez y Atención. |
| V04 | Jardín: mapa/lista | Relación con posiciones físicas y acciones del depósito. |
| V05 | Posición/ciclo actual | Identidad, edad, revisiones, próxima acción y Quick Actions. |
| V06 | Ciclos anteriores / ocupaciones | Elegir ciclo histórico y reconstruir ubicaciones. |
| V07 | Timeline y detalle de evento | Hecho, fuente, fechas, revisiones y acceso a corregir/invalidar. |
| V08 | Registrar / editor de acción | Captura mínima y confirmación del contenido elegido. |
| V09 | Cámara/carga/observación | Foto, texto opcional, sujeto, guardar y analizar opcional. |
| V10 | Galería, foto y comparación | Historial visual, fechas de evidencia persistentemente visibles, original autorizado y eliminación explícita. |
| V11 | AI Check / resultado / propuesta | Estado de ejecución, evidencia, abstención y CTAs explícitos separados: tarea y observación visual personal. |
| V12 | Hoy / detalle-editor de tarea | Una cola, filtros, estados, criterios, posposición y propuestas. |
| V13 | Recurrencias | Elegir intervalo/ancla, ver previsión y activar/pausar. |
| V14 | Inicio/reanudación de mantenimiento | Jardines, sesión abierta y continuación. |
| V15 | Recorrido de mantenimiento | Jardín + pod/posición persistentes, Se ve bien/Omitir, progreso y pausa. |
| V16 | Resumen de sesión | Hechos realizados y cierre con omisiones visibles. |
| V17 | Preguntar / conversación | Consultas rápidas deterministas, chat contextual y referencias que abren evidencia fuente. |
| V18 | Ciclo: alta/cierre/reemplazo/movimiento | Antes/después, datos mínimos y conflictos estructurales. |
| V19 | Control V2 | Informe calculado y exportación/impresión. |
| V20 | Importación y revisión | Candidatos, conflictos, duplicados, confirmación y resultado. |
| V21 | Sincronización y recuperación | Pendientes, errores, revisión de conflicto y exportación de borradores. |
| V22 | Ajustes / datos / servicio | Perfil, jardines/layout de datos, exportación, estado de IA y presupuesto, backup y cierre de sesión. |

Todas las vistas de escritura incluyen estados vacío/cargando/error/sin conexión y mantienen contenido al fallar. El catálogo mínimo se busca/edita desde alta o corrección de ciclo; no exige un módulo botánico independiente.

## 21. Criterios de aceptación de los recorridos centrales

Los conteos parten del contexto indicado, con sesión iniciada y permisos de cámara ya concedidos. Excluyen desbloqueo, escritura/dictado, selector del sistema y tiempo físico de captura. Son máximos de decisiones de aplicación para el caso estándar, no para correcciones o datos excepcionales.

| ID | Recorrido y criterio medible | Prueba obligatoria |
|---|---|---|
| AC01 | **Quick Check:** desde mapa, elegir pod → Foto → capturar → Guardar, máximo cuatro acciones incluyendo el disparador. Comentario e IA opcionales. | Guardar una foto sin texto ni análisis. Ver sujeto, fecha y estado de carga correctos; ningún problema/tarea automática. |
| AC02 | **AI Check:** sobre captura lista, Guardar y analizar → revisar → aceptar una propuesta de tarea, máximo tres decisiones adicionales. Guardar antes de inferir. La revisión manual basada en IA añade confirmación personal explícita. | Provocar fallo de IA y comprobar que foto/observación siguen accesibles. Aceptar interpretación no crea `visual_review`; confirmar expresamente observación personal sí permite crearla. Rechazar propuesta conserva evidencia. Contexto modificado bloquea aplicación automática. |
| AC03 | **Mantenimiento:** seleccionar ambos jardines, registrar sistema y recorrer los 20 pods. Se ve bien avanza con un toque; Omitir también, con semántica distinta. | Pausar después de tres posiciones, cerrar/reabrir la app y reanudar sin duplicados. Finalizar sesión con omisiones explícitas. Resumen y base coinciden; agua no realizada no figura como cambiada. |
| AC04 | **Cosecha:** desde perfil, Cosechar → Guardar, dos toques, sin cantidad obligatoria. | Enviar dos veces la misma intención: una sola cosecha. Deshacer invalida el registro y actualiza derivados. |
| AC05 | **Resiembra/reemplazo:** desde perfil, abrir acción → definir nuevo ciclo → revisar y confirmar, máximo cuatro decisiones de aplicación además de introducir datos. | Cierre/apertura atómicos, fotos antiguas en el ciclo anterior, fecha nueva independiente y tareas viejas descartadas. Fallo intermedio no deja posición incoherente. |
| AC06 | **Ask Garden:** desde contexto, pregunta → respuesta con evidencia. Para último aclareo/agua, fecha igual a consulta canónica. | Probar fecha conocida, desconocida, corrección, registro inválido y referencia a otro propietario. No inventar fecha ni citar evidencia inaccesible. |
| AC07 | **Comparación histórica:** desde galería del ciclo, seleccionar dos imágenes y Comparar, máximo tres decisiones. | Ambas fechas visibles y asociación correcta, sin modificación de originales ni porcentaje inventado. Eliminación de una foto no deja una comparación falsa disponible. |
| AC08 | **Núcleo sin IA:** desactivar el gateway y ejecutar todas las funciones manuales de §2. | Jardines, ciclos, fotos, observaciones, cosecha/aclareo/poda, mantenimiento, reemplazo, tareas, revisión manual y correcciones funcionan con conexión sin llamadas al modelo. |
| AC09 | **Offline:** capturar foto y acción simple, cerrar/reabrir, reconectar. | Un solo evento por intención; original subido una vez; estados locales/remotos correctos. Reemplazo concurrente produce conflicto revisable y no reasignación silenciosa. |
| AC10 | **Desde la última vez:** crear cambios entre dos visitas y repetir apertura/recarga en la misma visita. | Mismo B dentro de visita; ninguna pérdida por acuses concurrentes o tardíos; importación tardía rotulada; sin crecimiento ficticio al adelantar fecha. |
| AC11 | **Attention Queue:** abrir el mismo seguimiento desde Jardines, Hoy y Mantenimiento. | Misma identidad/estado; propuesta equivalente no duplica tarea; rechazo no completa una acción; cerrar incidente y ciclo aplica los efectos especificados. |
| AC12 | **Recurrencias:** probar intervalo desde acción real y martes anclados con retrasos y períodos omitidos. | Relleno no reinicia cambio de agua; ancla se mantiene; máximo una ocurrencia abierta; ambos jardines se completan de forma independiente. |
| AC13 | **Integridad/corrección:** corregir fecha de siembra y después invalidar un evento asociado a una tarea completada. | Edad y vistas derivadas actualizadas; revisiones originales disponibles; tarea refleja el fundamento vigente. |
| AC14 | **Importación:** importar el mismo lote dos veces, incluyendo recomendación y contradicción. | Mismos IDs confirmados, sin duplicados; recomendación no convertida en hecho; contradicción sin resolver no aplicada. |

**Comprobaciones de los siete ajustes visuales aprobados:**

- **AC10 / Home:** mostrar novedades vacías con Atención no vacía; consultar novedades no resuelve pendientes. Una transición reciente enlaza el mismo ID de tarea en ambos bloques sin duplicar el conteo.
- **Harvest Readiness:** comprobar los cuatro valores y traducciones de §8 en perfil, informe y evaluación; no aparece un quinto estado ni se mezcla con salud.
- **AC02 / CTA:** “Guardar mi observación visual” permanece inactivo sin declaración personal; al guardar registra únicamente el resultado y sujeto mostrados. Crear tarea no crea revisión ni acción física.
- **AC03 / Contexto:** jardín y posición legibles al desplazar contenido, abrir editor, revisar captura, pasar entre jardines y reanudar; ningún guardado hereda el destino anterior por error.
- **AC06 / Referencias:** tocar cada referencia de evento/foto abre la evidencia exacta autorizada y permite volver al chat; cubrir versión corregida, foto eliminada y permiso denegado.
- **AC07 / Fechas:** fechas y precisión visibles en historia/comparación, también con zoom y en móvil; carga y captura no se confunden.
- **Estados críticos:** texto, iconografía y nombre accesible permiten identificar el estado sin color; comprobar en escala de grises y lectura asistida.

**Rendimiento de aceptación:** en el iPhone real acordado y red de prueba documentada, medir al menos 20 repeticiones de las rutas frecuentes: respuesta visual del control ≤200 ms en percentil 95; presentación del resultado local de una acción simple ≤1 s; Jardines usable desde caché ≤2 s. La sincronización remota tiene indicador inmediato y no bloquea la siguiente captura; no se promete tiempo de upload independiente del tamaño/red. Para AI Check medir latencia real del piloto y cumplimiento del manejo de timeout de 60 s; no ocultar lentitud con falso resultado terminado.

Las pruebas de duración no incluyen trabajo de cámara/dictado del sistema. La verificación automática no sustituye pruebas de cámara, HEIC, instalación, suspensión/reanudación, una mano y conectividad en dispositivo real. Conservar una lista de pruebas ejecutadas, resultado y entorno; una prueba no realizada no puede marcarse aprobada.

## 22. Contrato de seguridad

**Autenticación:** una cuenta inicial provisionada de forma controlada, sin registro público. Método MVP: correo y contraseña, sesión persistente y recuperación por correo configurada/probada. Confirmar el correo del propietario durante provisionamiento. No construir gestión de equipos ni roles. La app bloquea acceso a datos privados cuando expira o se cierra la sesión.

**Autorización:** todo comando y consulta verifica identidad, propiedad del sujeto y de cada relación. El servidor obtiene propietario desde la sesión verificada, no de un campo libre del cliente. Probar aislamiento con dos cuentas de prueba aunque haya un único propietario en producción.

RLS en todas las tablas expuestas; permisos de API explícitos y mínimos. Lectura, inserción, actualización y eliminación deben restringir propietario. Validar también relaciones cruzadas y cambios de propietario; el usuario no puede reasignar registros mediante una actualización. Vistas y funciones no pueden ampliar acceso por accidente. Reglas equivalentes para originales, derivados y metadatos de Storage.

**Fotos privadas:** sin bucket público ni URLs permanentes compartibles. Enlaces firmados de lectura con duración máxima de 5 minutos y sin registrarlos en telemetría. Originales requieren el mismo control de acceso que derivados. No basta con esconder un botón en frontend.

**Secretos:** credenciales de IA, servicios y backup solo en servidor/almacén de secretos. La clave pública de cliente no debe dar privilegios de servicio. No incluir contraseñas, claves, tokens o sesiones en bundle, exportación de usuario, logs o mensajes enviados al modelo.

**Gateway:** verificar sesión y presupuesto antes de recuperar/enviar evidencia. El modelo recibe exclusivamente datos autorizados y herramientas acotadas de lectura/propuesta. Texto importado, instrucciones fotografiadas y resultados de herramientas son datos no confiables, no reglas de permiso. Ninguna instrucción en ellos puede crear acceso SQL o escritura libre.

**Operaciones:** validación de formato, tamaño, tipos y fechas en servidor; renderizado seguro de texto; HTTPS; protección contra solicitudes de escritura no autorizadas según el mecanismo de sesión usado; límites por propietario y operación; claves de idempotencia y revisiones esperadas. Recursos auxiliares, candidatos de importación y chat también quedan aislados.

**Privacidad del dispositivo:** el caché pertenece al propietario autenticado y se limpia conforme a §18. No almacenar GPS, contactos, publicidad, huellas de dispositivo, audio continuo ni coordenadas de interacción. El EXIF que ya forme parte del original privado tiene el tratamiento restringido de §13; no se convierte en datos de perfil.

Pruebas obligatorias: usuario sin sesión, segunda cuenta, ID de otro propietario, enlace caducado, vínculo cruzado, intento de cambiar propietario, acceso a candidatos/chat/derivados ajenos y propuesta de IA maliciosa. Se espera denegación de datos y ausencia de escrituras. Estas pruebas cubren base/API/Storage reales de prueba, no solo mocks de frontend.

Las políticas de filas y archivos se fundamentan en [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security) y [control de acceso de Storage](https://supabase.com/docs/guides/storage/security/access-control). El contrato fija el comportamiento; la implementación verificará las APIs y configuración vigentes antes de aplicarlas.

## 23. Contrato de backup y recuperación

**Protección mínima de producción:** copia diaria de base de datos y de originales fotográficos, con máximo 24 horas entre puntos recuperables de registros sincronizados. Copias cifradas en destino independiente del proyecto principal, con credenciales separadas y retención móvil de 30 días. Los derivados pueden regenerarse si se conserva versión del proceso; los originales no.

Objetivos: **RPO ≤24 h** para datos ya confirmados en servidor; **RTO objetivo ≤24 h** desde el inicio de recuperación atendida. No se promete recuperación de borradores que solo existían en un dispositivo perdido. La pantalla distingue respaldo remoto de sincronización y almacenamiento local.

El backup de base incluye hechos/revisiones, ciclos/ocupaciones, tareas/reglas, evaluaciones/propuestas, asociaciones, importaciones confirmadas y los metadatos operativos necesarios. La copia de archivos incluye manifiesto con ID, checksum y objeto original. El punto de recuperación se considera consistente solo cuando cada referencia a foto lista en la base dispone de original verificado en la copia; las fotos pendientes permanecen identificadas como pendientes. Conservar instrucciones/configuración para restablecer autenticación y acceso del propietario sin exportar secretos al cliente.

Los backups de base de datos de Supabase no incluyen los objetos de Storage: ambos respaldos deben comprobarse por separado. [Backups de Supabase](https://supabase.com/docs/guides/platform/backups).

**Eliminaciones:** un registro mínimo de supresiones se conserva de forma independiente y actualizada antes de confirmar eliminación al usuario. Antes de servir una restauración se reaplican esas supresiones sobre originales, derivados, asociaciones visibles y cachés. Ninguna restauración hace reaparecer fotos eliminadas. Las copias antiguas pueden contenerlas hasta su vencimiento máximo de 30 días; nunca vuelven al producto durante ese período. No conservar fotos más allá de esa retención por un backup olvidado.

**Validación antes de producción:** restaurar en entorno aislado una copia que incluya un ciclo reemplazado, una corrección, una tarea completada, una sesión con omisiones y originales JPEG/HEIC. Verificar checksum de todos los originales incluidos en el ensayo, relaciones, Control V2, acceso del propietario y aislamiento frente a otra cuenta. Incluir una foto eliminada después del snapshot y comprobar que no reaparece. Registrar punto de recuperación, duración y resultado.

**Operación posterior:** comprobar ejecución y cobertura diaria; si no existe punto consistente dentro de 24 h, mostrar estado de backup fallido/desactualizado al propietario y registrar alerta operativa. Ensayo de restauración cada 90 días y después de un cambio material de esquema/almacenamiento. Esta es una obligación del producto/operación futura; no crea una automatización en esta conversación.

**Exportación de usuario:** JSON de registros vigentes e historia, CSV de Control V2 y archivo/manifiesto de fotos originales accesibles. Debe incluir versión de formato, precisión temporal y referencias, sin credenciales, GPS extraído ni datos de otras cuentas. Exportación no sustituye backup. Se inicia desde Ajustes y entrega archivos descargables sin intervención de un agente o administrador; puede procesarse como trabajo de servidor con progreso y reintento visibles.

## 24. Observabilidad y control de IA

Medir operaciones para detectar fallos y controlar gasto. No construir un sistema de seguimiento del comportamiento personal.

| Área | Datos mínimos | Uso |
|---|---|---|
| Errores | Código/tipo, operación, versión de app, instante, ID de correlación y resultado | Encontrar y reproducir fallos sin copiar contenido privado. |
| Sincronización | Intención, estados, intentos, tiempo pendiente, error/conflicto y resolución | Detectar registros atascados o duplicados. |
| IA: latencia | Modelo/esfuerzo, operación, inicio/fin, timeout/cancelación | Evaluar respuesta y dependencia del proveedor. |
| IA: costo | Uso facturable reportado, entrada/salida/razonamiento cuando disponible, imágenes, tarifa/versionado y costo estimado/conciliado | Presupuesto y comparación de modelos. Dato no disponible no equivale a cero. |
| IA: calidad | Versión de instrucciones y evaluación, propuesta aceptada/editada/rechazada/obsoleta | Mejorar el sistema; aceptación no prueba que la recomendación funcionó. |
| Tareas | Creación, origen, completada/descartada/reabierta, vínculo con hecho | Verificar motor de tareas, no medir productividad personal. |
| Imágenes | Formato, tamaño, fase de procesamiento, fallo de carga/conversión/checksum | Resolver problemas de cámara y Storage. |
| Recuperación | Último snapshot consistente, cobertura de originales, fallos y ensayo de restauración | Comprobar cumplimiento de §23. |

No enviar fotos, textos de notas, conversaciones completas, URLs firmadas, claves, EXIF, coordenadas ni datos de ubicación a logs/analítica. Los detalles necesarios para el historial viven en almacenamiento privado de producto, con permisos; logs referencian IDs opacos y se limitan al diagnóstico autorizado.

Retención de logs operativos: 30 días. Totales mensuales de uso/costo pueden conservarse 12 meses sin contenido de cultivo. Aceptaciones y correcciones históricas siguen la retención de sus registros canónicos; no se eliminan al expirar un log técnico.

Cada solicitud de IA tiene presupuesto máximo de contexto/salida y reserva de gasto para llamadas simultáneas. El límite mensual configurable se aplica en gateway, no solo en frontend. Al alcanzarlo, rechazar nuevas llamadas de pago y mantener registro manual. El precio usado y su fecha deben ser configurables; los cargos reales pueden diferir de la estimación y se concilian con uso reportado. No asegurar precisión de gasto que el proveedor no permita verificar.

Alertas operativas en Ajustes/estado del servicio para fallos persistentes, presupuesto y backups. Sin emails de jardinería, push o recordatorios externos en MVP; correos de autenticación/recuperación se mantienen. “Desde la última vez” usa un checkpoint necesario para la función, no un historial de navegación destinado a analítica.

## 25. Fronteras técnicas

Stack de partida aprobado: **React + TypeScript + Vite**, PWA responsive, **Supabase gestionado** para PostgreSQL/Auth/Storage y gateway de IA en servidor. Proyecto Garden separado. Sin Realtime, base vectorial ni autoalojamiento de Supabase en MVP.

| Capa | Responsabilidad | Límite |
|---|---|---|
| Frontend | Navegación, cámara, vistas, borradores/cache, confirmaciones, presentación de propuestas y sync | No autoridad final sobre permisos, integridad, hechos ni gasto. No secretos de servidor. |
| Base de datos | Relaciones, restricciones, versiones vigentes, historial, propiedad, transacciones e idempotencia | No inferir botánica ni tomar decisiones de IA. No mantener una segunda lista de atención. |
| Servidor de aplicación | Comandos de dominio, validación, autorización, recurrencias, proyecciones, archivos y gateway | No permitir que un prompt omita confirmaciones o restricciones. |
| Capa IA | Interpretación de entrada, evaluación visual, redacción y propuestas estructuradas | No SQL libre, escritura histórica directa ni cálculo autoritativo de fechas. |
| Procesamiento de imágenes | Validación, derivados, metadatos permitidos, checksums y eliminación | Original inmutable; sin mejora generativa de evidencia. |
| Operación | Hosting, secretos, backups, restauración, alertas y presupuesto | No considerar un despliegue exitoso prueba de recuperación o calidad visual. |

Todas las escrituras de dominio entran por comandos validados, con contexto del actor, clave de intención, revisiones esperadas cuando corresponda y respuesta de confirmación. Comandos mínimos: registrar evento; iniciar/cerrar/reemplazar/mover ciclo; corregir/invalidar/revertir; crear/resolver/posponer tarea; activar/cambiar regla; iniciar/pausar/cerrar sesión; aceptar propuesta; confirmar importación; preparar/confirmar/eliminar archivo. Los nombres de endpoints son detalle de implementación; semántica y atomicidad no lo son.

El servidor ejecuta cada comando mediante una transacción de dominio en Postgres que agrupa cambios e historial. No simular transacción con varias peticiones independientes desde el navegador. Los permisos de base deben impedir que una escritura directa del cliente evada revisión, auditoría o cierre/apertura atómicos. Las funciones privilegiadas, si se necesitan, deben tener acceso mínimo y autorización interna explícita; la mera comodidad no justifica omitir RLS.

Derivados y proyecciones pueden cachearse, pero su clave incluye propietario, parámetros, `as_of` relevante y revisión de datos. Toda corrección invalida el caché pertinente. Edad/fechas y recorrencias se calculan en lógica determinista compartida o servidor; no debe haber dos algoritmos divergentes entre Control V2 y Hoy.

**Ubicación de servicios:** usar funciones del backend gestionado como punto de partida del servidor; el procesamiento HEIC puede requerir un runtime de imágenes compatible. Esa selección se resuelve en la prueba técnica temprana y se registra como detalle de infraestructura, manteniendo los contratos de archivo/seguridad. No añadir microservicios salvo una incompatibilidad demostrada; preferir un único servidor de aplicación cuando el hosting lo soporte.

**Despliegue:** comprobar capacidad del hosting actual para estáticos/rutas de PWA, HTTPS, DNS, secretos, servidor y procesamiento de imágenes. El dominio aprobado no constituye credencial ni garantiza esas capacidades. Revisar versiones actuales de dependencias, Auth, RLS y Storage antes de implementar. Un cambio de stack requiere motivo técnico concreto y revisión del contrato, no nueva exploración por preferencia de un agente.

## 26. Secuencia de implementación, dependencias y modelos

La ejecución comenzará únicamente cuando el usuario la solicite. Cada paquete recibe este contrato, su alcance concreto y criterios de aceptación. No enviar de nuevo todo el historial de conversación ni producir revisiones completas repetidas. Esta tabla distribuye trabajo futuro; no crea ni lanza agentes ahora.

| Orden / paquete | Entrega y dependencia | Modelo inicial / esfuerzo | Validación de salida |
|---|---|---|---|
| P01 — Preparación acotada | Repositorio, entorno y revisión de capacidades necesarias; depende de autorización de implementación. | **Luna, bajo** para inventario; **Terra, medio** para decisiones técnicas puntuales. | Límites del contrato reflejados; secretos fuera de cliente; listado concreto de incógnitas técnicas. |
| P02 — Prueba de dispositivo/imagen | Captura iPhone, HEIC, originales/derivados, PWA y recuperación local con datos de prueba; depende de P01. | **Terra, medio**. | Elegir runtime de imágenes y verificar original intacto, orientación y recuperación. Sin diseño visual definitivo. |
| P03 — Dominio, acceso e historia | Esquema, revisiones, ocupaciones, transacciones, idempotencia y aislamiento; depende de P01 y decisiones de P02 relevantes a fotos. | **Terra, alto**; **Sol, alto** para revisión focalizada de invariantes y seguridad. | Pruebas de §7 y §22; reemplazo/corrección sin pérdida ni acceso cruzado. |
| P04 — UX de registro y vistas base | Jardines/lista, perfil, timeline y Quick Actions sobre dominio estable; depende de P03. | **Terra, medio** para flujos/integración; **Luna, medio** para componentes definidos y textos. | AC01, AC04, AC05 y navegación manual sin IA. Mapas finales esperan orientación del usuario. |
| P05 — Fotos y sync completos | Integrar P02 con permisos/eventos de P03 y UI de P04. | **Terra, medio**. | AC07, AC09; originales privados, no pérdida de borradores ni duplicados. |
| P06 — Atención y recurrencias | Tareas, propuestas como contrato sin llamadas aún, dedup y ambas reglas; depende de P03–P04. | **Terra, alto** para fechas/estados. | AC11–AC12 y efectos de correcciones/cierre de ciclo. |
| P07 — Mantenimiento y vistas derivadas | Sesiones, Since Last Time y Control V2; depende de P05–P06. | **Terra, medio**; **Luna, medio** para tablas/plantillas ya definidas. | AC03, AC10, AC13; una sola fuente de pendientes y fechas. |
| P08 — IA y evaluaciones | Gateway, AI Check, Ask Garden y confirmaciones sobre dominio ya fiable; depende de P05–P07. | **Terra, alto** para integrar; **Sol, alto** para revisión acotada de permisos, evidencia y fallos. | AC02, AC06, AC08 y piloto de §11. Ningún modelo de runtime sin evaluación de sus casos. |
| P09 — Importación selectiva | Lotes revisables, fotos útiles y datos actuales; depende de P03–P05. Puede prepararse antes de P08 sin convertir extracción en hechos. | **Luna, bajo** para extracción/normalización; **Terra, medio** para conflictos e integración. | AC14 y usuario confirma candidatos, no reconstrucción exhaustiva. |
| P10 — Recuperación y observabilidad | Backups, exportación, gasto y diagnóstico; comienza con P03, integración final tras P05/P08. | **Terra, medio**; **Luna, bajo** para documentación operativa. | Restore de §23, costos visibles y fotos verificadas. |
| P11 — Validación de MVP | Integración final, pruebas adversas y uso real; depende de P04–P10. | **Luna, medio** para ejecutar casos definidos; **Terra, alto** para diagnosticar fallos; **Sol, alto** para revisión final limitada a riesgos pendientes. | Todos los criterios de §27 documentados, con pruebas reales diferenciadas de automatizadas. |
| P12 — Liberación | Hosting/dominio, configuración y despliegue aprobado; depende de P11 y decisiones de producción de §28. | **Terra, medio**; **Luna, bajo** para handoff operativo. | Verificación autenticada en producción, instalación y acceso del propietario; sin sustituir ensayo de backup. |

**Regla de escalada:** Luna para tareas claras/repetibles; Terra para integración y razonamiento habitual; Sol para decisiones complejas y revisiones críticas concretas. Astra solo si queda un problema difícil no resuelto con evidencia por Sol y su uso se justifica; no se programa como revisión obligatoria. Subir esfuerzo/modelo responde a un fallo o riesgo observado, no al tamaño del nombre de la tarea. [Orientación oficial de modelos](https://learn.chatgpt.com/docs/models).

La elección de modelo dentro de la aplicación es independiente de quién implementa el módulo:

| Operación runtime | Modelo / mecanismo |
|---|---|
| Edad, fechas conocidas, última acción, recurrencias, filtros, resúmenes y Control V2 | **Sin LLM**; consultas/código/plantillas. |
| Guardar acción/foto, mantenimiento manual, corrección, reemplazo o tareas | **Sin LLM**. |
| Interpretar pregunta libre o extraer propuesta de una nota | **Luna**, esfuerzo mínimo que pase evaluación. |
| AI Check y comparación visual interpretativa | **Terra** durante piloto. |
| Juicio complejo con evidencia suficiente y beneficio comprobado | **Sol**, excepcional y dentro del límite de gasto. |
| Evidencia insuficiente | Abstención/nueva captura; **sin escalada automática**. |

No fijar precios en el contrato como constantes del producto. Usar configuración de tarifas versionadas y consumo reportado. Los créditos empleados en Codex y la facturación API de Streex Garden se registran y presupuestan por separado. No afirmar que la asignación de esta tabla cambió el modelo de la conversación actual.

## 27. Definition of Done — MVP

La implementación solo está terminada cuando **todos** estos puntos tengan evidencia de aprobación. “Preparado”, “mock”, “compila” o “pendiente de dispositivo” no equivalen a completado.

- [ ] Están incorporados los dos jardines y sus ciclos activos con datos revisados; cualquier desconocido queda visible, sin fechas heredadas del jardín.
- [ ] Numeración/orientación de ambos mapas confirmadas por el usuario y representadas fielmente; lista alternativa accesible.
- [ ] Las capacidades incluidas en §2 están disponibles y las exclusiones de §3 no se han convertido en alcance adicional.
- [ ] Visual Concept 01 y los siete ajustes aprobados de §21 se respetan; la lámina no sustituye el vocabulario y comportamiento normativos cuando contiene texto ilustrativo anterior.
- [ ] AC01–AC14 aprobados, con entorno, datos y resultados documentados.
- [ ] El núcleo manual completo funciona con la IA desactivada; las consultas rápidas deterministas también.
- [ ] AI Check y Ask Garden funcionan con el proveedor real y pasan el piloto de §11; citas/referencias verificables, abstención, fallos y límites de gasto probados.
- [ ] No hay escrituras históricas sin confirmación ni credenciales de servicio en frontend/modelo.
- [ ] Aceptar una interpretación IA no crea revisión visual manual ni acción física. La revisión exige declaración explícita de observación personal y conserva referencia a la evidencia IA cuando corresponda.
- [ ] Ciclos, ocupaciones, correcciones, invalidaciones, tareas y sesiones respetan transacciones, idempotencia y efectos derivados.
- [ ] Control V2, Hoy, Jardines y Mantenimiento reflejan el mismo estado canónico, sin listas contradictorias.
- [ ] Since Last Time pasa pruebas de primera visita, recarga, concurrencia, offline, importación retrospectiva y transiciones por fecha.
- [ ] Umbral de visita y retención de chat se leen de configuración, con valores iniciales 30 minutos/30 días; cambios de configuración y expiraciones respetan §§10 y 12 sin alterar hechos históricos.
- [ ] Recurrencia elegida/configurada antes de activarla; alternativa implementada y probada aunque no esté activa. Si el usuario decide dejarla inactiva, se indica “sin programar”.
- [ ] Cámara, JPEG/HEIC, originales/derivados, eliminación y comparación verificados con imágenes reales del iPhone.
- [ ] Borradores sobreviven interrupciones; reintentos y conflictos no pierden ni reasignan registros. Instalación y actualización de PWA verificadas en iPhone real.
- [ ] Responsive y navegación accesible comprobados en tablet y escritorio; objetivos táctiles/foco/etiquetas y criterios de rendimiento de §21 verificados.
- [ ] Auth y recuperación de cuenta probadas; aislamiento de base/API/Storage con segunda cuenta y acceso no autenticado aprobado.
- [ ] Importación repetida no duplica; recomendaciones/conflictos no se convierten en hechos; los candidatos rechazados conservan su decisión.
- [ ] Backup de datos **y originales** ejecutado, punto recuperable consistente y ensayo de restauración aprobado, incluyendo supresiones.
- [ ] Exportación descargable probada; logs, sync, costo/latencia de IA y fallos de imagen observables sin contenido invasivo.
- [ ] Límite de gasto aprobado y aplicado; operación sin IA por presupuesto agotado comprobada.
- [ ] Prueba real frente a los jardines: una observación espontánea, una cosecha o intervención real pertinente, una revisión guiada y una consulta histórica. No realizar una intervención innecesaria solo para probar la app; los casos destructivos pueden validarse en datos de prueba.
- [ ] Hosting y dominio verificados, despliegue autorizado realizado y QA autenticada en producción aprobada. Los ensayos que podrían alterar historia real usan entorno/datos de prueba.
- [ ] Cero defectos abiertos de pérdida de datos, privacidad, escritura no autorizada, identidad de ciclo o bloqueo de recorrido obligatorio. Cualquier defecto menor aceptado queda documentado con impacto.
- [ ] Handoff operativo entregado: acceso/recuperación, sincronización, exportación, backup, límites de IA y resolución de fallos. El usuario confirma que puede registrar y consultar sus jardines desde la app sin depender de la conversación anterior como fuente de verdad.

## 28. Decisiones pendientes del usuario

**Bloqueos para comenzar:** no quedan decisiones de producto ni de dirección visual que impidan iniciar el trabajo local y la implementación del núcleo cuando el usuario lo indique. Visual Concept 01 ya está aprobado; no hay una nueva fase de exploración visual obligatoria. La instrucción actual sigue siendo no implementar. Los pendientes siguientes bloquean únicamente sus operaciones/etapas específicas, no el inicio completo. Las verificaciones técnicas del hosting, modelos, HEIC y RLS corresponden a implementación; no se devuelven como preguntas de arquitectura al usuario.

| Decisión | Por qué importa | Cuándo | Opciones reales | Valor recomendado mientras tanto |
|---|---|---|---|---|
| Orientación y correspondencia visual de posiciones de ambos URUQ | Identificar sin error la planta física. | Antes de implementar los mapas definitivos de P04. | Fotografías con referencia del panel/frente y numeración confirmada; o esquema numerado explícito aportado por el usuario. | Usar lista numerada y layout geométrico sin activar hasta confirmación; no inferir filas. |
| Datos activos e historia selectiva que aún no constan | Evitar importar identidad/fecha incorrecta y escoger qué historia tiene valor. | Durante P09, antes de confirmar cada lote. | Aportar datos/fragmentos/fotos pertinentes; confirmar candidatos; dejar campos desconocidos. | Priorizar ciclos activos e intervenciones/mantenimiento importantes. Importar solo lo confirmado. |
| Recurrencia de producción y primera fecha | Coordinar mantenimiento sin inventar acciones ni un martes de referencia. | Antes de activar reglas en producción. | Martes alternos con ancla elegido; intervalo de 14 días desde cambio real conocido; mantener regla inactiva. | Martes alternos compartiendo ancla entre jardines; inactivo hasta indicar fecha. |
| Cuenta propietaria y acceso a infraestructura existente | Provisionar acceso privado y verificar dominio/hosting reales. | Al configurar entornos y antes de P12. | Usar cuenta/correo y hosting que el usuario indique; si son incompatibles, presentar resultado técnico y alternativa concreta. | Cuenta privada única, Supabase gestionado y frontend en hosting existente si cumple. Credenciales por mecanismo seguro, nunca texto en el contrato. |
| Límite mensual de API y autorización de costos de infraestructura | Aplicar presupuesto y habilitar servicios de pago sin suposiciones. | Antes de llamadas de pago del piloto y antes de contratar/desplegar. | Usuario fija importe máximo; habilita piloto acotado con límite; mantiene IA desactivada hasta elegirlo. | Límite de gasto de IA en cero hasta autorización concreta; presentar costo de infraestructura según capacidades/planes verificados. |

Volumen del depósito, marca/dosis de nutrientes y mediciones faltantes permanecen desconocidos si el usuario no los registra. No bloquean el núcleo manual ni se convierten en nuevas preguntas obligatorias. La preparación del contrato no exige decidir branding, multiusuario, sensores ni funciones excluidas.

---

**Estado contractual:** v1 y Visual Concept 01 aprobados y congelados para MVP, con las tres enmiendas previas y los siete ajustes visuales incorporados. Conserva 28 secciones y los pendientes operativos de §28 para sus etapas. El mapa físico continúa provisional. La implementación y el despliegue permanecen sin iniciar.
