# Phase 1 — Decisiones técnicas

## Base y límites

- La aplicación usa React, TypeScript, Vite y PWA. No incluye IA, Ask Garden, la cola completa de atención, Insights ni Realtime.
- La navegación implementada es Jardines → Jardín → Posición → Ciclo actual → Observación/foto → Historial.
- La orientación empezó como una lista numérica provisional. Phase 20 la reemplaza por mapas físicos configurables sin cambiar los identificadores de posición.

## Datos y seguridad

- `garden` es un esquema privado. Las tablas no se exponen a la Data API; la aplicación invoca sólo funciones RPC explícitas en `public`.
- Cada RPC valida `auth.uid()` y se ejecuta con una lista mínima de permisos. Las funciones `SECURITY DEFINER` definen `search_path` vacío, revocan `EXECUTE` a `PUBLIC` y se conceden únicamente a `authenticated` porque las escrituras compuestas requieren transacción y no se concedió acceso directo a tablas del dominio.
- La migración modela propietarios, jardines, posiciones, cultivos, ciclos, ocupaciones, eventos, fotos y recibos idempotentes. Los índices parciales garantizan como máximo una ocupación vigente por posición y por ciclo.
- Los originales van al bucket privado `garden-originals`, con prefijo obligatorio `{owner_id}/{photo_id}/`. La aplicación no usa claves `service_role` ni expone secretos.

## Fotografía y borradores

- La foto se registra primero como evidencia pendiente y sólo pasa a `uploaded` tras completar Storage y confirmar el acuse de la base. Un error nunca se presenta como éxito remoto.
- El navegador no puede afirmar una fecha de captura confiable desde un archivo seleccionado; por eso esta etapa guarda `captured_at` como desconocida, preserva nombre, tipo y tamaño originales y deja la extracción de EXIF para una etapa posterior.
- IndexedDB `streex-garden` versión 1 conserva borradores de observación y su `Blob` de foto. La máquina de estados es `draft → queued → syncing → synced`, con `retryable_error` y `needs_review`; por ahora se sincroniza al pulsar reintentar desde el ciclo, no mediante ejecución en segundo plano.
- Durante la validación en dispositivo apareció una incompatibilidad de multipart del adaptador de Storage con capturas móviles. La carga usa por ello bytes originales mediante `fetch` autenticado con JWT a la API oficial de Storage; conserva bucket privado, prefijo por propietario y RLS. No transforma ni recomprime la imagen.
- Si una observación ya existe pero su foto queda pendiente, cualquier navegador autenticado puede recuperar **el mismo original**. Se compara tipo MIME y tamaño con la metadata inmutable antes de completar la carga, por lo que no se asocia silenciosamente una foto distinta.

## Producto y UX

- “Desde la última vez” y “Atención” se muestran como superficies separadas. La cola todavía no calcula ni marca tareas, para no simular el sistema futuro.
- Preparación para cosecha usa exclusivamente las claves y textos aprobados: `not_yet`/Todavía no, `evaluate`/Evaluar, `ready`/Lista y `not_applicable`/No aplica.
- Los mensajes críticos expresan texto e iconografía además de color. Los controles principales mantienen una altura táctil mínima de 44 px.

## Configuración pendiente

El proyecto gestionado de Streex Garden está separado en Streex Labs. Sus credenciales de navegador viven únicamente en `.env.local`, que no se versiona. Las migraciones de Phase 1 se aplicaron manualmente mediante SQL Editor porque la conexión de Codex no tiene permisos administrativos en esa organización; el código fuente de migraciones sigue siendo el historial canónico que deberá incorporarse a CI/CD antes de cualquier despliegue.

## Phase 2 — Dispositivo, originales y PWA

- El conjunto admitido de originales incorpora `image/heif` además de JPEG, PNG, HEIC y WebP. Cuando iPhone no entrega un tipo MIME pero conserva extensión, la aplicación reconoce de manera explícita las extensiones admitidas; no deriva el formato de un nombre ausente.
- Cada foto nueva calcula SHA-256 antes de crear su evidencia pendiente. La base guarda esa huella de manera inmutable y exige coincidencia al confirmar el objeto en Storage. La recuperación sólo completa un archivo cuyo tipo, tamaño y huella son idénticos. Una foto pendiente heredada sin huella no se recupera automáticamente: se registra el original de nuevo para impedir una asociación equivocada. Las fotos ya cargadas no se modifican.
- La migración `20260907053200_phase2_photo_integrity_heif.sql` amplía el tipo permitido de la tabla y bucket, añade la restricción de formato SHA-256 y redefine los RPC de observación/confirmación/lectura con los permisos mínimos existentes.
- Antes de cualquier intento remoto, la observación y su `Blob` se persisten en IndexedDB. Un fallo, recarga o desconexión conserva un borrador con reintento explícito; al sincronizar correctamente se elimina sólo ese borrador.
- El API Web Crypto necesario para SHA-256 requiere HTTPS en Safari. Para validación local se creó un certificado de desarrollo de 30 días bajo `.dev-cert/`, excluido de Git, y se comprobó la PWA en iPhone mediante HTTPS local. No es infraestructura de producción ni equivale a un despliegue.

### Evidencia manual

- iPhone/Safari: una fotografía nueva y una nota se cargaron bajo HTTPS local, aparecieron como archivo guardado en historial y persistieron tras recarga. Safari puede convertir un activo HEIC de Fototeca a JPEG antes de entregarlo a una web; la aplicación conserva exactamente los bytes que recibe, pero no lo representa como el original de Fototeca.
- iPhone/Safari: un archivo HEIC guardado primero en Archivos se seleccionó sin conversión y quedó identificado como `Archivo guardado · HEIC` en el historial.
- iPhone/Safari: en modo avión, una observación con fotografía quedó visible como pendiente; al recuperar conectividad y usar el reintento, apareció en historial y sobrevivió la recarga.
- iPhone/Safari: la aplicación se añadió a pantalla de inicio y abrió conservando sesión e historial.

## Phase 3 — Dominio, acceso e historia

- Los ciclos usan exclusivamente `active` y `closed`, con una revisión monotónica. Cerrar, reemplazar, mover, corregir siembra y reabrir requieren la revisión esperada; un conflicto no aplica una parte de la operación.
- Reemplazo cierra la ocupación y ciclo anterior, registra su auditoría y crea un ciclo/ocupación/evento de inicio nuevos en la misma transacción. Fotos y eventos del ciclo previo no se reasignan. El traslado sólo permite una posición vacía del mismo jardín.
- `cycle_revisions` y `event_revisions` conservan correcciones e invalidaciones. Las vistas corrientes omiten eventos invalidados, mientras que las revisiones permanecen aisladas por propietario mediante RLS.
- Cada comando nuevo guarda un payload canónico junto con su recibo. Repetir la misma intención devuelve el resultado original; reutilizar su ID con contenido distinto se rechaza. Los recibos heredados sin payload siguen siendo reproducibles por compatibilidad, pero no pueden compararse retrospectivamente.
- Una corrección posterior `20260907061404_phase3_deterministic_occupancy_order.sql` fija el orden determinista de posiciones históricas cuando varias operaciones comparten un mismo timestamp de transacción.
- Los comandos no tienen todavía controles de producto: su interfaz pertenece a la siguiente fase de UX. No se expone acceso directo a tablas privadas.

### Evidencia manual y transaccional

- Lectura real del ciclo Cebollín, incluido historial y fotos, correcta tras la migración.
- Consulta estructural remota: 6 comandos de ciclo, 2 políticas RLS de revisiones, payload de idempotencia y 6 permisos autenticados presentes.
- Prueba remota con `ROLLBACK`: reemplazo atómico, corrección auditada, invalidación auditada, rechazo de intención con contenido distinto, bloqueo de reapertura ante sucesor y lectura de ciclo histórico, todos verificados sin persistir datos.

## Phase 4 — Acciones de ciclo e historial visible

- La vista de ciclo expone acciones compuestas mediante RPC explícitas: cosechar, cerrar, reemplazar/resembrar, trasladar, corregir siembra, reabrir e invalidar un evento seleccionado. Cada acción conserva la revisión esperada y muestra los conflictos del servidor sin aplicar cambios parciales.
- Las acciones no se ofrecen como operaciones offline: si no hay conectividad, la interfaz informa que debe reintentarse cuando el servidor esté disponible. Las observaciones y fotos mantienen su flujo offline independiente.
- Garden Detail muestra siempre el bloque `Historial de esta posición`, incluido el estado vacío. Los ciclos anteriores enlazan a su propia vista y nunca reutilizan el ciclo activo.
- El mapa URUQ se incorporó inicialmente como lista provisional. La orientación física confirmada y el editor de sistemas se documentan en Phase 20.
- La PWA usa registro explícito desde React (`virtual:pwa-register/react`) con actualización confirmada por el usuario. Cuando existe un nuevo service worker aparece un aviso accesible con el botón `Actualizar`, evitando que una instalación conserve silenciosamente una interfaz antigua.

### Evidencia manual

- iPhone/PWA: tras actualizar la instalación, `Jardín → Posición 7` muestra `Historial de esta posición` y su estado vacío o sus ciclos anteriores sin ocultar el acceso.
- Las comprobaciones locales posteriores a este ajuste pasan: typecheck, 5 tests, lint, build de producción y `git diff --check`.

## Phase 5 — Sincronización y recuperación de fotografías

- Un borrador se persiste primero con estado `queued`, incluso cuando hay conexión. El editor se libera después de esa persistencia local, por lo que una interrupción tras pulsar Guardar no invita a enviar una segunda intención con otro ID.
- La sincronización usa el mismo `request_id` del borrador y procesa una observación a la vez. Al abrir un ciclo con borradores pendientes, al recuperar conectividad, al restaurar la página o al volver a primer plano intenta completar los registros reintentables; no depende de Background Sync. Los últimos dos disparadores cubren la suspensión de PWA en Safari, que no siempre emite `online` al reanudar.
- Los fallos de red o Storage conservan `retryable_error` y permiten reintento. Un ciclo ausente/cerrado o un conflicto de revisión pasa a `needs_review` y queda excluido de reintentos automáticos, para no reasignar evidencia ni repetir una escritura incompatible.
- La recuperación de un original pendiente reconoce el tipo por extensión cuando iPhone entrega `File.type` vacío, manteniendo la comprobación de tipo, tamaño y SHA-256 antes de enviar bytes.
- IndexedDB usa versión 2. La apertura conserva los borradores existentes y vuelve a crear `observation-drafts` si una instalación antigua hubiera quedado sin ese store; la transacción informa su fallo sin dejar una base abierta. El selector de recuperación se limpia antes de actualizar el historial para no manipular un control ya desmontado por React/Safari.
- Los borradores nuevos conservan una copia `Blob` del original, en vez de mantener el `File` temporal de la cámara. Para un borrador histórico que Safari no pueda reabrir, la vista de sincronización permite elegir de nuevo el mismo original; tipo, tamaño y checksum remoto deben coincidir antes de confirmar la evidencia.
- Un borrador no se elimina tras recibir solo el acuse de escritura: la app vuelve a leer el ciclo y exige que aparezca el `event_id` exacto y, si había foto, que su estado sea `uploaded`. Si cualquiera de esas condiciones falla, conserva el borrador para recuperación.
- Las evidencias pendientes históricas sin SHA-256 se conservan como tales, pero ya no ofrecen un selector que inevitablemente fallará. La UI explica que se debe registrar de nuevo el original para evitar vincular una imagen distinta a un hecho previo.
- El límite inicial aprobado para originales nuevos es 30 MB. La migración `20260907115658_phase5_photo_sync_limit.sql` actualiza el bucket y añade el límite a `garden.photos`. La restricción se instala como `NOT VALID`: conserva metadatos históricos por encima del límite previo, pero rechaza toda escritura nueva que lo exceda.

### Evidencia pendiente de ejecución remota

- La migración Phase 5 fue aplicada al proyecto de Supabase.
- iPhone/PWA: el historial muestra ocho eventos, incluidas dos fotos nuevas confirmadas (`IMG_3984.HEIC` y `IMG_3984.jpeg`) en el orden correcto. La consulta de proyección del ciclo y la interfaz muestran la misma colección.

## Phase 6 — Galería y comparación manual

- La galería usa exclusivamente fotos con estado `uploaded`; las pendientes permanecen visibles en historial pero no pueden sostener una comparación.
- La selección está limitada a exactamente dos originales distintos. Elegir una tercera foto no desplaza silenciosamente una de las ya elegidas; se debe deseleccionar primero.
- La comparación conserva en cada columna la fecha de captura y su precisión, la fecha de registro, el nombre de archivo y el sujeto del ciclo. Una fecha de captura desconocida se expresa como tal y nunca se reemplaza por la fecha de registro.
- Esta primera comparación ocurre dentro de un ciclo explícito, por lo que rotula `Mismo ciclo` y no inventa mediciones, porcentaje de crecimiento ni transformaciones de los originales.

### Evidencia manual

- iPhone/PWA: desde `Comparar fotos`, dos originales confirmados se muestran lado a lado. Sus fechas de captura desconocida y registro permanecen visibles en ambas columnas.

## Phase 7 — Desde la última vez y Atención

- Home separa dos lecturas canónicas: **Desde la última vez** responde a cambios confirmados desde el checkpoint de la visita, mientras que **Atención** muestra exclusivamente pendientes abiertos actuales. Un cambio reciente puede enlazar la misma entidad que una futura tarea, pero el resumen no crea ni completa tareas.
- La visita se abre sólo al consultar Jardines y es compartida por todos los dispositivos del propietario. Su base (`base_cursor`) permanece inmutable durante el intervalo activo; la misma visita se reutiliza hasta que transcurre el valor de configuración correspondiente desde el último acceso a Jardines.
- `since_last_time_visit_gap_minutes` vive en `garden.owner_settings`, con valor inicial de producto de 30 minutos, validado como positivo. Cada visita conserva tanto el valor como la versión de configuración con que abrió; no existe una constante equivalente en el cliente ni una regla biológica.
- `owner_change_log` conserva un cursor monotónico generado por base de datos y registra eventos nuevos, correcciones y cambios de atención confirmados. La instantánea incluye sólo el intervalo `(B.cursor, H.cursor]`; no usa reloj de dispositivo ni identificadores reservados antes de una transacción.
- El cliente acusa `H` solamente después de que la interfaz pudo encolar su render. Ese acuse avanza el checkpoint del propietario de forma monotónica. Un error de carga o una instantánea local offline no lo acusa ni consume novedades.
- En modo sin conexión, Jardines puede mostrar la última instantánea local con su fecha explícita. Se diferencia de los borradores de observación y se recupera el intervalo remoto al reconectar.
- `attention_items` establece una única proyección privada de pendientes con identidad tipada y un índice parcial que permite como máximo una tarea abierta por propietario, sujeto, propósito y asunto. Esta fase sólo lee esa cola; creación manual, seguimiento de observaciones, recurrencias, resolución y propuestas IA siguen fuera de alcance.
- La ruta **Hoy** consulta la misma cola canónica sin abrir ni modificar una visita de Jardines. Los estados de fecha se expresan con texto (`Vencida`, `Para hoy`, `Sin fecha`), además de iconografía, nunca solo mediante color.

### Verificación local

- `npm run typecheck`, 4 suites / 15 pruebas de Vitest, `npm run lint`, `npm run build` y `git diff --check` pasan antes de aplicar la migración remota.
- Las pruebas nuevas cubren el aislamiento de la referencia de visita por propietario, rechazo de identificadores de visita inválidos y etiquetas de prioridad explícitas para atención.

## Phase 8 — Tareas de Atención y recurrencias inactivas

- Una atención manual tiene sujeto de jardín o ciclo, propósito canónico y asunto. El índice parcial de identidad permite como máximo una tarea abierta por propietario, sujeto, propósito y asunto; intentar crear la misma devuelve la tarea existente en vez de duplicarla.
- Crear una observación, subir una foto o dejar transcurrir tiempo no crea tareas. La pantalla de ciclo ofrece el alta explícita de seguimientos de ciclo; Hoy ofrece las tareas manuales de sistema para el jardín seleccionado.
- Posponer conserva la fecha comprometida y añade `next_review_on` con historial. `No hace falta` exige un motivo y termina la tarea sin registrar una acción física.
- Completar crea, dentro de la misma transacción, el evento correspondiente y enlaza su identificador a la tarea: revisión visual o de desarrollo para evaluaciones, intervención o cosecha para trabajo de ciclo, y mantenimiento de sistema para agua, relleno, nutrientes o limpieza. La revisión visual requiere un resultado declarado personalmente; su CTA final es `Guardar mi observación visual`.
- `garden.events` puede ahora representar un hecho de jardín además de uno de ciclo. Cada evento conserva jardín obligatorio y, cuando aplica, ciclo; un trigger verifica propiedad y coherencia de ambos sujetos. Los eventos históricos se migran a su jardín canónico sin cambiar su ciclo ni sus fechas.
- `recurrence_rules` preserva las dos clases aprobadas: intervalo desde acción real y martes alternos anclados. Permanecen inactivas en esta fase, sin materializar pendientes, hasta que se configure de forma explícita una acción base o ancla de martes. No se inventa una primera fecha de mantenimiento.

### Verificación local

- `npm run typecheck`, 5 suites / 16 pruebas de Vitest, `npm run lint`, `npm run build` y `git diff --check` pasan antes de aplicar la migración remota.

### Evidencia manual

- iPhone/PWA: se inició una sesión, se omitieron dos posiciones, se pausó, se volvió a Jardines y se reanudó desde el acceso visible. El recorrido abrió la posición siguiente con jardín y número de posición presentes. Se finalizó sin registrar una revisión saludable ficticia.
- iPhone/PWA: Control V2 muestra la lista compacta de posiciones con jardín, cultivo o vacío, preparación para cosecha y conteos de Atención, sin diagnósticos ni acciones inventadas.
- Las pruebas cubren el vocabulario canónico de propósitos y las etiquetas explícitas de las acciones que registran hechos.

### Evidencia manual

- iPhone/PWA: se creó una tarea manual de cambio completo de agua sin fecha, se mostró como `Sin fecha`, se pospuso a una fecha futura y mostró `Programada`, y se descartó con motivo. La tarea dejó de aparecer tanto en Hoy como en Jardines. No se generó ningún evento físico durante esta prueba.

## Phase 9 — Mantenimiento guiado y Control V2

- Una sesión captura sus posiciones y ciclos actuales al iniciar. Su progreso distingue `not_reviewed`, `reviewed` y `skipped`; una posición omitida no crea una revisión saludable.
- El encabezado persistente del recorrido muestra jardín y número de posición. Si el ocupante cambió desde el inicio, el recorrido bloquea `Se ve bien` sobre el sucesor y exige revisarlo en un contexto nuevo.
- `Se ve bien` registra un `visual_review` manual tranquilizador vinculado a sesión. `Omitir` solo avanza el progreso. Pausa y reanudación conservan los hechos ya confirmados; finalizar no inventa revisiones para pendientes u omisiones.
- Control V2 se deriva de jardines, posiciones, ciclos activos, preparación para cosecha y conteo de Atención. No genera inferencias botánicas ni llamadas de IA.

### Verificación local

- `npm run typecheck`, 5 suites / 16 pruebas de Vitest, `npm run lint`, `npm run build` y `git diff --check` pasan antes de aplicar la migración remota.

## Phase 10 — Living Botanical Cinema

- La elevación visual no modifica migraciones, tablas, RLS, RPC, rutas, contratos de tipos ni flujos. `GrowthRings` es un componente SVG exclusivamente presentacional: no codifica progreso, salud, porcentaje ni estado de dominio.
- Home prioriza los jardines visualmente y mantiene **Desde la última vez** y **Atención** como lecturas separadas. Como el contrato actual no devuelve una fotografía ambiental de jardín, su composición utiliza numeral, anillos y superficie editorial; nunca reutiliza la fotografía de un ciclo como si fuera evidencia ambiental.
- Garden usa el mapa físico confirmado o personalizado de su sistema. Cycle toma sólo la fotografía más reciente ya confirmada de su propio historial para el retrato visual; su ausencia usa el estado editorial de numeral y anillos. No se infieren especie bilingüe, edad ni revisión vigente.
- Historial usa una línea temporal visual con nodos para ordenar evidencia ya existente. Las fechas y precisiones de fotografías permanecen en la interfaz; el diseño no inventa hechos futuros ni convierte una fecha desconocida en una ocurrencia.
- La entrada de sesión se reproduce una vez por sesión de navegador y no bloquea interacción. Las acciones tienen respuesta táctil breve; la foto de ciclo entra con una escala mínima. `prefers-reduced-motion` elimina transformaciones y reduce la entrada a un cambio directo. La navegación Garden → Cycle conserva una transición de vista breve; la continuidad fotográfica sólo se aplica dentro de Cycle porque el modelo no relaciona una foto ambiental de Garden con una foto de Cycle.
- Mantenimiento conserva el encabezado persistente Garden + Position y expresa en su línea visual **Revisada**, **Omitida** y **Pendiente** mediante texto, forma y color. `Skip` no se presenta como revisión completada. Control V2 conserva densidad de información y pasa a dos columnas sólo cuando hay espacio suficiente.

### Verificación local

- `npm run typecheck`, 5 suites / 16 pruebas de Vitest, `npm run lint`, `npm run build` y `git diff --check` pasan tras la elevación visual.
- El build conserva el aviso existente de Vite sobre un bundle inicial mayor de 500 kB; esta fase no añadió dependencias ni alteró la estrategia de carga.

## Phase 11 — Recuperación, observabilidad y preparación operativa

- Control V2 ahora puede descargar un CSV del informe y, mediante un RPC de solo lectura del propietario, un JSON versionado de jardines, posiciones, cultivos, ciclos, ocupaciones, eventos, revisiones, tareas, reglas, sesiones de mantenimiento y manifiesto de fotos. No incluye credenciales, sesiones, URLs firmadas ni registros de otra cuenta. El manifiesto identifica originales por ruta, checksum y estado; no pretende sustituir una copia de los bytes.
- La exportación se descarga en el dispositivo y se describe explícitamente como exportación, no como backup. La copia real de originales y la restauración siguen requiriendo un destino de respaldo independiente y una prueba de recuperación antes de producción.
- Al cerrar sesión, la app revisa los borradores locales. Si existen, exige volver para sincronizar, exportarlos con sus bytes codificados en un archivo local o descartarlos expresamente. Tras cierre de sesión, elimina borradores y snapshots de Garden del navegador para no exponerlos a otra cuenta en el mismo dispositivo.
- La migración local `20260907175528_phase11_owner_export.sql` introduce sólo `public.garden_export_owner_data()`. Es `SECURITY DEFINER`, comprueba el propietario desde la sesión y revoca `PUBLIC`, otorgando ejecución exclusivamente a `authenticated`.

### Verificación local

- `npm run typecheck`, 5 suites / 16 pruebas de Vitest, `npm run lint`, `npm run build` y `git diff --check` pasan tras la implementación local.
- El entorno no tiene una base Supabase local levantada y la conexión remota no está configurada en CLI, por lo que la ejecución y la prueba RLS del nuevo RPC quedan pendientes de aplicar la migración en el proyecto remoto. Ningún cambio remoto fue realizado desde esta fase.

## Phase 12 — Importación selectiva de historia

- Un lote de importación es idempotente por propietario y huella SHA-256 de su fuente. Repetir exactamente el mismo candidato devuelve el lote existente y no duplica candidatos ni hechos.
- Candidatos de observación, recomendación y contradicción son registros de revisión. Recomendaciones y contradicciones no pueden confirmar un hecho. Rechazar conserva la decisión y no escribe eventos.
- El modelo de eventos vigente sólo expresa un instante `occurred_at`. Por integridad, un candidato con fecha desconocida permanece en revisión y no se puede confirmar como evento; tampoco se inventa una fecha de importación. La confirmación actual exige ciclo y fecha exacta, y registra la procedencia `confirmed_import` en el evento resultante.
- La migración `20260907183429_phase12_selective_import.sql` añade lotes/candidatos privados y tres RPC con comprobación de propietario e idempotencia: crear lote, revisar candidato y leer candidatos.
- La migración local `20260907184125_phase12_import_candidate_completion.sql` permite completar un candidato de observación aún pendiente con ciclo y fecha exacta. Ese paso sólo actualiza su contexto de revisión; no crea un evento ni confirma la observación. La creación del hecho permanece detrás de `Confirmar como observación`.
- La migración local `20260907190024_phase12_import_date_precision.sql` conserva la fecha civil de una importación confirmada cuando la hora es desconocida. El `timestamptz` obligatorio del evento se usa sólo como ancla técnica de ordenación; la interfaz muestra `Fecha del hecho` y `Hora no registrada`, sin presentar esa ancla como un hecho. La migración repara las importaciones confirmadas existentes.

## Phase 13 — Validación MVP sin IA

- AI Check y Ask Garden quedan diferidos por decisión explícita: no hay proveedor, credenciales ni llamadas de IA en el cliente. El núcleo manual se valida por separado sin simular esas funciones.
- La matriz de evidencia existente, la tanda mínima pendiente en dispositivo y los bloqueos reales de producción viven en `docs/PHASE_13_MVP_VALIDATION.md`. Distingue validación local, remota, PWA física y producción; no eleva una compilación a evidencia de dispositivo o restauración.

## Phase 14 — Preparación para lanzamiento sin IA

- Las URLs firmadas de originales tienen una vigencia de cinco minutos. La duración se aplica únicamente en la capa de acceso a Storage; no altera originales, metadatos, eventos ni estados de sincronización.
- La exportación del propietario sigue siendo una herramienta de recuperación manual y no se presenta como backup. Una copia diaria independiente de base de datos y Storage, retención de 30 días y restauración comprobada son requisitos externos antes de un lanzamiento público.
- Auth remoto, URLs de redirección, configuración del bucket, RLS efectivo y hosting HTTPS se validarán en el entorno elegido. Esta fase no crea secretos, no conecta el CLI al proyecto remoto y no despliega la aplicación.

## Phase 16 — Publicación controlada

- El hosting estático es Vercel, con Node 22, build Vite y una regla de rewrite a `index.html` para conservar las rutas SPA al recargar.
- `garden.getstreex.com` se delega mediante un CNAME DNS-only en Cloudflare al destino específico de Vercel. No se modificaron los nameservers de `getstreex.com` ni otros registros del dominio.
- Supabase Auth usa exclusivamente `https://garden.getstreex.com` como Site URL y Redirect URL. El cliente ya no expone alta pública de cuentas; el proyecto remoto desactiva registro público y acceso anónimo.
- La evidencia de producción confirma inicio de sesión, lectura de jardines y creación/persistencia de una observación con foto desde iPhone. No reemplaza las pruebas pendientes de recuperación, segunda cuenta y backup/restauración.
