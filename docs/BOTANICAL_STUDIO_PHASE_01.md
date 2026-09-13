# Garden X · Botanical Studio

**Fase 01 — Dirección visual, UX y prototipos.** 11 de septiembre de 2026.

Entrega local para revisar la dirección aprobada sobre tres experiencias: Planta, Maintenance y Growth Film. Está implementada en una entrada independiente, `qa/botanical/`. La aplicación publicada no incorpora estos cambios.

## Abrir y recorrer

Desde la raíz del repositorio:

```sh
npx vite --config qa/botanical/vite.config.ts
```

Abrir [Botanical Studio](http://127.0.0.1:4190/qa/botanical/index.html). La barra superior permite cambiar de experiencia, tamaño y estado. «Abrir sin marco» muestra la interfaz con el ancho real de la ventana. En móvil, es la forma preferida de revisarla. El marco del Studio representa un tamaño de trabajo; no emula Safari ni el hardware de un iPhone.

Enlaces directos:

- [Planta](http://127.0.0.1:4190/qa/botanical/index.html?standalone=1&view=plant).
- [Maintenance](http://127.0.0.1:4190/qa/botanical/index.html?standalone=1&view=maintenance).
- [Growth Film](http://127.0.0.1:4190/qa/botanical/index.html?standalone=1&view=film).

El control «DEMO» contiene los estados alternativos, la opción de reducir movimiento y la carga de fotografías locales.

## Dirección visual

**Living Botanical Cinema:** una experiencia editorial apoyada en la fotografía documental y en controles predecibles.

La calidad debe surgir de la composición, el espaciado, el contraste y la respuesta de cada interacción. Se conserva el carácter botánico de Garden X: papel cálido, verdes contenidos, títulos serif y fotografías reales. El tratamiento de vidrio queda reservado para etiquetas sobre imágenes y superficies de navegación que necesitan separarse del contenido. La película utiliza un ambiente oscuro propio.

La propuesta tiene tres expresiones del mismo lenguaje:

| Experiencia | Composición | Prioridad de interacción |
| --- | --- | --- |
| Planta | Retrato grande, identidad clara y dos capítulos: presente e historia. En escritorio, foto y contenido comparten el ancho; en móvil, se apilan. | Una entrada para registrar. Los tipos de registro aparecen dentro de una hoja contextual. |
| Maintenance | Referencia visual y lista de tres intenciones. Contexto de jardín, posición y avance siempre reconocible. | Guardar conserva la posición. Avanzar y omitir pertenecen a una única zona de navegación. |
| Growth Film | Fotografía completa en un escenario oscuro; relato breve al lado o debajo. Controles separados del contenido. | Mirar la película primero. Crear un clip es un recorrido independiente de tres pasos. |

### Qué cambia respecto de las capturas anteriores

| Problema observado | Decisión de esta propuesta |
| --- | --- |
| Muchos botones redondeados con la misma importancia. | Jerarquía entre acción principal, filas de intención y enlaces secundarios. |
| Confirmaciones duplicadas y «Continuar» mezclado con párrafos. | Una confirmación breve junto al contenido; la navegación permanece en su barra. |
| «Omitir» sigue compitiendo con «Continuar» tras guardar. | Tras guardar, la barra muestra «Registrar algo más» y «Siguiente planta». |
| Formularios extensos intercalados en la página. | Hojas modales con contexto, cancelar y guardar en posiciones constantes. |
| Fotos subordinadas a tarjetas y metadatos. | La imagen tiene un área propia; su original y procedencia están a un toque. |
| Growth Film comparte el aspecto de las pantallas de gestión. | Sala oscura, tipografía editorial y controles contenidos; editor de clip separado. |
| Texto técnico o abstracto en las entradas. | «Una observación», «Algo que hice», «Algo para revisar después». Los tipos del dominio se conservan internamente. |

### Sistema visual que se puede trasladar al producto

| Elemento | Regla propuesta |
| --- | --- |
| Papel / superficie | `#f4f5ee` / `#fdfdf7`. El fondo sostiene la lectura sin necesitar un gradiente en cada tarjeta. |
| Tinta / acción | `#193a30` / `#254b39`. Texto y acción no dependen sólo de una diferencia de opacidad. |
| Salvia / borde | `#e7ecdf` / `#dbe0d5`. Superficies informativas y separadores discretos. |
| Cine | Fondo `#0f1916`, superficie `#1d2923`, separador `#344139`. |
| Tipografía | Fraunces para títulos; DM Sans para controles y lectura. Fallbacks a Georgia y tipografía del sistema. |
| Jerarquía | Título de planta adaptable, hasta 76 px en escritorio; títulos de sección entre 28 y 40 px; texto corriente 14–16 px; etiquetas compactas de 11–12 px. |
| Espaciado | Ritmo de 8 px con pasos intermedios de 4 px. Separaciones grandes entre capítulos, pequeñas dentro de una intención. |
| Bordes y radios | Botones de 14 px; fotografía de 18 px; hojas de diálogo más amplias. Las filas de acción no necesitan ser tarjetas individuales. |
| Controles | Botones principales de al menos 50 px de alto; controles de icono de 44 px, con cierre visual más contenido y área táctil ampliada. |
| Movimiento | Presión breve al pulsar, transición fotográfica contenida y ningún movimiento ambiental perpetuo. La preferencia de movimiento reducido desactiva animaciones y transiciones. |

Estas son decisiones del prototipo, no una certificación de accesibilidad. Antes de integrar deben comprobarse contraste completo, zoom, VoiceOver, teclado virtual y tamaños de texto del dispositivo.

## Interacciones que ya se pueden probar

### Planta

- Abrir la fotografía completa y consultar su procedencia.
- Alternar entre presente e historia; abrir cada registro.
- Abrir «Registrar un momento» y elegir observación, acción o seguimiento.
- Guardar notas, una acción confirmada o un seguimiento con fecha opcional dentro de la maqueta.
- Recuperarse del estado de error de lectura y comenzar desde el estado vacío.
- Abrir Growth Film y volver a la planta conservando los registros de demostración de Planta.

La fotografía adjunta a una observación simula el adjunto mediante su nombre de archivo. No se crea una foto en el diario ni se extraen metadatos. Germinación, conteo, incidencias, traslados y cierre del ciclo deben incorporarse usando los formularios existentes durante la implementación; no se han sustituido por funciones incompletas de dominio.

### Maintenance

- Registrar una acción o seguimiento y permanecer en la misma posición.
- Abrir otro registro y cancelar sin perder la acción para continuar.
- Ver los registros creados en la posición, incluida la fecha de seguimiento.
- Avanzar expresamente con «Siguiente planta».
- Omitir sin crear un registro de observación.
- Confirmar «Se ve bien» con una explicación de que se guardará una observación y se avanzará.
- Pausar y retomar mientras la vista permanece montada; completar el recorrido y ver el resumen de tres posiciones.
- Simular un primer error de guardado: el formulario conserva la información y permite reintentar.

La sesión del prototipo vive en memoria. Recargar o abandonar Maintenance reinicia su recorrido. La persistencia real existente tendrá que conectarse al integrar la presentación.

### Growth Film y creación del clip

- Reproducir/pausar la secuencia, avanzar manualmente, usar el scrub y las miniaturas.
- Abrir el original en «Vista ampliada» y consultar el origen del momento.
- Elegir entre 2 y 12 momentos visibles para una composición.
- Cargar hasta 24 imágenes locales en el explorador del prototipo y seleccionar las que se usarían en el clip.
- Elegir silencio, Growing Light o Garden · Track 4; escuchar cada pista y regular el volumen.
- Revisar la composición con sus fotos elegidas, música y títulos opcionales.

«Finalizar prueba» confirma la composición de la maqueta. **No exporta un archivo de video.** La codificación, descarga, fullscreen nativo de iOS, audio del reproductor principal y continuidad temporal entre audio y video se conectarán a la implementación existente. «Vista ampliada» no se presenta como fullscreen nativo.

Los títulos actuales son ejemplos de presentación. La integración debe utilizar `growth-film-narrative.ts` y hechos confirmados; nunca inferir crecimiento, mejoría, germinación o una intervención a partir del orden de las fotos. El prototipo de esta fase muestra un ciclo; la variante de jardín, sus etiquetas por planta y sus límites entre ciclos permanecen como trabajo de integración.

## Datos, fotografías y límites

- No se importan clientes de API, autenticación ni funciones de escritura de la aplicación.
- No se ejecuta Garden AI. Sus entradas demuestran la presentación y el paso explícito a un formulario.
- Los nombres de planta, edades, notas y estados son fixtures. No describen el estado de la cuenta del usuario.
- La referencia visual procede de un archivo local existente, `original.jpg`. Se conserva sin edición en `artifacts/botanical/reference.jpg`, fuera del control de versiones.
- Sólo existe **una fotografía de referencia**, repetida seis veces para probar composición, selección y navegación. No constituye una secuencia real de crecimiento. Se explica en las opciones DEMO, el editor y el origen del momento.
- Las fotos elegidas por el usuario usan URL de objeto del navegador; no se suben. Las fechas de captura se muestran como «sin confirmar»; no se inventan a partir del nombre del archivo.
- Las dos pistas se leen desde los WAV existentes en `public/audio`; no se modificaron ni generaron nuevas pistas.
- Las fuentes se cargan desde Google Fonts con fallbacks. El despliegue final puede alojarlas localmente; esta fase no añade dependencias de npm ni llamadas a modelos.
- El servidor se vincula a `127.0.0.1`. El build comprueba compilación; la referencia privada se sirve únicamente mediante el servidor de desarrollo. No es un paquete publicado ni una entrega portable de fotografías.

## Archivos y siguiente implementación

| Entrega de la fase | Función | Punto de integración previsto |
| --- | --- | --- |
| `qa/botanical/App.tsx` | Studio, navegación y estado de demostración. | El Studio no se integra en producción. |
| `qa/botanical/design.css`, `studio.css` | Sistema visual y espacio de revisión. | Extraer tokens y componentes; mantener los estilos del Studio aislados. |
| `qa/botanical/Plant.tsx` | Retrato, presente, diario y detalles. | `src/features/cycles/CyclePage.tsx`. |
| `qa/botanical/Maintenance.tsx` | Recorrido, navegación y estados después de guardar. | `MaintenancePage.tsx`, `MaintenancePortrait.tsx`, `MaintenancePositionActions.tsx`. |
| `qa/botanical/RecordSheet.tsx`, `ui.tsx` | Hoja de registro, modal, botones, imágenes y estados. | Presentación compartida sobre `CycleFactRecorder.tsx` y formularios actuales. |
| `qa/botanical/Film.tsx` | Sala de reproducción y editor de tres pasos. | `GrowthFilmPage.tsx`, `growth-film-media.ts`, `growth-film-narrative.ts`. |
| `qa/botanical/model.ts` | Fixtures y pistas existentes. | Sustituir fixtures por adaptadores de lectura; no trasladar datos de ejemplo. |
| `main.tsx`, `index.html`, `vite.config.ts`, `tsconfig.json` | Entrada y validación independientes. | Herramientas de prototipado, fuera de la app publicada. |

Orden de integración aprobado tras la revisión móvil de la Fase 01:

1. **Fase 02.1 — Maintenance y base compartida.** Conectar la presentación a los formularios y operaciones existentes. Separar «Se ve bien» de navegación, conservar la posición después de guardar y compactar las hojas móviles. [Informe de cierre](BOTANICAL_STUDIO_PHASE_02_1.md).
2. **Fase 02.2 — Growth Film.** Implementación y QA responsive cerrados y aceptados. Se conserva la composición entre preview y archivo exportado. **Pendiente explícito: QA autenticada con fotos reales y fullscreen nativo en Safari de un iPhone físico.** [Informe y alcance de verificación](BOTANICAL_STUDIO_PHASE_02_2.md).
3. **Fase 02.3 — Planta.** Preparación e integración funcional con Sol High terminadas; siguiente tramo de CSS aprobado y QA visual/responsive con Terra High, tras el cambio de modelo. Conservar la composición aprobada e incorporar nombre en inglés y científico debajo del nombre principal, sobre las capacidades reales existentes. [Guía de integración y relevo](BOTANICAL_STUDIO_PHASE_02_3.md).

La dirección visual está cerrada. Home, Jardines, Hoy y Ask Garden no forman parte de esta integración de Maintenance; cualquier extensión posterior se delimitará por separado.

El estudio anterior `qa/depth-study*` permanece independiente y sin modificaciones en esta entrega. No se fusionaron sus estilos con esta propuesta.

## Evidencia de esta fase

Verificación local del prototipo; no se presentó como QA de la aplicación publicada:

- TypeScript, ESLint y build de Vite del prototipo completados sin errores.
- Inspección visual de Planta, Maintenance y Growth Film en 390, 820 y 1440 px. Revisión adicional a 320 px con un nombre largo y formulario de seguimiento.
- Sin desbordamiento horizontal de página en las vistas medidas. Las tiras de momentos pueden desplazarse horizontalmente cuando su contenido lo requiere.
- Guardar una acción permanece en la posición; el seguimiento conserva una fecha elegida; reintentar conserva la nota; cancelar con Escape devuelve el foco y conserva «Siguiente planta».
- Selección de cero o una foto bloquea continuar. Dos fotos permiten pasar a música y vista previa. La carga local actualiza el editor abierto.
- Las dos pistas alcanzan el estado de reproducción en el navegador; cambiar de pista detiene la anterior. Esto no valida la mezcla del video exportado.
- En movimiento reducido, la animación computada de la foto es `none`.

Capturas locales: `artifacts/botanical/plant-mobile.png`, `maintenance-mobile.png`, `film-mobile.png`, `music-mobile.png`, `maintenance-desktop.png` y `film-desktop.png`. No contienen datos consultados desde la cuenta.

Pendientes propios de implementación: datos reales, persistencia, todas las variantes del dominio, extracción de fechas, exportación de video, Safari/iOS físico, accesibilidad completa y rendimiento con álbumes reales. No se reabre aquí el QA funcional que el usuario ya dio por aprobado.

## Recorrido de revisión visual

1. **Planta:** valorar fotografía, tamaño de letra y facilidad para llegar a un registro. Abrir también «Contenido abundante» para revisar un nombre largo.
2. **Maintenance:** guardar algo, cancelar el siguiente formulario y continuar. Valorar especialmente si la barra inferior explica bien qué ocurrirá.
3. **Growth Film:** entrar en «Crear clip», elegir momentos, escuchar las pistas y revisar la composición.
4. Comparar móvil y escritorio. Anotar qué composición se siente más propia de Garden X y qué elementos todavía resultan demasiado básicos o recargados.

El criterio de cierre de esta fase es una dirección visual concreta y discutible en pantalla. La calidad final requerirá conservar esta coherencia al conectar los flujos reales; un build correcto no demuestra por sí solo ese resultado.
