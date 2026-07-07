# Alternativas Low-Code al Flujo de Publicación (sin Cloudflare Workers)

## Contexto

Actualmente, StartupPerks usa un Cloudflare Worker para recibir envíos del formulario y crear PRs en GitHub. Esto implica:

- Mantener un Worker en TypeScript (~340 líneas)
- Gestionar un token de GitHub con permisos de escritura
- Desplegar y monitorear el Worker
- Manejar la superficie de seguridad asociada

**Objetivo:** Eliminar completamente el Worker y reemplazarlo con soluciones low-code o no-code que requieran mínimo mantenimiento.

---

## Criterios de Evaluación

| Criterio | Descripción |
|----------|-------------|
| **Sin infraestructura propia** | No mantener Workers, servidores, ni bases de datos |
| **Sin código backend** | Configuración visual o máximo un `<form>` HTML |
| **Gratuito o casi gratuito** | Tier gratuito suficiente para el volumen esperado |
| **Notificaciones al equipo** | Cómo se entera el equipo de nuevos envíos |
| **Revisión cómoda** | Dónde y cómo el equipo revisa y procesa envíos |
| **Embebible en Astro** | Se puede integrar en el modal actual sin perder UX |

---

## Alternativas

### 1. Tally.so (Recomendada)

Tally es un creador de formularios gratuito, ilimitado y potente. Similar a Typeform pero sin límite de respuestas en el tier gratuito.

**Cómo funciona:**
1. Creas el formulario en Tally (drag & drop, 5 minutos)
2. Lo embebes en el modal de Astro con un `<iframe>` o enlace
3. Las respuestas llegan al panel de Tally
4. Tally notifica por email cada nuevo envío
5. El equipo revisa en el panel de Tally (o exporta a CSV/Sheets)

**Ventajas:**
- **Gratuito e ilimitado** — sin límite de respuestas ni formularios
- Sin marca Tally (se puede quitar el branding)
- Lógica condicional (mostrar/ocultar campos según respuestas)
- Validación de campos integrada (URL, email, regex)
- Notificaciones por email al instante
- Exportación a CSV, Google Sheets, Notion
- Embebible con diseño personalizable
- Cumple GDPR (datos en Europa)

**Desventajas:**
- El formulario se carga en un iframe (pequeña pérdida de control visual)
- Dependencia de un servicio externo
- Las notificaciones son solo email en el tier gratuito

**Integración en Astro — paso a paso:**

1. Crea el formulario en [tally.so](https://tally.so) (arrastrando los campos que necesites).

2. En el editor de Tally, ve a **Share** → **Embed** → copia el enlace estándar. Tiene esta forma:

   ```
   https://tally.so/r/abc123
   ```

3. Para embeberlo como popup (recomendado — reemplaza el modal actual sin perder usabilidad):

   ```html
   <!-- Botón que abre el formulario de Tally como popup -->
   <button data-tally-open="abc123" data-tally-hide-title="1" data-tally-width="480">
     Enviar un perk
   </button>

   <!-- Script del SDK de Tally -->
   <script is:inline src="https://tally.so/widgets/embed.js"></script>
   ```

   Así se comporta igual que el modal actual: el usuario hace clic, se abre un popup sobre el sitio, completa el formulario, y al cerrar vuelve a la página.

4. También puedes embeberlo inline (iframe dentro del modal existente). Obtén el código desde **Share** → **Embed** → **Inline**:

   ```html
   <iframe
     data-tally-src="https://tally.so/embed/abc123?hideTitle=1&transparentBackground=1"
     width="100%"
     height="500"
     frameborder="0"
     style="border: none;"
     title="Enviar un perk"
   ></iframe>

   <!-- Necesario para carga lazy del iframe -->
   <script is:inline src="https://tally.so/widgets/embed.js"></script>
   ```

5. Para que Tally notifique al equipo: en el editor del formulario, ve a **Settings** → **Notifications** → agrega los emails del equipo.

**Nota:** `abc123` en los ejemplos de arriba es un ID de formulario de ejemplo. Al crear tu formulario en Tally, la URL real contendrá tu ID. No uses `{formId}` literalmente — Tally genera un ID real automáticamente al crear el formulario y lo verás en la URL del editor y en la sección de Share.

---

### 2. Google Forms + Google Sheets

El clásico. Google Forms es gratuito, ilimitado y las respuestas van directo a Google Sheets.

**Cómo funciona:**
1. Creas un Google Form con los campos del perk
2. Las respuestas se guardan automáticamente en Google Sheets
3. Configuras notificaciones por email en el Sheet (Tools → Notification rules)
4. El equipo revisa la hoja de cálculo
5. Opcional: usas Google Apps Script para automatizar (ej. enviar email, crear Issue)

**Ventajas:**
- **Completamente gratuito e ilimitado**
- Google Sheets es una "base de datos" visual que todos saben usar
- Sin dependencia de startups que puedan desaparecer
- Se puede automatizar con Google Apps Script (gratuito)
- Posibilidad de añadir columnas de estado (Pendiente, Aprobado, Rechazado)
- Exportable, filtrable, ordenable

**Desventajas:**
- Diseño del formulario limitado (no se ve tan profesional como Tally)
- Embebido en iframe con branding de Google
- Google Apps Script tiene límites (pero generosos para este caso de uso)
- Las notificaciones por email requieren configuración manual en Sheets

**Integración en Astro:**
```html
<iframe
  src="https://docs.google.com/forms/d/e/{formId}/viewform?embedded=true"
  width="100%"
  height="600"
  frameborder="0"
  style="border: none;"
  title="Enviar un perk"
></iframe>
```

---

### 3. GitHub Issue Forms

GitHub tiene un sistema de plantillas de Issues con formularios YAML. El usuario llena un formulario y se crea un Issue estructurado.

**Cómo funciona:**
1. Creas `.github/ISSUE_TEMPLATE/submit-perk.yml` en el repositorio
2. El formulario define campos con validación (requerido, tipo, opciones)
3. El usuario hace clic en "New Issue" → elige la plantilla → llena el formulario
4. Se crea un Issue con los datos estructurados
5. El equipo revisa Issues etiquetados como `submission`

**Ventajas:**
- **Cero infraestructura** — todo vive en GitHub
- Sin token, sin Worker, sin base de datos
- Validación de campos integrada en el YAML
- Issues son el mecanismo natural de revisión
- Notificaciones de GitHub integradas (watch del repo)
- Labels automáticos para organizar

**Desventajas:**
- El usuario necesita cuenta de GitHub para enviar
- El formulario está en GitHub, no en el sitio (se pierde la integración visual)
- No se puede embeber en el modal de Astro
- Solo se puede enlazar: "¿Quieres enviar un perk? Abre un Issue aquí"

**Ejemplo de `.github/ISSUE_TEMPLATE/submit-perk.yml`:**
```yaml
name: Enviar Perk
description: Envía un nuevo beneficio para startups al directorio
title: "[submission] "
labels: ["submission", "pending-review"]
body:
  - type: input
    id: company
    attributes:
      label: Empresa
      placeholder: ej. Stripe
    validations:
      required: true
  - type: dropdown
    id: perkType
    attributes:
      label: Tipo de beneficio
      options:
        - credit
        - discount
        - trial
        - mixed
    validations:
      required: true
  - type: input
    id: amountDisplay
    attributes:
      label: Valor (mostrado)
      placeholder: ej. $50,000
    validations:
      required: true
  - type: textarea
    id: eligibility
    attributes:
      label: Elegibilidad
      placeholder: ej. Para startups en etapa Seed...
    validations:
      required: true
  - type: dropdown
    id: categories
    attributes:
      label: Categoría principal
      options:
        - AI
        - Cloud
        - Developer Tools
        - Payments
        - Fintech
        - Security
        - Marketing
        - Sales
        - Productivity
    validations:
      required: true
  - type: dropdown
    id: fundingStages
    attributes:
      label: Etapa mínima
      options:
        - Bootstrap
        - Seed
        - Series A
        - Series B+
    validations:
      required: true
  - type: input
    id: url
    attributes:
      label: URL del programa
      placeholder: https://...
    validations:
      required: true
```

**Integración en Astro:**
```html
<a href="https://github.com/{owner}/{repo}/issues/new?template=submit-perk.yml" 
   class="button button-primary" 
   target="_blank">
  Enviar un perk
</a>
```

---

### 4. Netlify Forms

Si el sitio se despliega en Netlify, el manejo de formularios viene incluido sin configuración adicional.

**Cómo funciona:**
1. Agregas `data-netlify="true"` a un `<form>` HTML en tu sitio Astro
2. Netlify detecta el formulario en el build y lo registra
3. Las submissions llegan al panel de Netlify
4. Netlify notifica por email, Slack, o webhook
5. El equipo revisa en el panel de Netlify

**Ventajas:**
- **Literalmente una línea de código** — `netlify` en el form
- Sin Worker, sin API, sin backend
- Notificaciones integradas (email, Slack, webhooks salientes)
- Panel de revisión limpio con filtros
- Spam filtering integrado (Netlify usa honeypot automático)
- Tier gratuito: 100 submissions/mes
- Se puede integrar con Netlify Functions si luego quieres automatizar

**Desventajas:**
- **Requiere desplegar en Netlify** (cambiarse de Cloudflare Pages si es el caso)
- Límite de 100 submissions/mes en tier gratuito
- El formulario debe estar en el HTML estático (no en un modal dinámico — funciona pero requiere `data-netlify="true"` en el HTML pre-renderizado)

**Integración en Astro:**
```html
<form name="submit-perk" method="POST" data-netlify="true" netlify-honeypot="website">
  <input type="hidden" name="form-name" value="submit-perk" />
  
  <input name="company" required placeholder="Empresa" />
  <select name="perkType" required>
    <option value="credit">Credit</option>
    <option value="discount">Discount</option>
  </select>
  <input name="amountDisplay" required placeholder="$50,000" />
  <textarea name="eligibility" required></textarea>
  <select name="categories" required>...</select>
  <select name="fundingStages" required>...</select>
  <input name="url" type="url" required />
  
  <!-- Honeypot (oculto con CSS) -->
  <input name="website" tabindex="-1" autocomplete="off" style="display:none" />
  
  <button type="submit">Enviar</button>
</form>
```

---

### 5. Formspree

Servicio de backend de formularios. Creas un endpoint y apuntas tu `<form>` a él.

**Cómo funciona:**
1. Creas una cuenta en Formspree, obtienes un endpoint URL
2. El `<form>` del sitio hace `action="https://formspree.io/f/{formId}" method="POST"`
3. Formspree recibe, valida, y almacena
4. Notifica por email
5. Panel de revisión en Formspree

**Ventajas:**
- Funciona con cualquier hosting (sin depender de Netlify/Vercel)
- Tier gratuito: 50 submissions/mes
- Spam filtering (honeypot + reCAPTCHA)
- Redirección a URL de confirmación personalizada
- Validación de email y patrones

**Desventajas:**
- Límite bajo en tier gratuito (50/mes)
- Marca Formspree en tier gratuito
- Panel de revisión básico

---

### 6. Airtable + Airtable Forms

Airtable es una base de datos visual con formularios integrados.

**Cómo funciona:**
1. Creas una base en Airtable con los campos del perk
2. Habilitas el "Form view" que genera un formulario público
3. Las submissions van directo a la base de Airtable
4. El equipo revisa en Airtable (interfaz tipo spreadsheet pero más potente)
5. Notificaciones por email o integración con Slack

**Ventajas:**
- Interfaz de revisión excelente (filtros, vistas, agrupaciones)
- Posibilidad de añadir campos de estado y asignar a miembros del equipo
- Automatizaciones integradas (ej. al cambiar estado a "Aprobado", enviar email)
- Embebible en iframe
- Tier gratuito: 1,000 registros por base, 100 submissions/mes

**Desventajas:**
- Límite de registros en tier gratuito (1,000)
- Más complejo de lo necesario para este caso de uso
- Dependencia de un servicio que podría cambiar precios

---

### 7. FormKeep

Backend de formularios con panel de revisión visual.

**Cómo funciona:**
1. Creas un formulario en FormKeep, obtienes un endpoint
2. Apuntas tu `<form>` a ese endpoint
3. FormKeep recibe, valida, y muestra en panel
4. Notificaciones por email, Slack, webhook

**Ventajas:**
- Panel de revisión con estados (New, Reviewed, Archived)
- Spam filtering
- Exportación a CSV
- Webhooks para automatización

**Desventajas:**
- Tier gratuito limitado o inexistente (desde $4.99/mes)
- No justifica el costo para este volumen

---

## Tabla Comparativa

| Alternativa | Código | Infraestructura | Gratis ilimitado | Revisión cómoda | Embebible | Notificaciones |
|-------------|--------|-----------------|------------------|-----------------|-----------|----------------|
| **Tally.so** | 0 líneas | 0 | Sí | ★★★★☆ | iframe | Email |
| **Google Forms** | 0 líneas | 0 | Sí | ★★★★☆ | iframe | Email |
| **GitHub Issue Forms** | 1 archivo YAML | 0 | Sí | ★★★★★ | No (enlace) | GitHub notifs |
| **Netlify Forms** | `<form>` HTML | 0* | 100/mes | ★★★★☆ | Nativo | Email + Slack |
| **Formspree** | `<form>` HTML | 0 | 50/mes | ★★★☆☆ | Nativo | Email |
| **Airtable** | 0 líneas | 0 | 1,000 registros | ★★★★★ | iframe | Email + Slack |

*Requiere hosting en Netlify.

---

## Recomendaciones

### Opción A: Máxima simplicidad (recomendada)

**GitHub Issue Forms** — si puedes aceptar que el envío ocurra en GitHub en lugar del sitio.

- Cero infraestructura, cero costo, cero mantenimiento
- 1 archivo YAML de ~50 líneas
- El equipo ya está en GitHub, es su herramienta natural
- Issues son trazables, etiquetables, asignables
- Cambiar el botón "Submit Perk" en el modal por un enlace al Issue form

### Opción B: Embebido sin código

**Tally.so** — si quieres mantener el formulario embebido en el sitio.

- 5 minutos de configuración visual
- El `<iframe>` reemplaza al modal actual
- Gratuito e ilimitado
- Notificaciones por email a todo el equipo

### Opción C: Si ya estás en Netlify

**Netlify Forms** — literalmente una línea de código.

- Agregar `data-netlify="true"` al form existente
- Eliminar el Worker completamente
- Panel de revisión en Netlify con notificaciones

---

## Comparativa con el flujo actual

| Aspecto | Flujo Actual (Worker + PR) | GitHub Issue Forms | Tally.so | Netlify Forms |
|---------|---------------------------|-------------------|----------|---------------|
| Código a mantener | ~340 líneas TS + wrangler.toml | 1 archivo YAML | 0 líneas | `<form>` HTML |
| Infraestructura | Cloudflare Worker | 0 | 0 | Netlify |
| Costo mensual | $0 (tier gratuito Worker) | $0 | $0 | $0 |
| Seguridad | Token GitHub con write | Cuenta GitHub del usuario | 0 | 0 |
| Riesgo de rotura | API GitHub, expiración token | 0 | Tally caído | Netlify caído |
| Revisión por el equipo | PRs en GitHub | Issues en GitHub | Panel Tally | Panel Netlify |
| Tiempo hasta publicar | 5 min (revisar PR + merge) | ~10 min (crear .md manual) | ~10 min (crear .md manual) | ~10 min (crear .md manual) |

**Conclusión:** Cualquiera de las opciones elimina la complejidad del Worker, el token de GitHub con permisos de escritura, y el riesgo de la API de GitHub. A cambio, el equipo dedica 5-10 minutos extra por envío para crear manualmente el archivo `.md`. Para el volumen actual de envíos de StartupPerks, esa compensación es claramente favorable.

La decisión principal es: **¿el formulario debe estar en el sitio (Tally/Netlify) o puede estar en GitHub (Issue Forms)?**
