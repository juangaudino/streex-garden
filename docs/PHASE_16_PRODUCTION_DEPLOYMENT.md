> **Registro histórico:** evidencia del primer despliegue. No describe por sí sola el runtime actual; consulta [PROJECT_STATUS.md](PROJECT_STATUS.md).

# Phase 16 — Publicación controlada

Fecha: 7 de septiembre de 2026

## Resultado

Streex Garden está publicado en [garden.getstreex.com](https://garden.getstreex.com). El repositorio remoto es privado y cada push a `main` ejecuta typecheck, pruebas, lint y build en GitHub Actions antes de que el cambio se considere verificado.

## Configuración aplicada

- Repositorio privado: `juangaudino/streex-garden`.
- Hosting: Vercel, con Node 22 y build Vite.
- Rutas SPA: `vercel.json` reescribe rutas internas a `index.html`.
- Dominio: `garden.getstreex.com`, configurado como CNAME DNS-only desde Cloudflare al destino específico indicado por Vercel.
- Auth: `Site URL` y única Redirect URL configuradas a `https://garden.getstreex.com`.
- Acceso: el cliente muestra sólo inicio de sesión; el registro público y acceso anónimo se desactivaron en Supabase.
- Variables de compilación: únicamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` como configuración pública del cliente. No se cargaron secretos de servidor ni credenciales de IA.

## Evidencia obtenida

- HTTPS externo respondió correctamente para Home y una ruta interna.
- GitHub Actions completó correctamente instalación, typecheck, 16 pruebas, lint y build para los commits publicados.
- En iPhone/Safari sobre el dominio definitivo: inicio de sesión, apertura de jardines, creación de observación con foto, aparición inmediata en Historial y persistencia tras recarga fueron confirmados manualmente.

## Estado operativo posterior

- Recuperación de contraseña sobre el dominio definitivo: comprobada.
- Backup diario independiente de base de datos y originales, retención de 30 días y restauración real aislada: comprobados en Phases 17–18.
- La prueba negativa de RLS y Storage con una segunda cuenta permanece como mantenimiento recomendado de uso real, no como bloqueo de publicación.
- Confirmación física de la orientación y numeración definitiva de ambos URUQ.
- IA permanece deliberadamente fuera de producción: no hay proveedor, credenciales ni llamadas activas.
