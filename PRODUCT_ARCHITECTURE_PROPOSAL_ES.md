> **Nota de estado (10 sep 2026):** este documento conserva una propuesta fechada. Para funcionalidades y operación actuales consulta [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

# Streex Garden — Propuesta de producto y arquitectura

Fecha: 6 de septiembre de 2026. Estado: propuesta para revisión; no constituye aprobación de implementación.

Este documento responde al Master Product Brief. No se ha creado código, infraestructura ni migraciones. Las decisiones son recomendaciones; las capacidades de modelos y plataformas se contrastaron con documentación oficial. No se ha validado todavía la experiencia con tus jardines, fotografías o dispositivos.

## Recomendación principal

Construir una PWA privada para cuidar, registrar y comprender tus dos jardines. El núcleo será un registro confiable de ciclos de cultivo, acciones y fotografías. La IA consultará ese registro y propondrá interpretaciones y acciones con evidencia visible.

Tres resultados definen el producto: identificar lo que necesita atención, registrar algo mientras estás frente al jardín y reconstruir lo que ocurrió con una planta. Una app que consiga esto con pocos gestos puede reemplazar el flujo actual de ChatGPT sin reproducir una conversación interminable.

## A. Crítica del brief

| Hallazgo | Riesgo | Cambio recomendado |
|---|---|---|
| Dashboard, Today y resumen de mantenimiento repiten información. | Tres lugares que parecen fuentes distintas de pendientes. | Una sola cola de atención, presentada desde distintos contextos. |
| “Upcoming”, “due”, “AI suggested” y “reassess” mezclan conceptos. | Tareas difíciles de filtrar y transiciones contradictorias. | Separar origen, aceptación, estado y criterio temporal. |
| Salud general sin explicar evidencia. | Un jardín parece sano porque nadie lo revisó. | Mostrar estado y fecha de revisión por separado; permitir “sin evaluar”. |
| “Edible” mezcla identidad, madurez y aptitud para consumir. | Un verde puede parecer una garantía que la foto no permite sostener. | Usar “cosecha: no todavía / evaluar / lista / no aplica”; nunca certificar consumo por imagen. |
| “Nutrient status” sin mediciones. | Inventar niveles o carencias desde un calendario. | Mostrar última adición registrada; concentración desconocida salvo medición pertinente. |
| El pod se trata como posición y como planta. | Mover una canastilla rompe su historia. | Posición física permanente y ciclo de cultivo con historial de ubicación. |
| Cada ciclo puede contener varias plántulas. | La supervivencia se calcula como si hubiera un único individuo. | Un ciclo representa una siembra o cohorte; conteos opcionales, sin fichas por semilla en MVP. |
| Revisar todos los pods siempre. | Convertir el mantenimiento en veinte formularios. | Revisión completa opcional y recorrido enfocado en pendientes; un toque para “Se ve bien”. |
| Falta una transición desde ChatGPT. | La nueva app comienza vacía y pierde su utilidad contextual. | Importación inicial asistida, con procedencia y confirmación de hechos. |
| Falta recuperación de interrupciones. | Cámara, mala conexión o una llamada hacen perder el registro. | Borradores locales, sesión reanudable y sincronización visible. |
| Insights sin considerar datos incompletos. | Declarar ganadora una variedad con un único ciclo o con registros desiguales. | Mostrar tamaño de muestra, datos faltantes y métricas comparables. |

No incluiría inicialmente un catálogo botánico exhaustivo, identificación automática obligatoria, agentes autónomos, reconocimiento de cada pod desde una foto panorámica ni entrenamiento de un modelo propio. El principal riesgo es organizar mal la evidencia, no tener un modelo insuficientemente grande.

## B. Modelo de producto recomendado

| Concepto | Responsabilidad |
|---|---|
| Propietario | Identidad, idioma, zona horaria y acceso a sus datos. Sin equipos ni roles colaborativos en MVP. |
| Jardín/sistema | Equipo físico, nombre, capacidad, disposición y configuración relevante. En MVP representa también su único depósito. |
| Posición o pod | Lugar físico numerado, estable aunque quede vacío o cambie de cultivo. |
| Cultivo y variedad | Identidad estructurada, etiquetas originales y nombres localizados. La variedad puede ser desconocida. |
| Ciclo de cultivo | Una siembra/cohorte, con fechas, conteos, cierre y resultados propios. |
| Ocupación | Relación entre ciclo y posición durante un intervalo; permite conservar historia si se mueve. |
| Evento | Registro tipado de algo observado o realizado, con procedencia y fecha. |
| Fotografía | Archivo y metadatos, vinculado a uno o varios sujetos identificados. |
| Sesión de mantenimiento | Agrupa revisión y acciones sobre uno o ambos jardines. No sustituye los eventos que realmente ocurrieron. |
| Evaluación de IA | Interpretación versionada de evidencia concreta, con limitaciones y propuestas. |
| Tarea y regla de repetición | Trabajo aceptado o pendiente de aceptación, con su criterio temporal o de desarrollo. |

Una observación será un tipo de evento, con datos específicos. Una cosecha y un cambio de agua también serán eventos con sus propios campos. No crearía tres registros independientes del mismo hecho en Observation, Action y Event.

La distinción semántica se conserva: la observación del usuario es evidencia; la interpretación vive en la evaluación; la recomendación es una propuesta; la acción realizada genera un evento confirmado. Aceptar “revisar mañana” crea una tarea, no prueba que mañana se revisó.

Para estos URUQ asumiría provisionalmente un depósito por jardín. Si el equipo real difiere, se ajustará antes de cerrar el esquema. Un futuro sistema con varios depósitos justificará una entidad separada; hoy basta con no asociar el mantenimiento del agua a cada planta.

## C. Navegación e información

Propondría tres destinos principales:

- **Jardines:** inicio con los dos sistemas, atención pendiente, última revisión y acceso a sus mapas.
- **Hoy:** la cola completa de tareas, próximas revisiones y propuestas por aceptar. “Hoy” no exige abrir la app diariamente.
- **Preguntar:** Ask Garden, con contexto del jardín o ciclo desde el que se abrió.

Un botón persistente **Registrar** ofrece fotografía, observación y acciones frecuentes. Ajustes, exportación y catálogo quedan en un nivel secundario.

La jerarquía será Jardines → Jardín → Posición → Ciclo actual → Historia. Desde la posición se consultan ciclos anteriores; desde un ciclo se conserva su historia aunque haya cambiado de posición.

El mapa refleja la disposición física real, con una referencia de orientación como “lado del panel”. Tener ocho o doce pods no permite inferir automáticamente filas, distancias o numeración. Usaría dos disposiciones configuradas y una vista de lista accesible; el editor universal puede esperar.

## D. Recorridos principales

Los conteos siguientes son objetivos de diseño desde el contexto indicado. Excluyen desbloquear el teléfono, permisos iniciales, escribir, dictar y el tiempo de la cámara. Deben comprobarse en iPhone real.

| Recorrido | Secuencia propuesta | Objetivo |
|---|---|---|
| Observación rápida / AI Check | En el mapa: pod → cámara → captura → analizar → guardar observación y propuestas seleccionadas. Comentario opcional. | 4–5 decisiones; permitir guardar sin analizar. |
| Día de mantenimiento | Iniciar → elegir jardines, preseleccionados → registrar acciones del sistema → recorrido de pods → cerrar resumen. | Un toque por pod sano con avance automático. |
| Cosecha rápida | En el pod: Cosechar → guardar con fecha de hoy. Cantidad y foto opcionales. | 2 toques desde el perfil; Deshacer visible. |
| Reemplazar / resembrar | Reemplazar → revisar cierre anterior → elegir nuevo cultivo, fecha y semillas opcionales → confirmar ambos cambios. | 3–4 decisiones, más selección de cultivo. |
| Ask Garden | Preguntar desde contexto → consulta escrita o dictada → respuesta con enlaces a evidencia. | Una entrada; confirmación adicional solo si se propone escribir datos. |
| Ver crecimiento | Ciclo → fotos → seleccionar dos fechas. | 2–3 selecciones; comparación lado a lado. |

**Observación:** la foto puede guardarse aunque la IA falle. Si ya se guardó, rechazar la interpretación no borra la observación. Un resultado válido será “No aprecio cambios que requieran intervención en esta imagen”; su alcance queda claro.

**Mantenimiento:** se puede empezar por plantas o por depósito. “Omitir” y “Se ve bien” son acciones distintas. La primera no produce una evaluación saludable; la segunda registra una revisión visual del usuario. La sesión muestra revisados, omitidos y pendientes, y puede pausarse.

Registrar “cambié el agua en ambos” permite una confirmación conjunta con los dos jardines visibles. Una revisión de plantas nunca marca automáticamente agua cambiada, limpieza realizada o nutrientes añadidos. Los hechos guardados se conservan aunque la sesión no llegue a cerrarse.

**Resiembra:** cerrar un ciclo y abrir otro ocurre de manera atómica. Si se añadieron semillas junto a plantas que siguen vivas, no debe cerrarse silenciosamente el ciclo: se registra una siembra adicional, se conservan sus fechas y se marca la edad como mixta. El MVP puede representar esto con un evento de incorporación; el seguimiento separado de cada cohorte queda para después.

## E. Arquitectura de IA

### AI Check

Flujo: captura → borrador/registro → contexto autorizado → análisis → validación de respuesta → propuestas visibles → confirmación → escritura por la aplicación.

El servidor reúne la identidad confirmada, fecha de siembra con su precisión, etapa registrada, eventos pertinentes, intervenciones, incidencias abiertas y contexto del depósito. Adjunta la foto actual y, normalmente, una o dos imágenes históricas relevantes. Incluye hechos anteriores decisivos aunque no estén entre los últimos eventos.

La evaluación devuelve campos separados: hallazgos visibles, interpretación, evidencia usada, limitaciones, siguiente acción sugerida y condición o plazo para reevaluar. Cada propuesta conserva modelo, versión de instrucciones, fecha y referencias de entrada.

Usaría incertidumbre explicada: “No se ve la base del tallo; necesito otra toma”. Evitaría porcentajes de confianza sin calibración. Una imagen borrosa debe provocar abstención o una petición de evidencia, no una cadena de modelos más caros.

La salida estructurada ayuda a respetar el formato; no garantiza que el contenido sea cierto. El servidor valida referencias, permisos, campos y condiciones antes de permitir cualquier escritura. [Documentación de salidas estructuradas](https://developers.openai.com/api/docs/guides/structured-outputs).

### Ask Garden

El modelo elige entre consultas acotadas: buscar ciclo, recuperar eventos, obtener próxima tarea, comparar fechas o calcular métricas. El servidor ejecuta consultas parametrizadas y limitadas al propietario; no entrega acceso SQL libre al modelo.

Para “¿cuándo fue el último aclareo?”, la fecha viene de una consulta exacta. Para “¿puedo cosechar?”, separa registros, evaluación visual y conocimiento general. Si faltan datos, responde qué no consta. Las respuestas enlazan eventos y fotografías verificables dentro de la app.

El historial del chat permite entender “esa planta”, pero se vuelve a consultar la base de datos para responder hechos. Una corrección posterior invalida el contexto cacheado pertinente. Las evaluaciones antiguas quedan visibles como históricas, con aviso cuando su evidencia fue corregida.

Las notas importadas, comentarios y contenido de imágenes se tratan como datos, nunca como instrucciones que puedan ampliar permisos. La confirmación incluye los valores concretos a guardar. Si el ciclo cambió mientras la IA respondía, se vuelve a validar la propuesta antes de aplicarla.

No hace falta una base vectorial en el MVP. Las relaciones, fechas y búsqueda de texto son suficientes para empezar. Para consejos generales propondría un pequeño conjunto curado de referencias de cultivo y manuales del equipo, con fuente y versión; separado del historial personal. La búsqueda externa no se ejecutará en cada pregunta ni creará hechos del jardín.

### Evaluación y control de costos

Comparar los modelos con unas 30–50 situaciones representativas, preferiblemente con fotos reales: planta aparentemente normal, imagen insuficiente, identidad corregida, fecha desconocida, múltiples plántulas, comparación de fotos y mantenimiento no confirmado. Este tamaño es una prueba inicial, no una certificación estadística.

Medir fidelidad histórica, alarmas innecesarias, capacidad de abstenerse, utilidad de la propuesta, latencia y costo total por resultado aceptable. Cualquier escritura sin autorización o invención de una fecha confirmada bloquea la liberación hasta corregirse.

Las limitaciones de visión deben formar parte del contrato del producto: una foto no ofrece medidas exactas por sí sola ni sustituye evidencia ausente. [Guía de imágenes y visión](https://developers.openai.com/api/docs/guides/images-vision).

## F. Datos e integridad histórica

Recomiendo un modelo relacional con historial que añade revisiones, no event sourcing completo. Tendrá registros actuales fáciles de consultar y eventos/versiones para conservar su procedencia.

Familias de tablas propuestas: propietarios; jardines; posiciones; cultivos/variedades/nombres; ciclos; ocupaciones; eventos; fotos y vínculos; sesiones y revisiones de pods; evaluaciones de IA; tareas y reglas. Los tipos frecuentes tendrán campos validados y unidades; un contenido JSON versionado permite extender eventos sin convertir todo en texto libre.

Cada evento incluye identidad, sujeto, tipo, cuándo ocurrió, cuándo se registró, autor/origen y, si corresponde, sesión, evento corregido y motivo de invalidación. Las relaciones entre jardín, ciclo y propietario deben ser coherentes en la base de datos.

| Clase de información | Tratamiento |
|---|---|
| Identidades de posiciones, ciclos y eventos | Permanentes. |
| Evidencia confirmada y evaluaciones emitidas | No sobrescribir su contenido original; corregir o invalidar con registro enlazado. |
| Nombre del jardín y preferencias de interfaz | Editables. |
| Identidad de cultivo o fecha de siembra confirmada | Corrección auditada; actualiza la vista vigente conservando el valor anterior. |
| Borradores no confirmados | Editables y descartables. |
| Edad, última cosecha, días desde mantenimiento | Calculados desde los hechos vigentes. |
| Próxima fecha esperada | Derivada de una regla; nunca una acción histórica. |
| Salud o preparación para cosechar inferidas | Evaluación con fuente y fecha; no un hecho permanente. |

Las fechas permiten valor exacto, aproximado, intervalo o desconocido. Se distingue fecha de captura, de observación y de carga. Una fecha de siembra sin hora no debe convertirse artificialmente en una hora UTC que cambie el día mostrado.

Restricciones clave: una posición no admite ocupaciones activas incompatibles; un mismo ciclo no ocupa simultáneamente dos posiciones salvo soporte explícito futuro; reintentar una operación no duplica la cosecha; una corrección no desaparece del historial; cerrar un ciclo cancela sus tareas abiertas que ya no correspondan.

Para eventos erróneos usaría invalidación visible y Deshacer. Las fotos podrán eliminarse de verdad por privacidad o decisión del usuario: el historial conserva una referencia de eliminación, no una copia oculta indefinida. Las evaluaciones basadas en esa evidencia se marcan como evidencia no disponible.

### Incorporación de tus datos actuales

Crear un borrador con los jardines URUQ de 8 y 12 posiciones, fechas de inicio y la lista proporcionada para el segundo. Confirmar qué datos del brief representan hechos reales y cuáles son ejemplos. No asumir que todos los ciclos del segundo jardín comenzaron el 24 de agosto, ni usar el 31 de julio como fecha de cada planta del primero.

Conservar “6+ semillas” como mínimo conocido con límite superior desconocido. Un campo vacío significa desconocido, nunca cero. El nombre comercial original permanece aunque aún no se haya resuelto especie o variedad.

Importar el Control V2 y conversaciones relevantes a una zona de revisión: detectar candidatos, señalar contradicciones y aprobar hechos en grupos claros. El texto “deberías cambiar el agua” nunca se importa como “agua cambiada”. La importación debe poder repetirse sin duplicar registros.

## G. Fotografías

Guardar archivos privados en almacenamiento de objetos; en Postgres, metadatos y relaciones. Una foto de jardín puede vincular varios ciclos identificados, sin duplicar el archivo ni adivinar a cuáles pertenece.

Metadatos mínimos: propietario, identificador, archivo, dimensiones, formato, fecha de captura y precisión, fecha de carga, orientación normalizada, sujetos y hash. Opcionales: vista general/detalle y encuadre comparable.

Propuesta inicial: una imagen maestra de buena calidad con metadatos sensibles retirados, una versión de visualización y miniaturas. Probaría maestros de 2.000–3.000 píxeles de lado mayor y miniaturas de 320–480, ajustando tras comprobar detalles de hojas y tallos. Estos tamaños son candidatos, no especificaciones cerradas.

La ruta de carga debe aceptar las fotos reales del iPhone, incluyendo pruebas de HEIC y orientación. Evitar compresión repetida y cambios de color artificiales. Separar la resolución del archivo guardado de la imagen o recorte enviado a la IA. No generar una imagen “mejorada” que se confunda con evidencia original.

Carga con estados pendiente/subiendo/lista/error; reintentos idempotentes; limpieza de archivos huérfanos. Un borrador no se presenta como respaldado hasta confirmar la sincronización.

La comparación MVP será manual y lado a lado, mostrando fechas y diferencias de encuadre. Un porcentaje de crecimiento exige escala o medición comparable. Para timelapse futuro bastan fechas, asociación al ciclo y transformaciones visuales no destructivas; no hace falta generar videos ahora.

## H. Motor de tareas

| Dimensión | Valores o comportamiento |
|---|---|
| Origen | Usuario, regla de calendario, regla de desarrollo o IA. |
| Aceptación | Propuesta pendiente, aceptada o rechazada. |
| Estado de tarea aceptada | Abierta, completada o descartada. |
| Momento | Fecha, ventana, condición de desarrollo o sin fecha. |
| Presentación temporal | Próxima, para ahora o atrasada; calculada. |
| Revaluación | Un tipo de tarea con condición y, opcionalmente, recordatorio. |
| Posposición | Cambia la próxima revisión, conservando el cambio en el historial. |

“Evaluar aclareo” puede estar pendiente sin una fecha inventada. “Revisar dentro de tres días” es una ventana sugerida, no la predicción de que el problema se resolverá entonces.

Una recurrencia distingue **cada 14 días desde la última acción real** de **martes alternos anclados a una fecha**. La primera se desplaza si haces mantenimiento tarde; la segunda conserva el calendario. Recomiendo el segundo esquema para tu coordinación de ambos jardines, mostrando por separado días desde el último cambio de cada uno. Hay que elegir el martes de referencia.

Completar una tarea puede registrar una acción en la misma transacción: “Hecho: cambié el agua”. Descartarla no registra mantenimiento. “Sigue sin estar listo” registra una reevaluación y deja una próxima revisión explícita.

Deduplicar por sujeto, propósito y ventana: una nueva evaluación actualiza o se vincula a una tarea pertinente, no crea diez recordatorios iguales. Al resembrar se revisan las tareas del ciclo anterior. Las notificaciones push pueden esperar; Hoy debe funcionar sin permisos de notificación.

## I. MVP que pueda reemplazar ChatGPT

Incluye: acceso privado; tus dos mapas; ciclos con historia; carga inicial revisada; fotos; observaciones; acciones rápidas; tareas; sesión guiada reanudable; AI Check; Ask Garden con referencias; comparación fotográfica básica; exportación; respaldo y recuperación probados.

La voz inicial será dictado del teclado donde esté disponible, con edición antes de guardar. La grabación y transcripción integradas pueden esperar. El resumen del mantenimiento se construye con datos y plantillas; la redacción de IA será opcional.

El soporte sin conexión del MVP conserva borradores de observaciones, fotografías y acciones simples; permite consultar información recientemente sincronizada. Las operaciones estructurales, como reemplazar un ciclo, exigirán conexión al guardar. Así se reduce el riesgo de conflictos sin perder la captura frente al jardín.

Criterios de aceptación del MVP:

- Registrar una cosecha en dos toques desde el perfil, sin cantidad obligatoria.
- Revisar un pod sano con un toque y continuar; no marcar como revisado un pod omitido.
- Conservar una observación si falla el análisis o se interrumpe la conexión.
- Reemplazar un cultivo sin perder sus fotos, cosechas ni fechas anteriores.
- Obtener en Ask Garden la última intervención con enlace a un registro real, o “no consta”.
- Corregir una fecha y ver la edad recalculada, conservando la corrección.
- Reintentar una acción sin duplicarla.
- Validar aislamiento de datos y fotos con pruebas de acceso no autorizado.
- Restaurar una muestra de base de datos y fotografías desde el respaldo.
- Ejecutar una sesión completa en tu iPhone frente a los jardines antes de abandonar el flujo anterior.

## J. Roadmap

| Etapa | Entrega | Condición para avanzar |
|---|---|---|
| Diseño previo | Contrato del producto, datos, flujos, modelos y criterios de aceptación. | Revisión y aprobación del alcance. |
| MVP operativo | Todo lo definido en I; los dos jardines y su historia útil. | Validación real de observación, mantenimiento y consulta. |
| V1 | Mejoras detectadas en uso, notificaciones optativas, captura por voz integrada si aporta valor, comparaciones y exportación refinadas. | Evidencia de fricción o necesidad. |
| V2 | Insights por ciclo/variedad, resultados de intervenciones, condiciones históricas y comparaciones con muestras suficientes. | Datos con cobertura y calidad adecuadas. |
| Futuro | Timelapse, sensores, disposiciones configurables, múltiples usuarios, experimentos más completos. | Beneficio concreto que justifique costo y mantenimiento. |

La primera versión no necesita predecir cuál variedad es mejor. Sí necesita conservar fecha de inicio, primera cosecha cuando conste, cierres y esfuerzo registrado para poder responderlo después. “Primera cosecha registrada” no se presenta como primera cosecha real si el registro empezó tarde.

## K. Recomendación técnica

**Frontend:** React + TypeScript + Vite. Mi elección se basa en una app privada e interactiva sin necesidad inicial de posicionamiento público. Un frontend estático mantiene flexible el alojamiento; Vite documenta ese despliegue. Next.js es una alternativa razonable si necesitamos una capa de servidor unificada, pero ese beneficio debe justificar la complejidad adicional. [Despliegue estático de Vite](https://vite.dev/guide/static-deploy.html).

**PWA:** manifiesto, instalación, shell cacheado, actualizaciones controladas y borradores en IndexedDB. Sincronizar al abrir o recuperar conectividad con la app activa, con reintento visible. No depender de sincronización en segundo plano para preservar registros: su disponibilidad entre navegadores es limitada. El almacenamiento local tampoco equivale a respaldo. [Background Synchronization API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API).

**Backend:** Supabase gestionado es mi opción inicial por reunir Postgres, autenticación y archivos. Frente a Postgres + autenticación + almacenamiento contratados por separado, reduce integración. Autoalojarlo añade responsabilidad operativa; poseer hosting no obliga a hacerlo. Propondría proyecto propio para Garden y sin Realtime inicialmente.

**Seguridad:** una cuenta inicial creada de forma controlada y registro público deshabilitado. Autenticación no sustituye autorización: políticas por propietario en tablas y archivos, buckets privados y enlaces temporales. Claves de IA y credenciales privilegiadas solo en servidor. Las políticas deben cubrir lecturas, inserciones y cambios de propietario; probar acceso cruzado. [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) y [acceso a Storage](https://supabase.com/docs/guides/storage/security/access-control).

**Servidor de aplicación:** operaciones de dominio transaccionales y un punto de integración de IA que verifica sesión, recupera contexto y valida propuestas. Funciones del backend o del hosting son alternativas; elegir una sola capa inicial según límites de ejecución y compatibilidad de imágenes. La clave nunca viaja en el frontend.

**Hosting:** garden.getstreex.com como destino propuesto. Primero comprobar proveedor actual, DNS, HTTPS, rutas de la PWA y posibilidad de ejecutar el servidor. El documento no presupone que el alojamiento existente cubra esas capacidades ni autoriza despliegue.

**Backups:** política inicial propuesta de respaldo diario de datos y copia separada de fotografías, fuera del proyecto principal; definir retención y probar restauración antes de producción. Los respaldos de base de datos de Supabase no incluyen los objetos de Storage. Objetivo inicial a aprobar: pérdida máxima de un día de registros ya sincronizados. [Backups de Supabase](https://supabase.com/docs/guides/platform/backups).

**Costos:** separar alojamiento, base de datos, archivos/transferencia, correo de autenticación y llamadas de IA. No fijaría hoy un total mensual sin conocer planes existentes y frecuencia de fotos/análisis. Añadiría métricas por operación, límites de gasto de aplicación y un modo de registro plenamente funcional cuando la IA no esté disponible.

## L. Concepto UX

**Inicio:** fotografías recientes de ambos jardines, con fecha visible, nombres y una frase útil: “Dos revisiones pendientes”. Estados vacíos claros; si no hay incidencias, no fabricar rojo. Lo desconocido se representa de forma neutra.

**Jardín:** mapa orientado al equipo real, posiciones grandes y acceso inmediato al cultivo. Información del depósito agrupada: último cambio registrado, próxima sesión prevista y últimas mediciones si existen. No mostrar un medidor ficticio de nutrientes.

**Ciclo:** fotografía protagonista, nombre en inglés con nombre común latinoamericano debajo o entre paréntesis, edad si se conoce y próxima acción. El historial, semillas, aclareos y detalles quedan al desplegar. Conservar el cultivar original y nombres científicos solo cuando estén establecidos.

**AI Check:** foto, comentario y respuesta breve. Primero qué se observa; después qué conviene hacer y qué no se puede concluir. Los cambios propuestos tienen controles de aceptación independientes.

**Mantenimiento:** progreso acumulado, acciones del sistema visibles y navegación que se pueda retomar. No forzar una foto por pod. Un resumen final separa realizado, observado, omitido y pendiente.

**Control V2:** conservarlo como vista compacta de consulta/exportación, especialmente en escritorio. En móvil sus columnas se distribuyen entre mapa, ficha y Hoy. El semáforo debe acompañarse de texto o icono, no depender solo del color. Sin revisión reciente, mostrar “última revisión: …”, no degradar automáticamente a una alarma.

## M. Riesgos y decisiones abiertas

| Decisión | Propuesta inicial | Cuándo resolver |
|---|---|---|
| Disposición y numeración física | Dos mapas basados en los equipos reales. | Antes de aprobar el diseño del mapa. |
| Fechas y plantas iniciales | Confirmar por ciclo; conservar desconocidos. | Antes de importar. |
| Historial de ChatGPT | Importación asistida y revisada, sin exigir un importador universal. | Antes de sustituir el flujo actual. |
| Calendario quincenal | Martes alternos con un ancla elegida y hechos independientes por jardín. | Antes de activar recurrencias. |
| Depósitos y configuración | Confirmar volumen de trabajo, producto nutritivo y ajustes relevantes; no exigir mediciones que no haces. | Antes de reglas de mantenimiento o recomendaciones de dosificación. |
| Fotos fuera del dispositivo | Almacenamiento privado y envío a IA para las evaluaciones solicitadas. Precisar retención. | Antes de integrar análisis y producción. |
| Infraestructura y presupuesto | Revisar hosting existente y acordar límite mensual. | Antes de contratar o desplegar. |
| Calidad visual y funcionamiento sin conexión | Piloto de cámara, carga, borradores y comparación en iPhone. | Al inicio de implementación, después de aprobarla. |

Además, hay que evitar conclusiones causales a partir de dos jardines con condiciones compartidas, o tasas de supervivencia con denominadores desconocidos. Cantidades “ligera/media/abundante” no deben convertirse en gramos. Cada insight mostrará cobertura y limitaciones.

## N. Qué haría diferente desde cero

Diseñaría el producto alrededor de **cambios y decisiones**, y daría a la fotografía y al registro el mismo acceso rápido. Ver una planta, registrar una cosecha o preguntar algo son entradas equivalentes.

1. **“Desde la última vez”** como resumen principal: novedades registradas, asuntos abiertos y cosechas recientes. No exige una rutina diaria ni vuelve a mostrar todo el historial.
2. **Seguimiento de resultados:** una recomendación aceptada puede preguntarte después “¿mejoró, sigue igual o empeoró?”. Esto construye evidencia sobre utilidad, sin confundir que aceptaste la sugerencia con que funcionó.
3. **Edad de la evidencia:** acompañar cada conclusión con cuándo se observó. Es más honesto y útil que un número de salud.
4. **Confirmación compuesta:** “Coseché albahaca de los pods 1 y 4 y rellené ambos depósitos” produce una sola vista revisable con acciones y destinos separados. Incorporarlo cuando el registro simple ya sea confiable.
5. **Fotografía comparable asistida:** guía opcional de encuadre o superposición de una foto anterior. Aumentar la calidad de la evidencia puede aportar más que subir siempre de modelo.
6. **Memoria de decisiones del usuario:** registrar por qué mantuviste una planta o descartaste una sugerencia, cuando quieras añadirlo. Sirve para personalizar futuras propuestas, sin entrenamiento propio.

Priorizaría “Desde la última vez” y evidencia fechada en MVP; probaría las demás ideas después. No todas las buenas ideas deben convertirse en alcance inicial.

## Plan de ejecución y asignación de modelos

La política será usar el modelo de menor costo que supere los criterios de calidad de la tarea. Las asignaciones son mi recomendación de partida; no equivalen a una prueba de rendimiento ya realizada. Distingo el costo de trabajar en Codex del costo de la API usada por la aplicación.

### Modelos para construir el producto, después de aprobación

| Tarea | Modelo inicial y esfuerzo | Cuándo escalar o revisar |
|---|---|---|
| Cerrar arquitectura y alcance | GPT-5.6 Sol, alto | GPT-6 Astra solo ante una ambigüedad importante que Sol no resuelva satisfactoriamente. |
| Inventariar datos e identificar candidatos de importación | GPT-5.6 Luna, bajo | Terra si aparecen contradicciones; los hechos los confirma el usuario. |
| Diseñar flujos y jerarquía visual | GPT-5.6 Terra, medio | Sol si persiste fricción o conflicto entre requisitos. |
| Definir ciclos, revisiones y contratos de datos | GPT-5.6 Terra, alto | Revisión focalizada de Sol sobre integridad, fechas y reemplazos. |
| Implementar acceso, permisos y operaciones transaccionales | GPT-5.6 Terra, alto | Revisión de Sol en las fronteras de seguridad y consistencia. |
| Construir componentes a partir del diseño aprobado | GPT-5.6 Luna, medio | Terra para estado compartido, accesibilidad compleja o integración. |
| Implementar PWA, cámara, fotos y borradores | GPT-5.6 Terra, medio | Sol si hay fallos persistentes de ciclo de vida o concurrencia. |
| Implementar tareas y mantenimiento | GPT-5.6 Terra, medio | Sol ante casos temporales o transacciones no resueltos. |
| Integrar AI Check y Ask Garden | GPT-5.6 Terra, alto | Sol para evaluar límites de evidencia y confirmaciones. |
| Ejecutar casos de prueba y clasificar resultados | GPT-5.6 Luna, medio | Terra para investigar fallos; revisión humana del criterio visual/botánico. |
| Revisión final de riesgos y liberación | GPT-5.6 Sol, alto, acotada | Astra únicamente si queda un problema difícil sin resolver. |
| Documentación, textos y ajustes simples | GPT-5.6 Luna, bajo | Terra cuando cambie una regla de producto. |

Esta distribución aplica la orientación oficial de Luna para tareas claras y repetibles, Terra para trabajo cotidiano y Sol para tareas complejas. No propone que cada tarea pase por todos los modelos ni revisiones completas duplicadas. [Modelos y esfuerzo de razonamiento en Codex](https://learn.chatgpt.com/docs/models).

Orden de trabajo: contrato aprobado → prueba temprana de cámara y recuperación → base de datos y acceso → registro y ciclos → tareas/mantenimiento → IA → importación revisada → QA real y respaldo → despliegue aprobado. Así se prueban pronto las restricciones del teléfono y la IA se conecta a hechos ya fiables.

### Modelos dentro de la aplicación

| Función | Elección inicial | Motivo y control |
|---|---|---|
| Edad, calendario, última acción, filtros, métricas | Sin LLM | Cálculos y consultas deterministas. |
| Guardar cosecha, revisión o foto | Sin LLM | El usuario ya expresó una acción estructurada. |
| Resumen básico de mantenimiento | Sin LLM | Plantilla derivada de eventos reales. |
| Convertir una nota en propuestas | GPT-5.6 Luna | Extracción acotada, validada y confirmada. |
| Ask Garden factual | Consulta exacta; Luna cuando haga falta interpretar o redactar | Evitar razonamiento costoso para recuperar una fecha. |
| AI Check fotográfico | GPT-5.6 Terra durante el piloto | Priorizar calidad visual; evaluar si Luna alcanza el mismo nivel en casos rutinarios. |
| Comparación visual o consulta compleja | GPT-5.6 Terra | Selección de imágenes y evidencia pertinente. |
| Caso complejo con evidencia suficiente | GPT-5.6 Sol, excepcional | Solo si aporta mejora medida frente a Terra. |
| Imagen insuficiente o dato inexistente | Sin escalada automática | Solicitar evidencia o declarar desconocimiento. |
| Entrada por voz inicial | Dictado del dispositivo cuando esté disponible | No añadir llamadas propias de transcripción al MVP. |

Luna, Terra y Sol admiten imágenes de entrada; eso no demuestra por sí mismo precisión para tus plantas. La elección final de AI Check depende del piloto. [Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra), [Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol).

### Presupuesto y disciplina de tokens

Precios de texto consultados el 6 de septiembre de 2026, USD por millón de tokens, entrada sin caché y salida:

| Modelo de API | Entrada | Salida |
|---|---:|---:|
| GPT-5.6 Luna | 0,20 | 1,20 |
| GPT-5.6 Terra | 2,00 | 12,00 |
| GPT-5.6 Sol | 4,00 | 20,00 |

Fuentes: páginas oficiales de [Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra) y [Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol). Las tarifas pueden cambiar; Sol tiene precio promocional según su documentación. Estos valores no convierten ni estiman tus créditos de Codex.

Ejemplo aritmético, no presupuesto del producto: 200 llamadas exclusivamente de texto, cada una con 4.000 tokens de entrada y 500 tokens totales facturables de salida, costarían aproximadamente USD 0,28 con Luna, USD 2,80 con Terra o USD 5,20 con Sol a esas tarifas. Fotografías, razonamiento adicional, herramientas, reintentos e infraestructura pueden aumentar el costo real.

Reducir consumo mediante contexto pertinente y acotado, respuestas breves, pocas imágenes bien elegidas, caché ligada a la versión de los datos y ausencia de análisis automáticos al abrir pantallas. Medir el gasto real de cada operación. Un modelo barato que obliga a repetir la tarea puede salir más caro.

La política recomendada queda documentada aquí. No se han cambiado los modelos de esta tarea ni creado agentes, tareas adicionales o llamadas de IA del producto.
