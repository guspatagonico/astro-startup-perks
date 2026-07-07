# Alternativas al Flujo de Publicación vía GitHub PR

## Situación Actual

El flujo actual de envío de perks funciona así:

1. Usuario llena el formulario en la web
2. El Worker de Cloudflare valida los datos
3. El Worker crea una rama en GitHub, sube un archivo `.md` y abre un PR borrador
4. El equipo de desarrollo revisa el PR, lo edita si es necesario, y hace merge

**Problema:** Este flujo requiere un token de GitHub con permisos de escritura, manejo de ramas, creación de blobs, y comunicación con la API de GitHub. Es frágil (si el token expira, si GitHub cambia la API, si hay conflictos de rama) y conlleva riesgos de seguridad (ver `INFORME_SEGURIDAD.md`).

---

## Criterios de Evaluación

Cada alternativa se evalúa según:

| Criterio | Descripción |
|----------|-------------|
| **Simplicidad** | ¿Qué tan fácil es implementar y mantener? |
| **Seguridad** | ¿Reduce la superficie de ataque respecto al flujo actual? |
| **UX del usuario** | ¿La experiencia de envío sigue siendo fluida? |
| **Carga para el equipo dev** | ¿Cuánto trabajo manual adicional requiere del equipo? |
| **Costo** | ¿Requiere servicios pagos adicionales? |
| **Escalabilidad** | ¿Soporta bien un volumen creciente de envíos? |

---

## Alternativas

### 1. GitHub Issues como Buzón de Envíos

En lugar de crear un PR con el archivo markdown, el Worker crea un **GitHub Issue** con los datos del envío formateados.

**Flujo:**
1. Usuario envía formulario → Worker de Cloudflare
2. Worker valida los datos
3. Worker crea un Issue en GitHub con título `[submission] Nombre de la Empresa` y cuerpo con los datos estructurados
4. El Issue queda abierto para que el equipo lo revise
5. El equipo crea manualmente el archivo `.md` y cierra el Issue

**Ventajas:**
- Más simple que crear ramas y PRs — solo una llamada a la API (`POST /repos/{owner}/{repo}/issues`)
- Los Issues son el mecanismo natural de GitHub para tareas pendientes
- Se pueden usar labels (`submission`, `pending-review`, `approved`, `rejected`) para organizar
- Sin riesgo de conflictos de rama ni blobs huérfanos
- El token solo necesita permiso `issues:write` (más restrictivo que `contents:write`)

**Desventajas:**
- El equipo debe crear manualmente el archivo `.md` a partir de los datos del Issue
- Si hay muchos envíos, gestionar Issues puede volverse tedioso

**Complejidad de implementación:** Muy baja. Cambiar `createBranch` + `createPerkFile` + `createPullRequest` por una sola llamada a la API de Issues.

**Ejemplo de payload para el Issue:**

```json
{
  "title": "[submission] Stripe",
  "body": "## Datos del envío\n\n- **Empresa:** Stripe\n- **Tipo:** credit\n- **Valor:** $50,000\n- **Elegibilidad:** Para startups en etapa Seed...\n- **Categoría:** Payments\n- **Etapa:** Seed\n- **URL:** https://stripe.com/startups\n\n---\n\n_Enviado desde el formulario público de StartupPerks._",
  "labels": ["submission", "pending-review"]
}
```

---

### 2. Almacenamiento en Base de Datos (Cloudflare D1 o KV) + Panel Admin

Los envíos se guardan en una base de datos y el equipo tiene un panel simple para revisarlos.

**Flujo:**
1. Usuario envía formulario → Worker guarda en D1 (SQL) o KV (key-value)
2. El equipo accede a un panel admin simple (HTML estático servido por el mismo Worker o una página protegida del sitio Astro)
3. El panel muestra envíos pendientes con botones "Aprobar" (genera el `.md` y crea PR) o "Rechazar"
4. Los envíos aprobados se publican automáticamente

**Ventajas:**
- Experiencia de revisión muy eficiente (un panel dedicado)
- Los datos persisten sin depender de GitHub
- Se puede añadir estado (`pending`, `approved`, `rejected`, `needs-info`)
- Flujo semi-automatizado: revisión manual, publicación automática
- D1 tiene generoso tier gratuito (5GB almacenamiento, 5M lecturas/mes)

**Desventajas:**
- Mayor complejidad de implementación (schema de DB, panel admin, autenticación del panel)
- Requiere proteger el panel admin con algún mecanismo (contraseña compartida, IP allowlist, Cloudflare Access)
- Costo adicional si se excede el tier gratuito

**Complejidad de implementación:** Media. Requiere:
1. Schema de D1 para la tabla `submissions`
2. Endpoints en el Worker: `GET /admin/submissions`, `POST /admin/submissions/:id/approve`, `POST /admin/submissions/:id/reject`
3. Página admin estática con login simple
4. Workflow de publicación automática al aprobar

---

### 3. Notificación por Email (Resend, Mailchannels, o SendGrid)

El Worker envía un email al equipo de desarrollo con los datos del envío. El equipo revisa y actúa manualmente.

**Flujo:**
1. Usuario envía formulario → Worker de Cloudflare
2. Worker valida los datos
3. Worker envía un email al equipo con los datos formateados
4. El equipo revisa el email, crea el archivo `.md`, y hace commit

**Ventajas:**
- Extremadamente simple de implementar
- Sin dependencia de APIs externas complejas
- Mailchannels tiene integración gratuita con Cloudflare Workers
- Los emails persisten en la bandeja de entrada como registro

**Desventajas:**
- Totalmente manual para el equipo
- Sin tracking de estado (no se sabe qué envíos ya se procesaron)
- Los emails pueden perderse en spam o pasar desapercibidos
- Escala mal con volumen alto

**Complejidad de implementación:** Muy baja. Solo agregar el envío de email al Worker actual.

---

### 4. Webhook a Slack / Discord

El Worker envía los envíos a un canal de Slack o Discord mediante webhook. El equipo revisa en el chat y actúa.

**Flujo:**
1. Usuario envía formulario → Worker de Cloudflare
2. Worker valida los datos
3. Worker envía un mensaje a un canal de Slack/Discord con los datos formateados
4. El equipo revisa en el chat, crea el archivo `.md`, y hace commit

**Ventajas:**
- Muy simple de implementar
- Slack/Discord es donde el equipo ya trabaja
- Webhooks son nativos y gratuitos
- Visibilidad inmediata para todo el equipo
- Se puede usar emojis/reacts para marcar envíos como revisados

**Desventajas:**
- Sin estructura de datos (los mensajes de chat no son una base de datos)
- Sin tracking formal de estado
- Si el mensaje se pierde en el historial del chat, el envío se olvida

**Complejidad de implementación:** Muy baja. Una llamada `fetch` al webhook URL.

**Ejemplo de payload para Slack:**

```json
{
  "text": "Nuevo envío de perk",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Nuevo envío:* Stripe\n*Tipo:* credit | *Valor:* $50,000\n*Categoría:* Payments | *Etapa:* Seed\n*URL:* https://stripe.com/startups"
      }
    }
  ]
}
```

---

### 5. Archivo de Cola en el Repositorio (JSON en Git)

Los envíos se guardan como entradas en un archivo JSON dentro del mismo repositorio, creando un PR simple que solo modifica ese archivo.

**Flujo:**
1. Usuario envía formulario → Worker
2. Worker valida los datos
3. Worker lee `submissions-queue.json` de la rama principal, agrega la entrada, y crea un PR solo con ese cambio
4. El equipo revisa el PR, crea el archivo `.md` correspondiente, elimina la entrada del JSON, y hace merge

**Ventajas:**
- Todo vive en Git — trazabilidad completa
- Sin base de datos externa
- El PR es mucho más simple (modificar un JSON vs crear un archivo nuevo)
- Se pueden tener múltiples envíos en un mismo PR

**Desventajas:**
- Riesgo de conflictos si hay envíos simultáneos (el worker tendría que manejar rebase)
- Sigue requiriendo token de GitHub con permisos de escritura
- No elimina la complejidad de git del todo

**Complejidad de implementación:** Media-baja. Similar al actual pero con un solo archivo y sin creación de ramas nuevas.

---

### 6. Formulario Externo (Google Forms / Typeform / Tally)

Externalizar completamente el formulario de envío a un servicio de formularios. El equipo revisa las respuestas en una hoja de cálculo.

**Flujo:**
1. Usuario llena un Google Form / Typeform / Tally embebido en el sitio
2. Las respuestas se guardan automáticamente en Google Sheets / panel del servicio
3. El equipo revisa periódicamente la hoja de cálculo
4. El equipo crea manualmente los archivos `.md` para las entradas aprobadas

**Ventajas:**
- Cero código que mantener — el Worker de submit-api deja de ser necesario
- Google Forms/Typeform son gratuitos para uso básico
- Interfaz de revisión familiar (hoja de cálculo)
- Sin superficie de ataque (sin API propia)
- Tally es especialmente bueno: gratuito, ilimitado, embebible, soporta notificaciones por email

**Desventajas:**
- La experiencia de envío es menos integrada (redirección a servicio externo)
- Sin automatización de la publicación
- Dependencia de un servicio externo
- Tally/Typeform pueden tener límites en tier gratuito

**Complejidad de implementación:** Mínima. Reemplazar el modal por un embed o enlace al formulario externo. Eliminar el Worker completamente.

---

## Tabla Comparativa

| Alternativa | Simplicidad | Seguridad | UX Usuario | Carga Dev | Costo | Escalabilidad |
|-------------|-------------|-----------|------------|-----------|-------|---------------|
| 1. GitHub Issues | ★★★★★ | ★★★★☆ | ★★★★★ | ★★★☆☆ | $0 | ★★★★☆ |
| 2. D1 + Panel Admin | ★★☆☆☆ | ★★★★★ | ★★★★★ | ★★★★☆ | $0* | ★★★★★ |
| 3. Email | ★★★★★ | ★★★★☆ | ★★★★★ | ★★☆☆☆ | $0 | ★★☆☆☆ |
| 4. Slack/Discord | ★★★★★ | ★★★★☆ | ★★★★★ | ★★★☆☆ | $0 | ★★★☆☆ |
| 5. JSON en Git | ★★★☆☆ | ★★★☆☆ | ★★★★★ | ★★★☆☆ | $0 | ★★★☆☆ |
| 6. Google Forms/Tally | ★★★★★ | ★★★★★ | ★★★☆☆ | ★★★☆☆ | $0 | ★★★★☆ |

---

## Recomendación

### Para empezar rápido (hoy mismo): **Slack/Discord Webhook + GitHub Issues (híbrido)**

Combinar dos enfoques simples:

1. **Worker envía a Slack/Discord** — notificación inmediata al equipo
2. **Worker también crea un GitHub Issue** — trazabilidad y tracking de estado

El Worker sería extremadamente simple: validar payload, enviar mensaje a Slack, crear Issue en GitHub. ~30 líneas de código adicional.

### Para una solución más completa (a medio plazo): **D1 + Panel Admin**

Si el volumen de envíos crece, migrar a base de datos con panel de revisión. Esto da:
- Tracking de estado real (pendiente, aprobado, rechazado, necesita-info)
- Panel dedicado para revisar y publicar
- Posibilidad de notificar al usuario cuando su envío es aprobado

---

## Implementación Recomendada: GitHub Issues + Slack

### Cambios necesarios en el Worker

Reemplazar las funciones `createBranch`, `createPerkFile`, `createPullRequest`, `getBaseBranchSha` por dos funciones nuevas:

```typescript
// Enviar a Slack (opcional, solo si SLACK_WEBHOOK_URL está configurada)
async function notifySlack(submission: SubmissionPayload, env: Env): Promise<void> {
  if (!env.SLACK_WEBHOOK_URL) return;
  
  const message = {
    text: `Nuevo envío: ${submission.company}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            `*Nuevo envío de perk:* ${submission.company}`,
            `*Tipo:* ${submission.perkType} | *Valor:* ${submission.amountDisplay}`,
            `*Categoría:* ${submission.categories.join(", ")} | *Etapa:* ${submission.fundingStages.join(", ")}`,
            `*Elegibilidad:* ${submission.eligibility}`,
            `*URL:* ${submission.url}`,
          ].join("\n"),
        },
      },
    ],
  };

  await fetch(env.SLACK_WEBHOOK_URL, {
    method: "POST",
    body: JSON.stringify(message),
  });
}

// Crear Issue en GitHub
async function createSubmissionIssue(submission: SubmissionPayload, env: Env): Promise<string> {
  const body = [
    "## Datos del envío",
    "",
    `| Campo | Valor |`,
    `|-------|-------|`,
    `| Empresa | ${submission.company} |`,
    `| Tipo | ${submission.perkType} |`,
    `| Valor | ${submission.amountDisplay} |`,
    `| Elegibilidad | ${submission.eligibility} |`,
    `| Categorías | ${submission.categories.join(", ")} |`,
    `| Etapas | ${submission.fundingStages.join(", ")} |`,
    `| URL | ${submission.url} |`,
    "",
    "---",
    `_Enviado desde el formulario público._`,
  ].join("\n");

  const response = await githubRequest(env, "/issues", {
    method: "POST",
    body: JSON.stringify({
      title: `[submission] ${submission.company}`,
      body,
      labels: ["submission", "pending-review"],
    }),
  });

  const payload = await parseGithubResponse(response);
  return payload.html_url as string;
}
```

### Variables de entorno nuevas

| Variable | Requerida | Propósito |
|----------|-----------|-----------|
| `SLACK_WEBHOOK_URL` | No | URL del webhook de Slack para notificaciones |

### Permisos del token de GitHub

El token ahora solo necesita `issues:write` (en lugar de `contents:write` + `pull_requests:write`), reduciendo la superficie de riesgo.

### Flujo resultante

```
Usuario → Formulario → Worker → [Slack] + [GitHub Issue]
                                      │
                               Equipo revisa Issue
                                      │
                         Aprueba → Crea .md manualmente
                         Rechaza → Cierra el Issue
```
