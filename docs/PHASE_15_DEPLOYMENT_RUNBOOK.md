> **Registro histórico:** este runbook preparó el primer despliegue. Para procedimiento vigente consulta [OPERATIONS_AND_DEPLOYMENT.md](OPERATIONS_AND_DEPLOYMENT.md).

# Phase 15 — Despliegue controlado y respaldo operativo

## Estado

La aplicación está preparada para un repositorio Git y para cualquier hosting estático compatible con Vite. Esta fase no publica una URL ni crea cuentas de servicios externos.

## Lo que queda preparado

- El repositorio incluye una verificación para GitHub Actions con Node 22: instalación reproducible, typecheck, pruebas, lint y build.
- El build PWA tiene `navigateFallback` a `index.html`, por lo que el hosting debe servir ese archivo para rutas como `/garden/:gardenId` y `/cycle/:cycleId`.
- Las únicas variables de build requeridas son `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Son datos públicos de cliente; nunca se debe cargar una `service_role` ni una clave de IA.
- La pantalla de acceso admite únicamente inicio de sesión. El alta de nuevas cuentas no está expuesta desde la aplicación.

## Pasos al elegir hosting

1. Crear el repositorio remoto privado y publicar el commit inicial.
2. Conectar el repositorio al hosting elegido.
3. Configurar Node 22 y el comando `npm run build`; publicar `dist/`.
4. Configurar fallback SPA a `/index.html` para cualquier ruta no estática.
5. Definir las dos variables `VITE_` en el entorno de compilación del hosting.
6. Publicar primero en una URL HTTPS de prueba.
7. Configurar esa URL en Supabase Auth como `Site URL` y URL de redirección permitida.
8. Comprobar inicio de sesión, recarga de una ruta interna, actualización PWA, carga de foto, acceso a foto firmada, cierre de sesión y aislamiento entre dos cuentas de prueba.
9. Sólo después, asociar el dominio definitivo y repetir las comprobaciones sobre él.

## Supabase antes de publicar

- Desactivar el registro público por email en el proyecto remoto.
- Mantener desactivado el acceso anónimo.
- Configurar recuperación de contraseña y probarla sobre la URL HTTPS final.
- Verificar RLS y Storage con dos cuentas de prueba, incluida la negativa: una cuenta no puede leer datos ni objetos de la otra.
- Confirmar que `garden-originals` sigue privado y que las URLs firmadas vencen a los cinco minutos.

## Respaldo operativo antes de lanzamiento público

1. Elegir un destino independiente y cifrado para la copia de base de datos y Storage.
2. Configurar una copia diaria con retención de 30 días.
3. Restaurar una copia en un entorno aislado y verificar jardines, eventos y un original de foto.
4. Registrar quién recibe una alerta si falla la copia.

La exportación desde Control sirve para recuperación manual del propietario; no cubre este proceso.

## Evidencia que faltará tras el despliegue

El build y las pruebas locales no demuestran comportamiento público. Tras publicar se hará una validación en Safari de Mac y la PWA de iPhone sobre HTTPS, con el proyecto Supabase remoto y las configuraciones finales activas.
