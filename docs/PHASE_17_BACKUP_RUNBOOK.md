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

Los event triggers internos de Supabase se omiten durante la restauración: pertenecen a la plataforma del proyecto de destino, no al dominio Garden, y el rol de conexión no puede reemplazarlos. El proyecto aislado conserva sus componentes base de Supabase; el workflow elimina solo el esquema `garden` y los metadatos de `garden-originals` antes de reponer el snapshot.
