> **Registro operativo histórico:** el diseño y simulacro se conservaron como evidencia. Antes de operar, revisar secretos y destino vigentes conforme a [OPERATIONS_AND_DEPLOYMENT.md](OPERATIONS_AND_DEPLOYMENT.md).

# Phase 17 — Backup operativo

## Diseño

GitHub Actions genera una instantánea UTC diaria en R2:

- `database/YYYY-MM-DD/database.dump`: dump lógico de PostgreSQL.
- `storage/YYYY-MM-DD/garden-originals/`: copia completa de originales privados.
- `manifests/YYYY-MM-DD/storage-manifest.json`: listado de objetos fuente.

Cada fecha es independiente. Una foto existente no se modifica en Supabase y la instantánea conserva la copia de ese día. La retención se configura en R2 a 30 días para los tres prefijos.

## Secretos requeridos

Todos residen como Repository secrets en GitHub: `SUPABASE_DB_URL`, las cuatro variables S3 de Supabase y `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`.

No se escriben en logs, repositorio, Vercel ni cliente web.

## Ejecución

La tarea se programa diariamente a las 07:17 UTC y puede iniciarse desde Actions con `Run workflow`.

## Primera verificación

El 8 de septiembre de 2026 (UTC), la ejecución manual `Garden backup` terminó correctamente en GitHub Actions. El flujo generó el dump, copió el bucket privado de originales y escribió el manifiesto; además verificó en R2 la presencia de `database.dump` y `storage-manifest.json` antes de finalizar.

## Restauración

Restaurar primero el dump en un proyecto aislado y después copiar el prefijo de Storage de la misma fecha al bucket privado restaurado. Confirmar tablas, conteos, un objeto y su referencia en el manifiesto. No restaurar directamente sobre producción.

El workflow manual `Garden restore drill` exige una fecha y la confirmación literal `RESTORE-YYYY-MM-DD`. Rechaza por código el proyecto de producción y compara cada ruta y tamaño del manifiesto con los objetos restaurados.

Los event triggers internos de Supabase se omiten durante la restauración: pertenecen a la plataforma del proyecto de destino, no al dominio Garden, y el rol de conexión no puede reemplazarlos. El proyecto aislado conserva sus componentes base de Supabase; cada simulacro requiere un proyecto de destino nuevo y el workflow elimina solo el esquema `garden` antes de reponer el snapshot.

## Simulacro comprobado

El 8 de septiembre de 2026 (UTC), `Garden restore drill` restauró correctamente el snapshot `2026-09-08` en el proyecto aislado. La verificación comparó cada ruta y tamaño del manifiesto fuente con el destino y confirmó 2 jardines, 9 fotos y 7 objetos en `garden-originals`. Los avisos de objetos internos ya presentes en Supabase se registraron como conflictos de plataforma esperados; las verificaciones de dominio y Storage terminaron correctamente.

## Retiro de OLD: respaldo canónico pendiente

El simulacro y el workflow descritos arriba corresponden al respaldo anterior de Supabase Storage `garden-originals`; no prueban que la base canónica actual ni el bucket R2 de Production puedan restaurarse. El workflow actualizado de `Garden Production backup` toma el dump de `fnhggqqnkhkrfwmnsqmy`, incluye los registros de `auth.users` y el conteo de jardines/fotos, copia `garden-x-production-media` a una instantánea única en `streex-garden-backups`, guarda checksums e inventario y verifica los bytes copiados. No elimina ni modifica objetos de origen.

El dump canónico conserva las ACL PostgreSQL. El manifest también contiene una huella del esquema de `garden` y `auth` —incluidas políticas y privilegios—, además de filas y SHA-256 por tabla. El simulacro vuelve a calcular estas huellas, conteos y datos tras restaurar. Eso compara IDs, asociaciones y metadatos sin publicar filas personales. Las URL de conexión solo se convierten en archivos de servicio libpq locales con permisos `0600`; no se pasan como argumentos a `psql`, `pg_dump` o `pg_restore`.

Antes de habilitar el workflow, configurar en GitHub Actions:

- Secrets `PRODUCTION_SUPABASE_DB_URL`, `SUPABASE_CONFIG_READ_TOKEN`, `PRODUCTION_R2_ENDPOINT`, `PRODUCTION_R2_ACCESS_KEY_ID` y `PRODUCTION_R2_SECRET_ACCESS_KEY`; el token Supabase necesita únicamente `auth_config_read` para Production y el destino aislado; el token R2 solo necesita lectura en `garden-x-production-media`.
- Variable `PRODUCTION_R2_BUCKET` con `garden-x-production-media`.
- The existing repository secrets `R2_ENDPOINT`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are used for the backup destination; the previous backup workflow already used them with `streex-garden-backups`. The updated workflow first checks both buckets using list-only requests, before any database dump or upload.
- Variable `BACKUP_R2_BUCKET` con `streex-garden-backups`.
- Para el simulacro, secret `RESTORE_TARGET_SUPABASE_DB_URL` y variable `RESTORE_TARGET_PROJECT_REF` de un proyecto desechable y aislado. El workflow rechaza OLD y Production.

El dump incluye las filas de Auth y datos de Garden que viven en PostgreSQL. La instantánea guarda además la respuesta de `GET /v1/projects/{ref}/config/auth` (incluidos secretos de proveedores y SMTP cuando la API los devuelve) en el bucket independiente, con checksum y sin imprimirla en logs. El simulacro compara su checksum con el proyecto aislado y no aplica cambios a Production.

El respaldo canónico y su restauración siguen **sin verificar** hasta que una ejecución nueva de ambos workflows termine correctamente y se compare el manifest completo en el proyecto aislado. El éxito del workflow legado del 8 de septiembre de 2026 no satisface este requisito.
