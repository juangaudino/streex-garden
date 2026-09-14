# Baseline integrado 04.A

Este harness ejecuta **`index.html` → `src/main.tsx` → `App` reales**, con BrowserRouter,
StrictMode, rutas y componentes del producto. No copia pantallas ni sustituye sus
hojas CSS. Es una herramienta local de caracterización, no un demo publicable.

## Aislamiento y límites

- Escucha exclusivamente en `127.0.0.1:4204`. No usar túneles ni desplegar.
- `envDir` apunta a esta carpeta, sin variables de cuenta; Garden AI queda desactivado.
- Los módulos de servicios se reemplazan **en el build del harness**, no en `src`.
  Se admiten lecturas de un único grafo sintético; puertos desconocidos, escrituras,
  AI, exportaciones y salida de cuenta fallan de forma explícita.
- Los consumidores reciben copias. `window.__gardenQa.initialDataset` y `snapshot()`
  permiten comparar datos antes de montar la aplicación y después de navegar.
  Las llamadas de visita se registran por separado: no se confunden con hechos.
- No hay cliente/backend, originales, credenciales ni URLs firmadas reales. Las
  imágenes son SVG etiquetados como sintéticos; el metadata de archivo es de prueba.
  Sólo se sirven tres assets de marca locales. Las fuentes conservan sus peticiones
  públicas de producción a Google Fonts; no se permite acceso a servicios de cuenta.
- CSP y un guard de fetch rechazan destinos ajenos al harness. No reemplazan una
  frontera de seguridad de producción: ésta es una herramienta de QA local.
- PWA se sustituye por un estado sin actualización; no se instala service worker.
  El viewport del producto se conserva; 04.B retira el bloqueo de zoom A01.
- No implementa un segundo backend canónico. Guardar, completar, avanzar sesión,
  confirmar salud, cerrar sesión o solicitar AI **no son operaciones disponibles**.
  Esas capacidades se validan con las pruebas del producto y, después, QA autenticada.
- No sirve pistas de audio ni verifica render/export/fullscreen físico. Los tests
  existentes de Film siguen siendo la evidencia local de esos contratos.

## Ejecutar

Desde la raíz del repositorio, con dependencias instaladas:

```sh
npx vite --config qa/experience-integration/vite.config.ts
```

En otra terminal:

```sh
node qa/experience-integration/baseline.mjs
```

El runner usa `agent-browser` vía `npx`. Si el navegador no está instalado en su
ruta habitual, especificar el ejecutable local:

```sh
QA_BROWSER_EXECUTABLE='/ruta/a/Chromium' node qa/experience-integration/baseline.mjs
```

El recorrido utiliza enlaces y botones reales. Centra cada objetivo y comprueba
el hit test antes de pulsarlo para evitar que la navegación fija intercepte un
clic de automatización. No utiliza clics forzados ni inyecta resultados de UI.

Los defectos conocidos se **miden**, no se corrigen ni se convierten en expectativas
permanentes de regresión. V02 incluye un diagnóstico temporal en CSSOM que retira
las diez reglas globales de Film y las restaura inmediatamente; la captura marcada
`diagnostic` no representa código implementado. En 04.B/04.C, añadir expectativas
de comportamiento corregido a partir de esta caracterización.

El runner cierra su navegador al terminar. Detener el servidor con `Ctrl+C`.

## Datos y escenarios

Un usuario sintético; dos jardines; tres ciclos activos y un ocupante histórico;
mapa físico V1 real, Attention y sesión coherentes con esos mismos IDs. Fechas fijas
en 2026: etiquetas relativas pueden variar con el reloj del equipo. La historia
del ocupante anterior precede a la siembra del sucesor.

Añadir `?qaScenario=...` en una entrada directa; el dataset se conserva al navegar
internamente. Recargar una URL sin ese parámetro restablece `normal`.

| Escenario | Efecto |
| --- | --- |
| `normal` | Dos jardines, seis registros por ciclo, tres fotos por ciclo, tres pendientes. |
| `dense` | 24 registros por ciclo y 16 pendientes; mismas identidades. |
| `empty` | Colecciones, cola, proyección e historias vacías; las rutas directas de jardín/ciclo conservan su contexto. |
| `no-photo` | Registros y operaciones visibles, sin fotos ni portadas. |
| `read-error` | Falla una vez `getHomeDashboard`; Reintentar puede recuperar. |
| `slow` | Lecturas demoran 1,5 s, salvo identidad de sesión. |

`window.__gardenQa.failRead('getCycle')` permite preparar un fallo de lectura;
`setDelay(1500)` permite ralentizar lecturas posteriores. No usar esos helpers
para fabricar guardados o resultados AI.

## Validación y artefactos

```sh
npx tsc --noEmit -p qa/experience-integration/tsconfig.json
npx vitest run qa/experience-integration/fixtures.test.ts
npx vite build --config qa/experience-integration/vite.config.ts
npm test
npm run lint
npm run build
```

- `artifacts/experience-integration/baseline/report.json`: mediciones, llamadas,
  invariantes, fuentes, geometría y errores; rutas/datos sintéticos solamente.
- Misma carpeta: capturas PNG, con nombres por superficie/estado/ancho.
- `artifacts/experience-integration/build`: build aislado; imprime SHA-256 del CSS
  para compararlo con `dist/assets/*.css` del producto. JS/PWA son diferentes por
  aislamiento; el CSS debe coincidir byte a byte.
- La espera de fuentes es acotada y se registra en `fontChecks`. Un timeout se debe
  declarar como límite de fidelidad, no como aprobación tipográfica.

Artefactos ignorados por Git. Esta evidencia no sustituye QA autenticada, iPhone,
teclado, safe areas físicas, audio, fullscreen Safari ni la revisión global 04.E.

Guía y decisiones: [Fase 04.A](../../docs/BOTANICAL_STUDIO_PHASE_04_A.md).

## Regresión de continuidad 04.B

```sh
QA_PHASE=04b node qa/experience-integration/baseline.mjs
```

Usa `QA_BROWSER_EXECUTABLE` para el navegador y, opcionalmente, `QA_BROWSER_CLI`
para un binario instalado de agent-browser (evita invocar npx en cada operación).
Escribe en `artifacts/phase04-b/integrated`, sin sobrescribir evidencia de 04.A.
Exige foco/retorno corregidos, seams Ask, áreas de controles, zoom local y cancelación
del sheet de borradores. V01/V02 siguen registrados como pendientes de 04.C.
El escenario `pending-drafts` expone copias de borradores sintéticos; no habilita
exportación, cierre de cuenta ni escritura. Esos caminos se prueban con mocks en
AppShell.test.tsx, conservando orden y fallos. No usar cuentas reales en este harness.
