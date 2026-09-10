> **Estado:** mapas configurables incorporados. Las instrucciones de aplicación sirven para entornos nuevos; no reaplicar SQL en producción sin reconciliar migraciones. Consulta [OPERATIONS_AND_DEPLOYMENT.md](OPERATIONS_AND_DEPLOYMENT.md).

# Phase 20 — Mapas físicos configurables

## Decisión técnica

El mapa físico se guarda como puntos (`garden.layout_sites`) y no como una propiedad visual de una planta. Un punto puede ser de cultivo o técnico. Las posiciones de cultivo conservan su identificador y su historial; nunca se renumeran al editar el equipo.

Cambiar un punto a técnico o retirarlo queda bloqueado mientras contenga un ciclo activo. Un punto técnico sin posición se puede convertir en cultivo: en ese momento recibe el siguiente número disponible. Las modificaciones se registran en `garden.layout_events` y se incluyen en la exportación del propietario.

## Layouts iniciales confirmados

- Jardín 1 / URUQ-8: `01 02` / `03 04 05` / `06 07 08` de atrás hacia el frente.
- Jardín 2 / URUQ-12: `01` / `02 03 04 05` / `06 07 08` / `09 10 11 12` de atrás hacia el frente.

Un jardín de otra marca comienza con `custom_grid` y se ajusta en **Editar sistema**. Los layouts conocidos de URUQ se asignan sólo cuando el sistema indicado es URUQ y la capacidad coincide.

## Aplicación y verificación

Aplicar primero la migración `20260908015856_phase20_configurable_physical_maps.sql` en Supabase y luego ejecutar `supabase/verification/phase20_verify_physical_maps.sql`. El despliegue de interfaz debe ocurrir después de que la migración termine correctamente.
