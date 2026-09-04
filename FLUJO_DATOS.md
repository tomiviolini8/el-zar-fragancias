# 🗂️ Datos y fotos — El Zar de las Fragancias

## Modelo: Airtable es la fuente de verdad; la web se sincroniza desde ahí

- **Airtable** = tu panel: editás textos/precios y **subís las fotos** de cada perfume.
- **La web** es estática y rápida. Cuando querés publicar cambios, se **sincroniza**:
  se leen los datos de Airtable, se bajan las fotos y se regenera el catálogo del sitio.
- Mientras un perfume no tenga foto, la tarjeta muestra un **placeholder de marca**
  (corona dorada sobre fondo oscuro) sin romperse.

```
Airtable (base "El Zar de las Fragancias")
   │  pull (sincronización)
   ▼
data/productos.js + assets/productos/*   →   la landing (index.html + app.js)
```

## Base `El Zar de las Fragancias` (tabla **Perfumes**)

| Campo | Tipo | Nota |
|-------|------|------|
| **Codigo** | Texto | Clave única (ej. BF335) |
| Nombre | Texto | |
| **Foto** | Adjunto | Arrastrás la imagen validada acá |
| **Foto URL** | URL | Alternativa: link directo (tiene prioridad sobre el adjunto) |
| Precio · Precio regular | Moneda $ | Precio regular vacío = sin oferta |
| Descuento % | Número | |
| Descripcion | Texto largo | |
| Inspirado en · Marca | Texto | |
| Formato · Familia olfativa | Texto | |
| Genero · Linea · Ocasion | Selección | |
| Es arabe | Checkbox | |
| Categorias · Etiquetas | Multi-selección | |
| Pagina | Número | |
| Publicar | Checkbox | Solo se muestran los tildados |

## Puesta en marcha

1. **Token de Airtable** (crear PAT en https://airtable.com/create/tokens; scopes
   `data.records:read`, `data.records:write`, `schema.bases:read`; acceso a la base).
   Copiar `scripts/.env.example` → `scripts/.env` y pegar el token en `AIRTABLE_TOKEN`.
2. **Cargar los 262** (una vez): `python scripts/airtable_sync.py seed`
   (deja las fotos vacías → placeholder).
3. Podés **borrar el token** después: las sincronizaciones siguientes las hago yo con mi
   propia conexión.

## Uso diario

1. Editás en Airtable y **subís las fotos** de los perfumes.
2. Sincronizar la web (bajar datos + fotos y regenerar el catálogo):
   ```bash
   python scripts/airtable_sync.py pull
   git add -A && git commit -m "Sync catálogo desde Airtable" && git push
   ```
   (o me pedís a mí que sincronice y lo hago con mi conexión).

## Comandos

```bash
python scripts/airtable_sync.py check   # verifica el token y cuenta registros
python scripts/airtable_sync.py seed    # carga inicial de los 262 (sin fotos)
python scripts/airtable_sync.py pull    # Airtable -> web (datos + fotos + placeholders)
```

## Placa para Instagram / landing
Botón de Instagram en cada tarjeta → modal → **Descargar PNG** (Post 1080×1080 o Story
1080×1920). Estilo de marca. Código en `js/app.js` (`drawCard` + helpers; contacto en `PLACA`).
