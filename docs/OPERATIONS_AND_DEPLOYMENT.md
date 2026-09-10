# Operación y despliegue

## Frontend

El frontend es una PWA Vite desplegada en `garden.getstreex.com`. Necesita sólo configuración pública de compilación:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
VITE_GARDEN_AI_ENABLED=true|false
```

`VITE_GARDEN_AI_ENABLED` controla la disponibilidad de los controles de IA en el cliente; no sustituye la comprobación server-side de la Edge Function.

## Runtime server-side

La función `garden-ai` requiere secretos configurados exclusivamente en Supabase Edge Functions:

```text
OPENAI_API_KEY
GARDEN_AI_ENABLED=true|false
GARDEN_AI_PROVIDER=openai
GARDEN_AI_ALLOWED_ORIGIN=https://garden.getstreex.com
```

Nunca añadir estas variables a `.env.local` del frontend, commits, builds ni capturas de QA. Las funciones de Guest y Garden AI usan Storage privado; las rutas de objetos y las signed URLs no forman parte de respuestas públicas permanentes.

## Desplegar una Edge Function

Desde la raíz del repositorio y con Supabase CLI autenticado:

```bash
supabase functions deploy garden-ai --project-ref sabulxbfdimoqnbgnmso
```

Verificar después:

```bash
supabase functions list --project-ref sabulxbfdimoqnbgnmso
```

La función debe permanecer con JWT obligatorio. No desactivar `verify_jwt` para depurar una consulta de IA.

## Migraciones

Las migraciones viven en `supabase/migrations/`. El historial remoto ha incluido pasos SQL aplicados manualmente, por lo que **no se debe ejecutar `supabase db push` a ciegas**. Antes de aplicar una migración:

1. Comparar la historia local y remota.
2. Revisar el SQL y su alcance.
3. Aplicar una migración nueva de forma explícita.
4. Ejecutar la consulta de verificación asociada cuando exista.
5. Registrar el resultado en el commit y, si aplica, en `PROJECT_STATUS.md`.

Las migraciones no deben modificar Historical Photos, eventos canónicos ni ciclos existentes salvo que su SQL lo declare y haya aprobación explícita.

## Validación antes de publicar

```bash
npm run typecheck
npm test -- --run
npm run lint
npm run build
git diff --check
```

Después de publicar, confirmar en un dispositivo real: inicio de sesión, foto desde biblioteca, foto desde cámara, foto privada ya guardada, Historias compartidas, una operación de seguimiento y una consulta Ask Garden. Los checks locales no sustituyen esa validación autenticada.

## Recuperación y backups

Los workflows de backup/restauración están documentados en [PHASE_17_BACKUP_RUNBOOK.md](PHASE_17_BACKUP_RUNBOOK.md). Restaurar siempre a un proyecto aislado; nunca sobre producción. La exportación de propietario dentro de Garden X es una herramienta de recuperación manual, no el backup operativo.
