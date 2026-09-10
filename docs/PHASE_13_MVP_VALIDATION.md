> **Registro histórico:** esta fase validó deliberadamente el núcleo sin IA. Garden AI V1 se implementó después; consulta [PROJECT_STATUS.md](PROJECT_STATUS.md).

# Phase 13 — Validación MVP sin IA

**Estado:** cerrada. Esta fase validó el núcleo manual y documentó la evidencia. AI Check y Ask Garden permanecen deliberadamente fuera de ejecución: no hay proveedor, credenciales ni llamadas de IA configuradas.

## Límites verificados en código

- La app expone únicamente rutas manuales autenticadas: Jardines, Jardín, Ciclo, Hoy, Mantenimiento, Control, Importar historia y Comparar fotos.
- El cliente utiliza sólo la clave publicable de Supabase. No hay `service_role`, clave de proveedor IA, gateway IA ni llamadas a modelos en `src/`.
- Al cerrar esta fase los mapas eran listas provisionales. La geometría real confirmada de los URUQ se incorpora posteriormente en Phase 20.
- Recomendaciones y contradicciones de importación no pueden crear eventos; una observación requiere ciclo, fecha exacta y confirmación separada.
- El viewport móvil fija escala 1 por decisión del producto. Los grupos de botones, encabezados, historial y avisos se ajustan o envuelven bajo 420 px para evitar desbordes horizontales.
- Un recorrido de mantenimiento abierto bloquea la creación de otro. Jardines y Jardín muestran `Reanudar` en vez de intentar iniciar uno nuevo; Jardines permite cancelar de forma explícita, preservando las revisiones u omisiones ya registradas.

## Evidencia ya obtenida

| Área | Evidencia | Estado |
|---|---|---|
| Observación, JPEG/HEIC y PWA | Registro real en iPhone, conservación de original recibido, recarga e instalación PWA. | Aprobado en fases 2 y 5. |
| Sync y borradores | Modo avión, reintento y confirmación remota de fotografía verificados en iPhone. | Aprobado en fase 5. |
| Ciclos e historial | Acciones, correcciones, ocupaciones e historial revisados contra consultas remotas. | Aprobado en fases 3 y 4. |
| Comparación | Dos originales confirmados comparados en iPhone, con fechas visibles. | Aprobado en fase 6. |
| Home, Atención, Control y mantenimiento | Separación de Home, tarea manual, pausa/reanudación y semántica de Omitir verificadas en iPhone. Phase 13 confirmó que un recorrido existente se reanuda sin crear uno nuevo. | Aprobado en fases 7–9 y Phase 13. |
| Exportación | CSV y JSON descargables probados; el JSON recibido conserva las secciones esperadas. | Aprobado en fase 11. |
| Importación selectiva | Candidato confirmado sólo tras confirmación explícita; evento, ciclo y fecha civil comprobados por SQL y PWA. El acceso desde la importación abrió el ciclo exacto. | Aprobado en fases 12 y 13. |
| Publicación | En `garden.getstreex.com`: HTTPS, rutas internas, inicio de sesión, apertura de jardines, observación con foto, Historial y recarga confirmados desde iPhone/Safari. | Aprobado en fase 16. |
| Calidad local | Typecheck, 16 pruebas Vitest, lint, build y `git diff --check`. | Aprobado localmente. |

## Tanda única pendiente para iPhone/PWA

Ejecutar esta tanda sobre datos de prueba o acciones reales pertinentes. No crear una intervención física sólo para probar.

1. **Recorrido manual breve:** abrir Jardines, entrar al ciclo de Cebollín, comprobar historial y foto, crear una observación de prueba sin foto y confirmar su aparición tras recarga.
2. **Acciones de ciclo:** usar una acción reversible sobre datos de prueba, verificar que el historial se actualiza y que invalidar exige una razón; no invalidar una evidencia real útil sólo por esta prueba.
3. **Mantenimiento:** iniciar ambos jardines, revisar una posición, omitir otra, pausar, cerrar la PWA y reanudar. Confirmar que Jardín + Posición permanecen visibles y que Omitir no aparece como revisión.
4. **Atención:** crear una tarea manual, verla en Jardines y Hoy, posponerla y comprobar el mismo estado en ambas vistas.
5. **Comparación:** abrir dos fotos ya cargadas, comparar y verificar fecha de captura/estado desconocido visibles para ambas imágenes.
6. **Importación:** abrir el candidato confirmado y su enlace directo al ciclo; verificar fecha civil y `Hora no registrada`. No crear un segundo candidato idéntico.
7. **Aislamiento:** con la segunda cuenta, intentar abrir Jardines, Control e Importar historia. Deben quedar vacíos y sin fotos, eventos o candidatos de la cuenta propietaria.
8. **Cierre de sesión:** sin borradores, cerrar sesión y confirmar que no reaparecen datos de la cuenta anterior. Conservar la prueba de borradores pendientes para una sesión separada; no descartar datos que se quieran preservar.
9. **PWA y accesibilidad:** con zoom de iPhone aumentado, comprobar controles principales, texto de estados y la actualización PWA. Verificar que los estados siguen comprendibles sin depender sólo del color.
10. **Visual:** revisar Home, Garden, Cycle, Today, Maintenance, History/Compare y Control en móvil; revisar Home/Cycle/Control en tablet o escritorio. La decisión pendiente es fidelidad de Living Botanical Cinema, no una nueva dirección visual.

## Diferido o pendiente de decisión de producto

- Mapas físicos definitivos: falta orientación/numeración confirmada de ambos URUQ.
- Backups de datos y originales: ya cuentan con backup diario y restauración aislada comprobada en Phases 17–18.
- Recuperación de cuenta/Auth de producción y prueba completa de aislamiento de Storage: requieren la tanda de dispositivo/cuenta secundaria.
- AI Check, Ask Garden, piloto de IA, retención de chat y presupuesto: deliberadamente diferidos hasta elegir proveedor y autorizar gasto.
- Guest Plant Story: aprobado como iniciativa futura posterior al Historical PHOTOS. Será un enlace revocable de solo lectura para un Grow Cycle, con fotografías, fechas, eventos y notas seleccionadas; no habilitará acceso al resto de la cuenta ni edición multiusuario.

## Actualización posterior al cierre

La publicación, el backup diario independiente y el simulacro de restauración aislado se completaron posteriormente en Phases 16–18. La tanda de uso real queda como mantenimiento operativo, no como bloqueo del MVP desplegado.

## Resultado de salida de esta fase

El núcleo manual puede evaluarse sin IA. Esta fase no declara el MVP completo ni sustituye las verificaciones de producción, backup o IA requeridas por el Product Contract.
