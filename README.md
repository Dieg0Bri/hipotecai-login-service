# login-service

Servicio Node.js/Express que gestiona el flujo OAuth 2.0 de Google y la persistencia segura del `refresh_token` en PostgreSQL para hipotecai. Réplica adaptada del `login-service` de ISA1.

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET`  | `/api-login/health`              | público | Liveness + readiness (incluye estado de BDD) |
| `GET`  | `/api-login/auth/google`         | público | Redirige a Google para iniciar OAuth |
| `GET`  | `/api-login/auth/google/callback` | público | Recibe el `code`, intercambia por tokens, guarda `refresh_token`, redirige al frontend con `access_token` + `id_token` (sin `refresh_token`) |
| `POST` | `/api-login/auth/refresh`        | id_token expirable | Renueva `access_token` y `id_token` usando el `refresh_token` de la BDD. Si Google no entrega `id_token`, firma uno propio con la info del usuario. |
| `POST` | `/api-login/auth/logout`         | OAuth | Revoca el `refresh_token` en BDD |
| `POST` | `/api-login/login`               | OAuth | Confirma sesión y upserta perfil del usuario |

## Desarrollo

```bash
npm install
cp .env.example .env  # rellenar GOOGLE_CLIENT_ID/SECRET, JWT_SECRET, DB_*
npm run dev
```

Puerto por defecto: `8081`.

## Patrón de seguridad

- El `refresh_token` **nunca** se entrega al frontend; vive en `dt_usuarios.refresh_token`.
- El frontend almacena sólo `access_token` + `id_token` y los rota llamando a `/auth/refresh`.
- En entornos detrás de API Gateway (GCP), `verifyGoogleOAuth` lee `X-Apigateway-Api-Userinfo`.
- En desarrollo local `SKIP_AUTH=true` bypassa la verificación con un usuario de prueba.

## Despliegue

Imagen Docker (`Dockerfile`) compatible Cloud Run. La conexión a Cloud SQL en producción es vía Unix socket (`/cloudsql/<INSTANCE_CONNECTION_NAME>`); detección automática vía variables `K_SERVICE` + `INSTANCE_CONNECTION_NAME`.
