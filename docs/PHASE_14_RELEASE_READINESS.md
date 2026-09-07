# Phase 14 — Preparación para lanzamiento sin IA

Fecha: 7 de septiembre de 2026
Estado: preparación técnica completada; despliegue y operación externa pendientes.

## Alcance de esta fase

Esta fase no despliega la aplicación, no activa un proveedor de IA, no crea credenciales y no modifica el modelo de dominio. Su propósito es dejar explícitos los controles que deben estar listos antes de publicar Streex Garden.

## Comprobado en el proyecto

- La aplicación usa únicamente la URL y la Publishable Key de Supabase expuestas mediante variables `VITE_`; no contiene una `service_role`, una clave de IA ni otro secreto de servidor en el código cliente.
- `.env`, `.env.local` y variantes locales están excluidos de Git; `.env.example` conserva solamente marcadores de posición.
- Las fotografías se guardan en el bucket privado `garden-originals` y se acceden mediante URL firmada.
- La duración de una URL firmada se ajustó a **5 minutos**, conforme al Product Contract v1.
- Las rutas existentes requieren la sesión de la aplicación y no hay rutas de AI Check ni Ask Garden activas.
- `npm audit --omit=dev` no informó vulnerabilidades en dependencias de producción en esta revisión.
- La interfaz de acceso permite únicamente iniciar sesión; no expone creación de cuentas al público.

## Evidencia que sigue siendo local

Los controles anteriores no sustituyen una comprobación del proyecto alojado. No hay un entorno de producción desplegado ni una conexión autenticada de Supabase CLI en este equipo, por lo que esta fase no confirma la configuración remota ni el historial remoto de migraciones.

## Requisitos antes de desplegar

### Supabase

En el proyecto remoto se debe comprobar y configurar:

- Una única cuenta propietaria controlada; el alta pública por email debe permanecer desactivada.
- Recuperación de contraseña por email y sus URL de redirección finales.
- `Site URL` y las URL de redirección del dominio HTTPS definitivo.
- Bucket `garden-originals` privado, límite de tamaño acordado y políticas RLS activas para base de datos y Storage.
- Acceso con dos cuentas de prueba: cada una debe ver exclusivamente sus propios jardines, ciclos, eventos y fotografías.

### Copia de seguridad

El exportador dentro de la app sirve para que el propietario descargue sus datos; no es un respaldo operativo. Antes de lanzamiento se necesita una copia diaria de base de datos y Storage hacia un destino independiente y cifrado, con retención de 30 días y una prueba real de restauración.

La elección y autorización del destino de respaldo requieren intervención del propietario. No se ha elegido proveedor ni creado automatización para evitar introducir una dependencia o un costo sin decisión explícita.

### Hosting y dominio

El hosting debe proporcionar HTTPS, variables de entorno de compilación y fallback de SPA para las rutas de React. Al elegirlo se configurarán el dominio, las URL de Auth y una comprobación pública completa en navegador y en iPhone.

## Límites vigentes

- No hay proveedor ni funcionalidad de IA activa.
- No hay despliegue público, repositorio remoto ni credenciales de hosting creadas.
- La configuración remota de Auth, RLS, Storage y backups debe comprobarse sobre el proyecto real antes de publicar.
