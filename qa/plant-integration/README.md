# QA aislada de Planta 02.3

Componentes reales de `/cycle/:cycleId`, servicios en memoria y medios **sintéticos**. No conecta una cuenta ni prueba RPC/Storage reales. Incluye la capa visual final de Planta 02.3, limitada a `.plant-page` y `.plant-sheet`; este entorno continúa siendo una entrega aislada, no una prueba autenticada.

```sh
npx tsc -p qa/plant-integration/tsconfig.json
npx vite build --config qa/plant-integration/vite.config.ts
npx vite --config qa/plant-integration/vite.config.ts
```

El servidor local, cuando se inicie, escucha sólo en `127.0.0.1:4196`; se detiene con Ctrl+C. No se ha publicado preview. Artefactos de build en `artifacts/plant-integration/build` (ignorados por Git).

Escenarios: vertical, horizontal, nombre/historia abundantes, sin foto, cerrado, fecha aproximada y desconocida. Controles para fallar la siguiente lectura/escritura simulada. Todo se reinicia al cambiar escenario o recargar.

`vite.config.ts` sustituye garden-api, offline-observation-store, observation-sync, ai-gateway y PWA; prohíbe importar Supabase. `publicDir: false` evita servir audio y otros archivos del producto. Por eso la marca de imagen del shell puede no cargarse en esta maqueta: no afecta los componentes de Planta y no se usa como evidencia de carga de assets de producción.

La foto introducida por el usuario no se sube a ningún servicio. El sincronizador de QA añade una imagen sintética en su lugar: no usarlo como prueba de fidelidad del original. Análisis AI, permisos, portadas de jardín/Home y operaciones de ocupación son simulaciones. Las pruebas de contrato/formulario están en `src/features/cycles/PlantStudio.test.tsx`; la prueba autenticada queda separada.
