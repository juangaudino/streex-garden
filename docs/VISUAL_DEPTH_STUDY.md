# Garden X — Estudio visual de profundidad

Estado: propuesta local para revisión, no aplicada a producción.

Autorización: comparación de Home, Garden y Cycle tras crítica visual; vidrio selectivo, profundidad 2.5D y fotografía protagonista. No habilita un rediseño general ni cambios de dominio.

## Revisión

Ejecutar `npx vite --config qa/depth-study.config.ts` y abrir `/artifacts/depth-study/review.html` para capturas comparables o `/qa/depth-study.html` para alternar Actual / Propuesta en los componentes reales.

Los archivos `qa/depth-study*` no son importados por la entrada de producción. La API local sustituye lecturas por fixtures y rechaza escrituras. Las dos composiciones reciben las mismas fotografías existentes de `public/gardens` y datos simulados. Son fotos del equipo, no un historial fotográfico real ni evidencia atribuida a una planta real. Los enlaces a flujos fuera de Home/Garden/Cycle no constituyen una demo funcional completa.

## Cambios propuestos

- Home: contraste fotográfico, titular acotado, correo fuera del hero editorial, tarjetas con números secundarios y sombras diferenciadas.
- Navegación: vidrio verde ahumado, borde iluminado y selección legible.
- Garden: bandeja con relieve mediante CSS, sin cambiar coordenadas ni perspectiva de posiciones. Fotografía ambiental con pie de vidrio.
- Cycle: superficie verde translúcida sobrepuesta a la fotografía y controles con contraste.
- Movimiento: elevación breve al hover, presión de posiciones; reduced-motion elimina transiciones. Sin WebGL, nuevas dependencias ni animación perpetua.

## Validación

18 combinaciones: tres pantallas × tres viewports (390, 820, 1440) × dos variantes. Chromium local automatizado: sin errores de página ni desbordamiento horizontal. Capturas adicionales del mapa. Inspección visual local; no prueba física en iPhone ni certificación de accesibilidad/contraste completa.

Typecheck, lint, 39 tests y build aprobados. Build conserva advertencia de chunk mayor a 500 kB. La suite existente verifica regresión de la app; no prueba por sí sola fidelidad de esta propuesta. El estudio QA está fuera del tsconfig de aplicación.

Pendiente: elección del usuario antes de integrar estilos al producto; validación posterior con fotografía documental real. Sin SQL, cambios de datos, despliegue ni Historical Photos.
