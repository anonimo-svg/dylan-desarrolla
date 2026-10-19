# BLACKOUT — migración a Netlify + Supabase

Este proyecto mantiene el sitio y el panel (`/admin`) en Netlify. Las funciones de `netlify/functions/` manejan el inicio de sesión y las modificaciones; Supabase persiste los servicios. La clave secreta de Supabase solo se usa desde funciones de servidor y nunca debe añadirse al navegador o al repositorio.

## 1. Crear la base de datos

1. Creá un proyecto en https://supabase.com/.
2. Abrí SQL Editor → New query.
3. Abrí `supabase/setup.sql`, copiá todo el contenido, pegalo en SQL Editor y presioná Run.
4. Confirmá que el resultado final muestre `id = 1` y `cantidad_servicios = 7`.

## 2. Obtener las claves de Supabase

En el panel del proyecto, abrí Connect o Settings → API Keys:
- `SUPABASE_URL`: URL del proyecto, similar a `https://abcxyz.supabase.co`.
- `SUPABASE_SECRET_KEY`: clave secreta que empieza por `sb_secret_`. Si tu proyecto solo muestra la clave legacy `service_role`, podés usarla como valor de `SUPABASE_SECRET_KEY`.

La clave secreta jamás va en archivos de `public/`, en HTML/JavaScript del navegador ni en GitHub.

## 3. Actualizar GitHub desde la carpeta local

Copiá los archivos de este paquete sobre el proyecto local `dylan-desarrola`, conservando la carpeta oculta `.git`. No borres `.git` ni ejecutes `git init` de nuevo.

Desde la terminal abierta en `dylan-desarrola`, ejecutá:

```powershell
git status --short
git add .
git status --short
```

Verificá que `.env` no figure como archivo a subir. Después:

```powershell
git commit -m "Adaptar BLACKOUT a Netlify y Supabase"
git push
```

## 4. Crear el sitio en Netlify

1. Entrá en https://app.netlify.com/ y elegí Add new site → Import an existing project.
2. Conectá GitHub y seleccioná `anonimo-svg/dylan-desarrolla`.
3. Build settings: Netlify debería detectar `netlify.toml`. La carpeta publicada es `public` y las funciones están en `netlify/functions`.
4. Antes de finalizar el despliegue, abrí Project configuration / Site configuration → Environment variables y agregá las variables siguientes con alcance de Functions (o todos los alcances si esa opción no aparece):

| Variable | Valor |
|---|---|
| `ADMIN_USER` | `blackout` |
| `ADMIN_PASSWORD` | Una contraseña nueva, larga y exclusiva para este sitio |
| `SESSION_SECRET` | Generado en el paso siguiente |
| `SUPABASE_URL` | URL del proyecto de Supabase |
| `SUPABASE_SECRET_KEY` | Clave secreta de Supabase; solo servidor |

Para generar un `SESSION_SECRET` localmente, ejecutá en la terminal de VS Code:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Copiá el resultado directamente a la variable `SESSION_SECRET` en Netlify. No lo compartas ni lo guardes en un archivo rastreado por Git. Si cambiás una variable después de publicar, hacé un nuevo deploy para que las funciones utilicen los valores actualizados.

5. En Netlify, ejecutá el deploy. Si las variables se agregaron después, usá Deploys → Trigger deploy → Deploy site.

## 5. Probar

- Sitio público: `https://TU-SITIO.netlify.app/`
- Panel: `https://TU-SITIO.netlify.app/admin`
- Los cambios guardados en el panel quedan en Supabase y aparecen para todos los visitantes.

Si la página informa que no puede cargar servicios, revisá primero que se ejecutó `supabase/setup.sql` y que `SUPABASE_URL` y `SUPABASE_SECRET_KEY` están bien configuradas en Netlify.

## Notas de seguridad

- No subas `.env` ni una clave secreta a GitHub.
- RLS está habilitado y se revocó el acceso de `anon` y `authenticated` a las tablas; las funciones de Netlify usan la clave secreta del lado servidor.
- Las sesiones usan una cookie `HttpOnly`, `Secure`, `SameSite=Strict`, firmada con `SESSION_SECRET`, y expiran a las dos horas.
- El límite de seis intentos fallidos por IP durante 15 minutos se guarda en Supabase. Es un mecanismo básico de protección para este sitio pequeño; revisá logs y configurá controles adicionales si el tráfico crece.
- Netlify y Supabase tienen cuotas en sus planes gratuitos. Confirmá sus límites actuales en los paneles antes de publicar; si el proyecto Supabase gratuito se pausa por inactividad, puede tardar en responder al reactivarse.

## Desarrollo local

El archivo `server.js` original se conserva para la forma anterior de probar el sitio con Express y JSON local. Ese modo local no persiste cambios en Supabase. La publicación Netlify utiliza `netlify.toml` y las funciones de `netlify/functions/`.
