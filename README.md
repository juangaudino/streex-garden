# Streex Garden

Streex Garden es una aplicación privada para registrar, revisar y comprender la historia de jardines físicos y sus Grow Cycles. Su interfaz se denomina **Garden X**.

No convierte el cuidado en una lista genérica de recordatorios. Conserva qué ocurrió, cuándo se supo, qué evidencia lo respalda y qué queda por revisar. Un jardín, una posición y un ciclo son conceptos distintos; las fotografías son evidencia documental y las sugerencias de IA nunca sustituyen hechos confirmados.

> **Estado actual:** producto privado desplegado en [garden.getstreex.com](https://garden.getstreex.com). Incluye Garden AI V1 bajo activación controlada. Consulta [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) para el estado operativo y las limitaciones vigentes.

## Demo y privacidad

La aplicación requiere una cuenta autorizada. No se publican credenciales de prueba, fotografías privadas ni datos de propietarios.

Las capturas incluidas en `docs/screenshots/` proceden de fixtures visuales locales y vacíos. Sirven para mostrar la jerarquía de interfaz, no para demostrar datos de producción o uso de un dispositivo físico.

## Qué resuelve

Un cultivo doméstico suele quedar repartido entre memoria, notas, fotos y mensajes. Cuando una planta se mueve, se reemplaza o se corrige una fecha, el contexto se pierde.

Streex Garden mantiene una historia verificable:

- separa **observación**, **hecho confirmado** y **seguimiento**;
- conserva ciclos anteriores de una misma posición sin mezclar su evidencia;
- trata cada foto como evidencia privada con checksum, provenance y precisión temporal;
- proyecta Control V2 y Attention de manera determinista;
- mantiene correcciones e invalidaciones como auditoría, en lugar de reescribir la historia;
- permite interpretar contexto con Garden AI sin delegar la verdad del jardín al modelo.

## Experiencia principal

1. Abrir **Home** para ver jardines, cambios recientes y atención vigente.
2. Entrar a un **Garden** y recorrer sus posiciones físicas.
3. Abrir un **Grow Cycle** para consultar su Historial, Plant Story, fotografías y acciones.
4. Añadir una observación, registrar un estado o acción confirmada, o crear un seguimiento para después.
5. Usar **Control V2**, **Hoy** o **Maintenance** para decidir qué revisar.
6. Cuando resulte útil, usar **Ask Garden** o **AI Check** como una segunda opinión no canónica.

## Funcionalidades

### Núcleo de Garden X

- Autenticación privada con Supabase Auth.
- Jardines, posiciones físicas y elementos técnicos configurables.
- Grow Cycles activos e históricos por posición.
- Observaciones de texto, fotografía o ambas en un único momento histórico.
- Hechos estructurados: germinación, cantidad, estado, desarrollo, readiness, intervenciones e incidencias.
- Seguimientos/Attention con fecha opcional, completado, posposición y descarte.
- Control V2 y Home como proyecciones deterministas de evidencia vigente.
- Maintenance contextual con revisión, omisión, pausa y reanudación.
- Historial paginado, invalidación con motivo, Plant Story y navegación entre ciclos previos.
- Comparación explícita de dos fotos del mismo ciclo y Growth Film con fotografías reales, controles de reproducción, reduced motion y clip local cuando el navegador lo admite.
- Portadas manuales para Home, Garden y ciclo sin duplicar fotografías.

### Evidencia fotográfica

- Originales privados en Supabase Storage.
- Renditions de lectura para carga fluida de interfaz, preservando el original.
- SHA-256, tamaño, MIME, filename, captura temporal y provenance cuando están disponibles.
- Historical Photos v1 con identidad de importación idempotente y sin crear hechos sintéticos.
- URLs firmadas temporales; no hay objetos públicos ni URLs permanentes de fotografías.

### Compartir historias

- **Guest Plant Story:** comparte un ciclo seleccionado por enlace revocable de solo lectura.
- **Guest Garden Story:** comparte el jardín y permite abrir la historia de cada planta incluida.
- Las fotografías privadas se entregan temporalmente desde Edge Functions dedicadas. El invitado no recibe acceso a la cuenta, Control, Maintenance ni datos del propietario.

### Garden AI V1

Garden X sigue siendo la fuente de verdad. La IA interpreta evidencia y propone; la persona confirma cualquier acción mediante los flujos canónicos.

- **Ask Garden:** responde primero con datos deterministas de Garden X; preguntas abiertas usan síntesis grounded con contexto owner-scoped.
- **AI Check:** analiza una foto de un ciclo y devuelve una propuesta estructurada y prudente.
- **AI Check durante Maintenance:** puede analizar una rendition temporal antes de guardar la foto. Los bytes no se suben ni se convierten en foto, evento o hecho hasta que el usuario guarda explícitamente.
- **AI Compare:** usa exactamente dos fotografías elegidas del mismo ciclo.
- Las sesiones de chat no persisten, el modelo no genera SQL, no existe memoria automática y ningún fallo de IA modifica datos canónicos.

Consulta [docs/GARDEN_AI_V1_IMPLEMENTATION.md](docs/GARDEN_AI_V1_IMPLEMENTATION.md) y [docs/GARDEN_AI_STANDARD_V1_PROPOSED.md](docs/GARDEN_AI_STANDARD_V1_PROPOSED.md) para el contrato de runtime.

## Arquitectura

```text
Browser / PWA
  ├─ React + TypeScript + React Router
  ├─ validaciones de interfaz y dominio
  ├─ borradores de observación en IndexedDB
  └─ Supabase JS con sesión autenticada
          │
          ├─ RPC owner-scoped
          ▼
Supabase
  ├─ Auth
  ├─ PostgreSQL
  │   ├─ esquema privado garden
  │   ├─ RLS, revisiones e idempotencia
  │   ├─ eventos, ciclos, Attention y proyecciones
  │   └─ contexto de evidencia autorizado
  ├─ Storage privado: garden-originals
  └─ Edge Functions
      ├─ garden-ai
      ├─ garden-ai-benchmark
      ├─ guest-plant-story
      └─ guest-garden-story
          │
          └─ OpenAI Responses API, sólo server-side para Garden AI
```

El cliente no escribe directamente en tablas de dominio. `src/lib/garden-api.ts` llama a RPCs owner-scoped con `request_id` y revisiones esperadas. Las fotos se cargan a Storage privado y se confirman contra la metadata inmutable.

## Seguridad y datos

- `auth.uid()` determina el propietario; el navegador no elige `owner_id`.
- Las tablas del esquema `garden` usan RLS y las funciones de dominio tienen permisos mínimos.
- El resolver interno `garden.resolve_cycle_evidence(...)` no se expone públicamente, no firma URLs y no escribe datos.
- Las fotos siguen privadas. AI Check recibe sólo los bytes necesarios de la evidencia autorizada.
- `OPENAI_API_KEY` sólo existe como secret server-side. No se registran prompts completos, URLs firmadas, reasoning interno ni copias de imágenes para IA.
- Las propuestas AI son no canónicas, versionadas y auditables. Una sugerencia puede prellenar un flujo, pero nunca guardarlo automáticamente.

## Stack

- React 19, TypeScript 6, React Router 7.
- Vite 8 y `vite-plugin-pwa`.
- Supabase JS, Auth, PostgreSQL, Storage y Edge Functions.
- OpenAI Responses API, Structured Outputs y `store: false` para Garden AI.
- CSS propio, `lucide-react`, Vitest y Testing Library.
- Vercel con fallback SPA y GitHub Actions para verificación.

## Desarrollo local

### Requisitos

- Node.js 22 o superior.
- npm.
- Un proyecto Supabase con migraciones aplicadas.
- Una cuenta autorizada para las pruebas autenticadas.

```bash
npm ci
cp .env.example .env.local
```

Variables públicas del frontend:

```dotenv
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu-clave-publicable
VITE_GARDEN_AI_ENABLED=false
```

Para desarrollo normal, Garden AI puede permanecer desactivada. No añadas claves de OpenAI ni secretos de Supabase al cliente. Las variables server-side y el procedimiento de despliegue están en [docs/OPERATIONS_AND_DEPLOYMENT.md](docs/OPERATIONS_AND_DEPLOYMENT.md).

```bash
npm run dev
npm run typecheck
npm test -- --run
npm run lint
npm run build
```

Vite usa HTTPS local si existen certificados no versionados bajo `.dev-cert/`. Las pruebas de cámara, fotos y PWA deben hacerse en un contexto seguro compatible con el dispositivo.

## Verificación

GitHub Actions ejecuta en push y pull request:

```text
npm ci
npm run typecheck
npm test -- --run
npm run lint
npm run build
```

El último chequeo local de producto registró 79 pruebas Vitest correctas, junto con typecheck, lint, build y `git diff --check`. Las comprobaciones automatizadas no sustituyen la QA autenticada de Safari/iPhone ni una operación remota de Storage.

La lista de pruebas de uso real está en [docs/QA_FIELD_CHECKLIST.md](docs/QA_FIELD_CHECKLIST.md).

## Documentación

- [Estado actual](docs/PROJECT_STATUS.md)
- [Operación y despliegue](docs/OPERATIONS_AND_DEPLOYMENT.md)
- [Garden AI V1](docs/GARDEN_AI_V1_IMPLEMENTATION.md)
- [Estándar Garden AI v1](docs/GARDEN_AI_STANDARD_V1_PROPOSED.md)
- [Arquitectura de evidencia](docs/AI_EVIDENCE_CONTEXT_ARCHITECTURE.md)
- [Registro de fases y decisiones](docs/PHASE_01_TECHNICAL_DECISIONS.md)
- [Contrato de producto v1](PRODUCT_CONTRACT_V1_ES.md)

## AI-assisted development

El repositorio se desarrolló mediante un workflow AI-assisted para explorar el código, preparar cambios acotados y ejecutar verificaciones. Las decisiones de producto, datos, privacidad, semántica de evidencia y aceptación permanecen bajo revisión humana. La IA en runtime es una capacidad separada, limitada y explícitamente autorizada por Garden X.

## Licencia

Este repositorio no declara una licencia open source. El producto, marca, fotografías y datos permanecen sujetos a autorización de su propietario.
