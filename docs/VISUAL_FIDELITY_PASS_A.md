> **Registro histórico:** Pass A quedó seguido por Pass B y pases de coherencia posteriores. La dirección vigente debe verificarse en el producto y en [PROJECT_STATUS.md](PROJECT_STATUS.md).

# Garden X — Pasada A

Implementación: 8 de septiembre de 2026. Pendiente de aprobación visual del propietario. Pasada B no iniciada.

## Alcance

React / TypeScript / CSS / SVG, View Transitions y Web Animations. Sin dependencias nuevas. Se reutilizan las consultas de ciclo y las URL firmadas existentes. No se modifican dominio, SQL, RLS, contratos, rutas, recurrencias, correcciones, sync ni reglas de mantenimiento.

La fotografía principal conserva el criterio existente: primera evidencia confirmada del historial del ciclo. No se sustituye por una imagen más atractiva, una portada ambiental ni una ilustración. Las notas del historial siguen completas.

## Evidencia A–F

La lámina navegable está en `artifacts/pass-a/review.html`. Las capturas quedan fuera de Git porque contienen fotografía documental privada. El entorno QA utiliza componentes de producto y datos simulados claramente etiquetados, con una fotografía documental real repetida para probar volumen; no representa crecimiento real ni crea registros en Supabase.

| Evidencia | Qué comprobar | Archivos en artifacts/pass-a |
| --- | --- | --- |
| A · Garden → Cycle | Numeral y anillos compartidos, ida y vuelta | transition-01-garden, transition-02-90ms, transition-02-180ms, transition-back-90ms, transition-fallback-180ms, transition-reduced-final |
| B · Cycle | Foto integrada con superficie marfil; numeral editorial sin foto | cycle-mobile, cycle-tablet, cycle-desktop, cycle-bare-mobile, cycle-bare-desktop |
| C · Maintenance | Planta actual, revisión, omisión, ausencia de foto y fallo sin avance | maintenance-mobile, maintenance-desktop, maintenance-reviewed, maintenance-skipped, maintenance-bare-mobile, maintenance-save-error |
| D · History | 36 registros, miniaturas de 86 px en móvil, notas completas y visor accesible | history-mobile, history-scroll-mobile, history-photo-viewer |
| E · Photo Story / Compare | Orden temporal, fechas reales del registro, una foto y selección de dos originales | story-mobile, story-tablet, story-one-photo-tablet, compare-mobile, compare-tablet |
| F · Verificación | Navegador local, pruebas y límites | Este documento y resumen de la lámina |

Todos los nombres de captura llevan extensión `.png`.

## Motion

- Identidad Garden → Cycle: 360 ms. View Transitions comparte únicamente numeral y anillos. El contenido de la ruta cruza mediante un fade corto. El origen de la posición y el scroll se conservan únicamente en memoria de presentación.
- Retorno: movimiento inverso y recuperación de foco en la posición de origen. Entrada directa sin origen: navegación normal.
- Sin View Transitions: un clon visual temporal del numeral utiliza Web Animations durante 360 ms y se elimina al terminar o cancelar. No contiene datos persistidos.
- Movimiento reducido: navegación directa, sin desplazamiento espacial. Los estilos respetan `prefers-reduced-motion`.
- Maintenance: después de confirmar el progreso remoto, una revisión retrae/desvanece la vista anterior; omitir usa un fade neutro. La siguiente posición entra en 320 ms. Sin la API o con movimiento reducido, el cambio es directo.
- Los fotogramas de A son capturas del movimiento real pausado por el arnés local a 90/180 ms; no son dibujos reconstruidos. La duración de producto permanece en 360 ms.

## Verificación

- 27 pruebas automatizadas: todas pasan. Incluyen URL tardía de otra foto, cambio de ocupante, ciclo trasladado, fallo antes de confirmar progreso, omisión sin revisión, historia con una sola imagen, fechas desconocidas y navegación/foco con movimiento reducido.
- Typecheck, lint y build correctos. Build conserva un aviso no bloqueante de bundle principal superior a 500 kB; no se amplía esta pasada a una reorganización de carga del producto.
- Navegador local: vistas de 390 × 844, 820 × 1180 y 1440 × 1000. Capturas representativas y verificación de geometría sin desbordamiento horizontal en las vistas comprobadas.
- Transición nativa, inversa y alternativa WAAPI capturadas; movimiento reducido emulado en QA. Apertura de original, Escape y retorno de foco comprobados.
- Compare: dos seleccionadas, las otras 33 opciones deshabilitadas, dos originales visibles y foco en el encabezado del resultado.
- Historial y rail cargan fotografías cerca del viewport. Maintenance consulta exclusivamente el ciclo de la posición actual y descarta respuestas que ya no corresponden. No agrega cache persistente ni nueva arquitectura.
- QA sustituye las operaciones remotas por fixtures; las acciones no contempladas están deshabilitadas. No se realizaron revisiones, omisiones ni invalidaciones sobre datos reales para obtener estas capturas.

Estas comprobaciones no equivalen a una prueba en iPhone físico, ni a aprobación estética del propietario.

## Diferencias intencionales respecto del mockup

- No hay morph entre fotografía ambiental y documental: no son la misma evidencia.
- No se inventan nombres bilingües, edad, fecha de siembra, salud ni crecimiento para completar la composición.
- History prioriza cronología y miniaturas; la fotografía completa se abre en un diálogo nativo con teclado y foco.
- Compare conserva exactamente dos originales y sus fechas. Su barra queda limitada a su sección; no invade el recorrido fotográfico.
- La ausencia de fotografía utiliza identidad editorial. Los fallos de acceso se identifican como tales, sin fingir una ausencia de evidencia.
- Home, refinamientos generales de profundidad y demás alcance de Pasada B permanecen fuera de esta entrega.

## Reproducir QA local

`GARDEN_QA_PHOTO` debe apuntar a una fotografía autorizada fuera del repositorio. Ejecutar Vite con `qa/visual-pass-a.config.ts` y abrir `/qa/visual-pass-a.html#/garden/qa` en el puerto 4180. Opciones de consulta: `bare`, `one`, `slow`, `changed`, `photo-error`, `save-error`, `reduced`, `fallback` y `frame=90` / `frame=180`. `direction=back` pausa únicamente el retorno.

El arnés y las capturas no forman parte de la entrada ni del bundle de producción.
