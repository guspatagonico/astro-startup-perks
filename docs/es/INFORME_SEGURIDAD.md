# Informe de Seguridad — StartupPerks

Generado: 2026-07-06 | Herramientas: Gortex v0.59.1, Gitleaks v8, OSV, revisión manual

---

## Alcance

| Capa | Archivos | Perfil de Riesgo |
|------|----------|-----------------|
| Frontend Astro | `src/**/*.astro`, `src/**/*.ts` | Bajo — sitio estático, sin sesiones de usuario |
| API de Envíos (Worker) | `workers/submit-api/src/index.ts` | **Medio** — acepta POST público, crea PRs en GitHub |
| Contenido | `src/content/perks/*.md` | Bajo — validado mediante esquema Zod |

---

## Hallazgos

### 1. Sin Rate Limiting en la API de Envíos — MEDIO

**Archivo:** `workers/submit-api/src/index.ts:22`

El endpoint `/api/submit-perk` no tiene rate limiting, throttling ni prevención de abuso más allá del campo honeypot. Un atacante podría inundar envíos, creando miles de ramas y PRs borrador en el repositorio de GitHub.

**Impacto:** Agotamiento de recursos (límites de rate de la API de GitHub, contaminación del repositorio)  
**Recomendación:** Agregar rate limiting de Cloudflare Workers mediante `wrangler.toml` o un token bucket basado en KV. Considerar agregar un desafío CAPTCHA en el frontend antes de la llamada API.

---

### 2. CORS Permisivo como Respaldo — BAJO

**Archivo:** `workers/submit-api/src/index.ts:95-103`

Cuando la variable de entorno `ALLOWED_ORIGIN` no está configurada, `getCorsHeaders` usa como respaldo `origin || "*"`, lo que hace eco de cualquier cabecera `Origin`. Esto efectivamente permite POSTs de cualquier dominio.

```
const allowOrigin = allowedOrigin || origin || "*";
```

Además, la verificación de origen en las líneas 35-37 solo se activa cuando `ALLOWED_ORIGIN` está configurado explícitamente:

```
if (env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN) {
  return jsonResponse({ ok: false, error: "Origin not allowed." }, 403, corsHeaders);
}
```

**Impacto:** Cualquier sitio web puede hacer POST de envíos a la API. Combinado con la falta de rate limiting, esto permite ataques de inundación estilo CSRF.  
**Recomendación:** Configurar siempre `ALLOWED_ORIGIN` en producción. Considerar fallar explícitamente si `ALLOWED_ORIGIN` no está configurado y la petición tiene una cabecera `Origin`.

---

### 3. Falta de Content Security Policy (CSP) — BAJO

**Archivo:** `src/layouts/BaseLayout.astro` (sin cabecera CSP ni meta tag)

No hay cabecera `Content-Security-Policy` ni etiqueta `<meta>`. El sitio usa `set:html` para JSON-LD (línea 68) y un manejador `onclick` inline en `index.astro:238`.

**Impacto:** Sin defensa en profundidad contra XSS si contenido de usuario llegara a renderizarse de forma insegura.  
**Recomendación:** Agregar una cabecera CSP mediante middleware de Astro o la plataforma de despliegue (Cloudflare/Vercel). Ejemplo:
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com
```

---

### 4. Ciclo de Dependencia en el Worker — INFORMATIVO

**Herramienta:** Gortex `analyze --kind cycles`

Ciclo entre comunidades detectado (severidad 2):

```
getBaseBranchSha → githubRequest → fetch → getBaseBranchSha
```

`getBaseBranchSha` llama a `githubRequest`, que es llamado desde `fetch`, y `fetch` llama a `getBaseBranchSha`. Es un ciclo estructural (están en el mismo módulo, llamadas secuenciales, no recursivas), por lo que el impacto en tiempo de ejecución es mínimo.

**Impacto:** Bajo — funciones del mismo módulo llamadas en secuencia, no recursión real.  
**Recomendación:** No se requiere acción. El ciclo existe porque `githubRequest` es usado por múltiples funciones llamadas desde `fetch`. Refactorizar `githubRequest` para no referenciar el ámbito externo eliminaría el ciclo pero no es crítico.

---

### 5. Patrones de Throw Inseguros — INFORMATIVO

**Herramienta:** Gortex `analyze --kind unsafe_patterns`

Dos declaraciones `throw new Error()` detectadas en el worker:

- `workers/submit-api/src/index.ts:264` — `getBaseBranchSha`
- `workers/submit-api/src/index.ts:329` — `parseGithubResponse`

**Impacto:** Mínimo. Ambas son capturadas por el try/catch en `fetch` (líneas 84-87) y devueltas como respuestas JSON de error.  
**Recomendación:** Patrón aceptable para Cloudflare Workers.

---

### 6. Fuga de Mensajes de Error al Cliente — BAJO

**Archivo:** `workers/submit-api/src/index.ts:84-86`

```
const message = error instanceof Error ? error.message : "Could not create pull request.";
return jsonResponse({ ok: false, error: message }, 502, corsHeaders);
```

Los mensajes de error de la API de GitHub (desde `parseGithubResponse`) se devuelven directamente al cliente. Si GitHub incluyera información sensible en mensajes de error (poco probable), esto la expondría.

**Impacto:** Bajo — los errores de la API de GitHub son genéricos.  
**Recomendación:** Considerar registrar el error completo en el servidor (la observabilidad del Worker de Cloudflare está habilitada) y devolver un mensaje genérico al cliente.

---

### 7. Honeypot Anti-Spam — CORRECTO

**Archivo:** `workers/submit-api/src/index.ts:131-133`

```typescript
if (website) {
  return { ok: false, error: "Submission rejected." };
}
```

El campo `website` está oculto mediante CSS (clase `field-hp`, posicionado fuera de pantalla en `left: -9999px` en el modal) y marcado con `tabindex="-1" autocomplete="off"`. Los bots que auto-completan todos los campos activarán el rechazo. Los usuarios legítimos no verán ni interactuarán con él.

**Estado:** Medida anti-bot efectiva. No se requiere acción.

---

### 8. Validación de Entrada — CORRECTO

Múltiples capas de validación, todos hallazgos positivos:

| Función | Archivo:Línea | Comportamiento |
|---------|---------------|----------------|
| `validatePayload` | `index.ts:115` | Valida todos los campos con verificación de tipos, longitudes mínimas, pertenencia a enum |
| `cleanText` | `index.ts:171` | Recorta strings, usa string vacío como respaldo para no-strings |
| `isValidUrl` | `index.ts:185` | Usa el parser `new URL()`, restringe a `http:` y `https:` |
| `toSlug` | `index.ts:194` | Sanitiza a solo `[a-z0-9-]+` — path traversal imposible |
| `yamlString` | `index.ts:203` | Escapa `\`, `"`, y saltos de línea para seguridad YAML |
| Esquema Zod | `content.config.ts:6` | Validación `.min()`, `.url()`, `.enum()`, `.date()` en tiempo de build |

---

### 9. Secretos y Credenciales — CORRECTO

- **Escaneo Gitleaks:** No se detectaron secretos en el código
- **Token de GitHub:** Almacenado como variable de entorno del Worker de Cloudflare (`env.GITHUB_TOKEN`), no en código fuente
- **Transporte del token:** Cabecera `Authorization: Bearer` (estándar), no en parámetros de URL
- **Sin variables de entorno en `wrangler.toml`** — correcto, deben configurarse mediante `wrangler secret`

---

### 10. Seguridad en la Creación de PRs — CORRECTO

- Los PRs se crean como **borrador** (`draft: true`, línea 306) — sin merges accidentales
- Título del PR con prefijo `feat:` de conventional commits
- Nombres de rama usan sufijo basado en timestamp (`Date.now().toString(36)`) para unicidad

---

### 11. SAST (Análisis Estático) — LIMPIO

- **Escaneo de higiene Gortex:** 0 coincidencias (190+ reglas en 8 lenguajes)
- **Consultas nombradas Gortex (hardcoded-secrets, xss, ssrf, command-injection):** 0 coincidencias
- **Código muerto Gortex:** 0 símbolos
- **Usuarios de variables de entorno Gortex:** 0 patrones expuestos

---

## Resumen

| # | Hallazgo | Severidad | Estado |
|---|----------|-----------|--------|
| 1 | Sin rate limiting en API de envíos | **Medio** | Requiere corrección |
| 2 | CORS permisivo como respaldo | Bajo | Requiere configuración |
| 3 | Falta de cabecera CSP | Bajo | Recomendado |
| 4 | Ciclo de dependencia en worker | Informativo | Aceptable |
| 5 | Patrones de throw inseguros | Informativo | Aceptable |
| 6 | Fuga de mensajes de error | Bajo | Considerar |
| 7 | Honeypot anti-spam | — | Correcto |
| 8 | Validación de entrada | — | Correcto |
| 9 | Gestión de secretos | — | Correcto |
| 10 | Seguridad de PRs (borradores) | — | Correcto |
| 11 | Resultados SAST | — | Limpio |

**Riesgo global: BAJO.** El proyecto es un sitio estático con un único endpoint de API público que crea PRs borrador. Las principales preocupaciones son DoS mediante envíos sin rate limiting y valores predeterminados de CORS excesivamente permisivos. No se encontraron secretos, vectores XSS ni vulnerabilidades de inyección.
