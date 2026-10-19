# Publicar BLACKOUT en Internet con Render

Esta versión está preparada para publicarse como aplicación Node.js en Render. Render asigna una URL pública `onrender.com`; más adelante puedes conectar tu propio dominio.

## Antes de empezar

- Necesitas una cuenta de GitHub y una de Render.
- El repositorio puede ser privado.
- `render.yaml` configura un servicio Node.js y un disco persistente para que los precios que cambies desde `/admin` no desaparezcan tras un reinicio o redeploy.
- Esta configuración usa el plan web Starter de Render y un disco de 1 GB. La página oficial publica el servicio de 0,5 CPU/512 MB a USD 7/mes y almacenamiento persistente a USD 0,25/GB/mes; confirma el precio final en Render antes de crear el servicio.
- No subas el archivo `.env`. Los secretos de producción se configuran en el panel de Render.

## 1. Crear un repositorio privado en GitHub

1. Extrae el ZIP del proyecto.
2. En GitHub, crea un repositorio nuevo llamado `dylan-desarrola`. Selecciona **Private** y no agregues README ni archivos iniciales.
3. Abre la terminal de VS Code dentro de la carpeta del proyecto y ejecuta:

```powershell
git init
git add .
git status --short
git commit -m "Preparar BLACKOUT para publicar"
git branch -M main
git remote add origin https://github.com/TU_USUARIO_GITHUB/dylan-desarrola.git
git push -u origin main
```

Reemplaza `TU_USUARIO_GITHUB` con tu usuario real de GitHub. Antes de hacer `git commit`, revisa que `.env` no figure entre los archivos agregados. El archivo `.gitignore` de este proyecto excluye `.env` y `node_modules`.

## 2. Crear la página pública en Render

1. Inicia sesión en Render.
2. Selecciona **New + → Blueprint**.
3. Conecta GitHub y elige el repositorio `dylan-desarrola`.
4. Render detectará `render.yaml`. Esta configuración crea una aplicación web Node.js con un disco persistente de 1 GB.
5. Cuando solicite variables privadas, establece:
   - `ADMIN_USER`: `blackout`
   - `ADMIN_PASSWORD`: la contraseña elegida para administración. Puedes usar la que configuraste durante el desarrollo, aunque es más seguro establecer una nueva, larga y exclusiva.
   - `SESSION_SECRET`: se genera automáticamente por la configuración del Blueprint.
   - `NODE_ENV`: `production` se configura automáticamente.
6. Revisa el costo y confirma la creación del servicio.
7. Espera a que el despliegue termine y abre la URL pública que Render muestra en el dashboard.

## 3. Direcciones

Si Render asigna la URL `https://NOMBRE.onrender.com`, entonces:

- Página pública: `https://NOMBRE.onrender.com/`
- Panel admin: `https://NOMBRE.onrender.com/admin`

El nombre real de la URL lo asigna Render; no lo inventes ni lo sustituyas hasta que el dashboard lo muestre.

## 4. Conectar un dominio propio

No necesitas comprar un dominio para comenzar: puedes usar la dirección `onrender.com`. Si ya tienes un dominio, abre la configuración de tu servicio en Render, agrega el dominio personalizado y sigue los registros DNS que Render te indique.

## 5. Después de publicar

- Prueba `/admin` y guarda una modificación pequeña para confirmar que se refleja en la página pública.
- No compartas el usuario y contraseña del panel.
- Nunca subas `.env` al repositorio.
- Conserva una copia de respaldo de `data/services.json` si haces cambios importantes.
