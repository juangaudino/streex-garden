# Garden AI — Evidence / Context architecture

Garden X Core mantiene la fuente de verdad: Grow Cycles, eventos vigentes, invalidaciones, provenance, Control V2 y Attention. La capa de contexto compone evidencia mínima y autorizada; no decide hechos ni entrega contenido público.

## Frontera compartida

```text
Authorization by consumer
  → owner-scoped context wrapper
  → garden.resolve_cycle_evidence (internal)
  → consumer-specific delivery
```

La composición puede reutilizarse; la autorización no se unifica artificialmente.

- **AI Check / AI Compare:** autorización de dueño/sesión, ciclo y fotos explícitas. La función server-side obtiene sólo la rendition privada necesaria.
- **Ask Garden:** autorización de dueño/sesión y consultas canónicas acotadas: Control V2, Attention, germinación, cosechas, cambios, incidencias e historial limitado.
- **Guest Plant/Garden Story:** token revocable y contrato público específico. Sólo estas funciones generan URLs firmadas temporales de foto.

## Resolver interno

`garden.resolve_cycle_evidence(p_owner_id, p_grow_cycle_id, p_as_of, p_note_event_ids, p_historical_photo_ids)` es interno, estable y read-only. Valida owner/cycle, omite eventos invalidados o posteriores a `p_as_of`, y devuelve hechos estructurados con metadata privada de fotos. No tiene `EXECUTE` público, no llama modelos, no crea propuestas, no firma URLs y no escribe datos.

## Invariantes

- Un consumidor nunca recibe evidencia de otro owner.
- Una foto seleccionada no habilita una galería completa por defecto.
- Los datos confirmados prevalecen sobre notas, fotos e interpretación AI.
- Una ausencia de evidencia no se convierte en evidencia negativa.
- Historical Photos conservan checksum, provenance, precision temporal y mapping sin reinterpretación.

## Extensiones deliberadamente fuera de alcance

MCP, OAuth, Sofi/ChatGPT Bridge, autorización externa y proveedores adicionales requieren su propia decisión de autorización y privacidad. No deben ampliar permisos del resolver interno.
