# Botanical Studio — Fase 02.2 · Growth Film

Estado al 12 de septiembre de 2026: **implementación y QA responsive cerrados y aceptados por el usuario**. **Pendiente explícito: QA autenticada con fotos reales y fullscreen nativo en Safari de un iPhone físico.**

La Fase 01 y Maintenance 02.1 siguen aprobadas. Este tramo comenzó desde `9b42fea` en la rama `codex/botanical-growth-film-integration`. El núcleo está en `28b368f`, el montaje React en `77f6959` y el traslado visual/entorno de QA en `69654f3`. El montaje de Sol sustituye la ruta de Growth Film, añade `/garden/:gardenId/film` y su invitación dentro del jardín. No modifica flujos de Maintenance, Planta, Supabase ni la publicación. `BotanicalSheet` admite una clase CSS opcional, sin cambiar su comportamiento existente. Los archivos de `depth-study` que ya estaban sin seguimiento quedaron intactos.

## Punto de relevo de modelo

Los tramos de Astra, Sol High y Terra High de implementación y QA responsive están terminados. El usuario autorizó preparar **Planta 02.3 con Astra Extra High**, manteniendo el requisito de detenerse antes de cambiar de modelo. La preparación y el siguiente relevo se recogen en [la guía de Planta](BOTANICAL_STUDIO_PHASE_02_3.md). No reabrir benchmarking ni la dirección visual.

La ruta utiliza el núcleo nuevo y el CSS aprobado, aislado en `src/features/cycles/growth-film.css`. El exportador anterior queda sin uso en esta ruta, conservado para evitar una limpieza fuera de alcance. El cierre aceptado corresponde a implementación y QA responsive; no acredita fotos reales, autenticación ni fullscreen físico. Si esa validación revela una complejidad nueva del motor o del dominio, explicar el problema y detenerse para acordar el modelo correspondiente.

## Cierre visual y responsive de Terra

`69654f3` incorpora el CSS aprobado y su importación desde `GrowthFilmStudio.tsx`, además de `qa/growth-film-integration/*`, que monta los componentes reales con medios sintéticos y resolución de fotografías simulada. La dirección visual no se replanteó.

Registro de la verificación del corte anterior, aceptado por el usuario:

| Comprobación | Evidencia y alcance |
| --- | --- |
| Tests finales | 30 archivos / 114 pruebas aprobadas. |
| Build del producto y del entorno aislado | Correctos; ESLint dirigido correcto. |
| 390 px | Inspección y capturas de sala, momentos, música y vista previa. |
| 320 px | Revisión de controles y extremo inferior; `scrollWidth` de 320 px, sin exceder el viewport de 320 px. La barra vertical reduce el área cliente a 305 px; no confundir ambas medidas. |
| 820 px | Comprobación de disposición y anchura: viewport 820 px, cliente y contenido 805 px. La captura parcial no acredita toda la pantalla. |
| 1440 px | Medición de desbordamiento horizontal; no sustituye una inspección visual exhaustiva de escritorio. |
| Exportación desde la UI nueva | Clip silencioso de 20,4 s completado, vista previa reproducible y descarga disponible. |

El entorno aislado usa `publicDir: false`: la revisión visual del selector de música en ese entorno **no verifica la reproducción de los WAV**. La evidencia de audio del núcleo consta más abajo; falta comprobarlo con el flujo real autenticado en iPhone. Tampoco estos resultados equivalen a una auditoría completa de accesibilidad.

Esta actualización de estado no repite tests/build: conserva su evidencia histórica y la aceptación explícita del usuario, dejando separados los pendientes de dispositivo y cuenta.

## Conexión entregada por Sol

| Archivo | Responsabilidad |
| --- | --- |
| `GrowthFilmPage.tsx` | Lectura real por ciclo/jardín, carga/error/reintento, descarte de respuestas tardías y desmontaje por cambio de ruta. |
| `GrowthFilmStudio.tsx` | Sala de fotografías, reproducción sin render automático, scrub, todas las miniaturas, hitos/fuentes y diarios trasladados separados. Decodifica el siguiente momento antes de sustituir la foto. |
| `GrowthFilmClipEditor.tsx` | Momentos → Música → Vista previa; selección cronológica de 2–12, pistas existentes, escucha opcional, volumen/títulos, sesión única y descarga del mismo artefacto. Variante de diario completo para fullscreen, sin límite de doce. |
| `GrowthFilmVideo.tsx` | Video final con audio y narrativa incorporados, progreso/cancelación, error/reintento y fullscreen nativo tras datos cargados y un toque directo. Eventos nativos sincronizan el estado. |
| `GrowthFilmPhoto.tsx`, `growth-film-photo.ts` | Miniaturas privadas al aproximarse al área visible, renovación limitada ante error y URLs nuevas para el exportador. |
| `GrowthFilmStudio.test.tsx` | Ocho pruebas de conexión: no mutaciones, no render automático, paridad preview/descarga, invalidación, opciones/cronología, cancelación tardía, fullscreen, jardín/traslados, decodificación y desmontaje. |
| `src/app/App.tsx`, `GardenPage.tsx` | Nueva ruta e invitación de jardín; Compartir/Editar sistema conservan su composición en el encabezado. |

La duración real procede de `loadedmetadata`/`durationchange` y queda vinculada a la URL del artefacto. Si el navegador todavía no devuelve duración finita, la interfaz sigue indicando duración **estimada**. `FilmArtifact.durationMs` permanece nominal; no confundirlo con metadata del archivo.

## Núcleo entregado

| Archivo en `src/features/cycles/` | Responsabilidad |
| --- | --- |
| `growth-film-composition.ts` | Catálogo desde respuestas reales de ciclos, momentos/provenance, hitos, composición determinística y reloj. |
| `growth-film-loader.ts` | Puertos de lectura `getGarden`/`getCycle`; carga acotada a tres solicitudes concurrentes. Incluye ciclos actuales y previos, sin resultados parciales ante errores. |
| `growth-film-renderer.ts` | Una composición de canvas: foto completa, tipografía, títulos, notas y etiquetas de ciclo; fundido de escenas completas. |
| `growth-film-export.ts` | MP4 preferente, alternativa WebM, audio de la pista elegida, volumen, cancelación, progreso y propiedad del archivo. |
| `growth-film-session.ts` | Preparación desde un gesto, descarte de trabajos obsoletos, liberación de blobs y acceso seguro al archivo de la selección actual. Fullscreen nativo de video. |
| `growth-film-composition.test.ts`, `growth-film-loader.test.ts`, `growth-film-session.test.ts` | 18 pruebas del nuevo núcleo. |

La composición contiene referencias a fotos y eventos, nunca URLs firmadas. Las URLs privadas se resuelven al preparar el video. El archivo descargado es **el mismo blob usado por el elemento de video del preview**: no vuelve a codificarse ni cambia de música al descargar. `composition.key` es una identidad interna que incluye provenance; no mostrarla, registrarla en analítica ni enviarla a terceros.

Se mantienen 720 × 900 y fotografía completa (`contain`); 3,4 segundos nominales por momento; entre 2 y 12 momentos para clips. `purpose: 'playback'` permite el diario completo sin reducirlo automáticamente a doce fotos. La selección conserva el orden cronológico del catálogo, no el orden de los toques. Silencio, Growing Light y Garden · Track 4 usan las pistas existentes de `public/audio`.

Una fotografía no hereda una cosecha o una intervención cercana sólo por fecha. Su texto procede del mismo registro que la contiene. Los hitos sin foto permanecen en `milestones`, con sus fuentes originales. La agrupación de revisiones menores conserva IDs, notas y datos; no cruza ciclos. Una foto histórica sin evento mantiene `eventId: null`; una captura sin fecha mantiene esa incertidumbre. La última ubicación del ciclo no se presenta como ubicación de captura. Entre ciclos diferentes siempre hay corte; con movimiento reducido no hay fundidos.

## Contratos del montaje — conservar tras el cierre

1. La estructura React y las reglas de Film/editor ya están conectadas. Mantener `growth-film.css` aislado a `.film-page`/`.film-sheet`, los controles `.bs-button`, `.bs-icon-button`, `.bs-text-button`, `.bs-sheet-header`/footer y las fotos `.film-photo img`. No importar todo el CSS de la maqueta ni alterar Maintenance. La hoja amplia conserva anchura propia y la vista final usa video real con encuadre 4:5/contain. Conservar el estilo de la invitación de jardín.
2. Conectar `loadFilmCatalogue(scope, { getCycle, getGarden }, signal)` a las funciones existentes de `garden-api`. Componer las variantes de ciclo y jardín y añadir su entrada de navegación. No cambiar RPCs o esquema para el montaje visual.
3. Mantener la sala principal con foto protagonista, controles, miniaturas y panel de origen. Mostrar todas las fuentes de un hito agrupado. Usar `currentLocation` sólo como última ubicación registrada. No llamar a una foto histórica un hecho nuevo.
4. Montar Momentos → Música → Vista previa. Las fotos deben salir del catálogo real; «Usar mis fotos» en el prototipo era una facilidad de QA, no autorización para publicar fotos o crear eventos desde el editor de clips.
5. Usar una instancia de `FilmRenderSession` por editor (compatible con `useSyncExternalStore`). `prepare(plan, resolver)` se llama directamente desde el botón, no desde `useEffect`; así se conserva el gesto para el audio de Safari. El resolver usa `getSignedPhotoUrl(moment.storagePath, 'story')` y no guarda las URLs en la composición.
6. Ante cambios de selección, títulos, volumen, pista o movimiento: pausar/desconectar el video y llamar `session.clear()`. Hacer lo mismo al cerrar o desmontar. En la vista previa final, `video.src = artifact.url`. La descarga usa `session.artifactFor(plan.key)` y `downloadFilmArtifact` con ese mismo artefacto. No reproducir otra pista por separado encima del video ya mezclado. El control de volumen de exportación queda incorporado al archivo; no duplicar la ganancia.
7. Para fullscreen: preparar el archivo primero, esperar datos del elemento (`loadeddata`) y llamar `enterFilmFullscreen(video)` directamente en el toque siguiente. No esperar a renderizar y luego invocar fullscreen en la misma función asíncrona: se perdería el gesto original. Escuchar los eventos nativos para los estados de UI. Si falla, mostrar el error; no llamar fullscreen a una ampliación CSS.
8. No generar todo el diario automáticamente al abrir la página. La codificación actual ocurre en tiempo real y requiere que la app permanezca abierta. Mantener visibles progreso y Cancelar. La duración antes de generar es aproximada; tras cargar el video, mostrar su duración real de metadata. El contenedor/codec puede añadir una fracción de segundo.

## Verificación realizada

Sol: suite completa **30 archivos / 114 pruebas aprobadas** antes del ajuste final de metadata; TypeScript/build/Vite/PWA final correctos. ESLint de los TSX y adaptador modificados correcto. La suite específica final incluye las ocho pruebas de conexión y las dieciocho del núcleo. Estas pruebas usan lecturas/render/audio simulados: no sustituyen QA autenticada, visual o de Safari físico. No se inició otro servidor ni túnel en este relevo.

| Prueba | Resultado |
| --- | --- |
| Suite completa antes del último ajuste del reloj | 29 archivos, 105 pruebas aprobadas. |
| Núcleo tras el ajuste final y la prueba adicional de diario completo | 3 archivos, 18 pruebas aprobadas. |
| `npm run build` final | TypeScript, Vite y PWA correctos. |
| ESLint sobre los módulos modificados y la prueba web | Correcto. |
| Navegador local, clip silencioso | MP4 descargado, una pista de video, cero pistas de audio. Primer fotograma visible; texto incluido en el archivo. |
| Growing Light al 30 % | MP4 descargado con una pista de audio; RMS de audio decodificado 0,0234, distinto de silencio. |
| Track 4 al 30 %, reloj final | MP4 descargado 720 × 900, una pista de audio, RMS 0,0254; duración real 6,921 s frente a 6,8 s nominales. |
| Cancelar después de cambiar de pista | Vuelve a estado vacío, sin descarga disponible. Los tests cubren resolución y progreso tardíos. |
| Fotogramas extraídos del archivo | Revisados a 0,1 y 3,5 s: orden, foto completa, títulos y nota del segundo momento. |

La prueba local usa imágenes sintéticas rotuladas QA. No consulta la cuenta. Está en `qa/film-core.html`, `qa/film-core.ts` y `qa/film-core.config.ts`:

```sh
npx vite --config qa/film-core.config.ts
# http://127.0.0.1:4194/qa/film-core.html
```

Es una pantalla técnica de verificación, no la nueva interfaz y no un enlace remoto. Para detenerla, finalizar ese proceso de Vite. No se abrió un túnel.

Los archivos de video de esta prueba están en `~/Downloads/garden-x-core-{silent,growing-light,track-4}.mp4`. La inspección reproducible y sus fotogramas están en `artifacts/film-core/`. `qa/inspect-film.swift` verifica con AVFoundation las pistas, dimensiones, duración, muestras de audio y fotogramas del archivo descargado. Su API síncrona funciona en esta Mac, aunque Swift emite avisos de obsolescencia; es una utilidad de QA, no código del producto.

## Pendientes y riesgos explícitos

- **Safari en iPhone físico:** no verificado. Se implementó la llamada nativa y se probaron sus precondiciones, pero el navegador integrado no confirmó un estado fullscreen nativo. No marcar este requisito como resuelto hasta probar el flujo final en el dispositivo. Referencia de plataforma: [Apple — video para Safari](https://developer.apple.com/documentation/webkit/delivering-video-content-for-safari) y [WebKit — MediaRecorder](https://webkit.org/blog/11353/mediarecorder-api/).
- **Jardín y traslados entre jardines:** el endpoint de ciclo informa su última ubicación; no proporciona aquí la ocupación física en cada captura. El loader no atribuye al jardín de origen las fotos posteriores de un ciclo trasladado. Devuelve `excludedCycleIds` y la UI debe explicar la exclusión y ofrecer abrir esos ciclos. No ocultar este caso ni afirmar cobertura histórica completa del jardín. Una ampliación por ocupación histórica requiere otra decisión técnica, no CSS.
- **Datos autenticados y capacidades de dominio:** pendiente la QA del montaje conectado con lectura real, ciclos cerrados/trasladados, fuentes, notas extensas y fotos históricas. La capa nueva no llama a mutaciones; verificar esa propiedad en el flujo autenticado, no sólo en pruebas simuladas.
- **Rendimiento móvil:** probar el máximo de doce momentos y diarios largos en dispositivo; el renderer decodifica las imágenes antes de grabar. La captura se cancela al pasar a segundo plano o ante una interrupción prolongada, en lugar de entregar un archivo incompleto.
- **UI y accesibilidad:** QA responsive cerrada con el alcance descrito arriba. La accesibilidad completa, teclado móvil físico, errores reales de audio y comportamiento con medios de la cuenta conservan sus límites de verificación; no presentar las medidas de anchura como evidencia de todos esos casos.
- **Avisos previos del build:** bundle principal mayor a 500 kB e import dinámico inefectivo de `photo-renditions`. Persisten; los módulos nuevos ya están importados por la ruta del producto. JSDOM también emite el aviso previo de navegación a otro documento.
- Sin deploy, sin push y sin cambios de base de datos en estos cortes. El usuario autorizó preparar Fase 02.3 Planta; esa autorización no elimina el pendiente de QA autenticada/física de Growth Film.
