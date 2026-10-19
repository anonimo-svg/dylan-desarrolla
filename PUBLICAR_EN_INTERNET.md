# Publicación de BLACKOUT

La versión de producción usa **Netlify + Supabase**, no el disco JSON de Render. Seguí `NETLIFY_SUPABASE_SETUP.md`.

1. Ejecutá `supabase/setup.sql` en el SQL Editor de tu proyecto de Supabase.
2. Agregá a Netlify las variables privadas `ADMIN_USER`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `SUPABASE_URL` y `SUPABASE_SECRET_KEY`.
3. Conectá el repositorio de GitHub `anonimo-svg/dylan-desarrolla` en Netlify.
4. Netlify usa `netlify.toml`, publica `public/` y despliega las funciones en `netlify/functions/`.

No subas `.env` ni incluyas la clave secreta de Supabase en ningún archivo público.
