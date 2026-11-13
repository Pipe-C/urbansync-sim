# UrbanSync Sim

Simulador web de un cruce de tráfico con semáforo adaptativo. Demuestra, en
tiempo real, cómo un algoritmo de control adaptativo supera a un ciclo fijo, y
cómo da prioridad a los vehículos de emergencia.

El cruce 3D corre en el navegador con el motor propio; el backend mide ambas
políticas sobre la misma secuencia de llegadas y transmite las lecturas por
Socket.io. La interfaz está en español; el código, los identificadores y los
commits, en inglés.

**Estado:** Fases 1–6 cerradas. El proyecto está desplegado y verificado. La
autenticación de autoservicio (registro y recuperación de contraseña) está
implementada y probada; quedan configurar el SMTP de producción y rotar la
contraseña de Postgres expuesta durante el setup. El detalle vive en
[`PLAN.md`](PLAN.md) y [`CONTINUIDAD.md`](CONTINUIDAD.md).

**Demo en vivo:** [frontend](https://urbansync-sim-frontend.vercel.app) ·
[health del backend](https://urbansync-sim-production.up.railway.app/health).

## Capturas

<p>
  <img src="docs/screenshots/dashboard.png" alt="Panel de simulación en escritorio: cruce 3D, comparación de políticas y serie de flujo" width="720">
  <img src="docs/screenshots/dashboard-mobile.png" alt="Panel de simulación en móvil a 375 píxeles" width="220">
</p>

## Requisitos

- Node.js 20 o superior (npm 10+)
- Python 3.11 o superior
- **Docker no es necesario.** El backend funciona con SQLite; PostgreSQL es
  solo el destino de despliegue.

## Inicio rápido sin Docker (SQLite)

Hazlo desde la raíz del repositorio. El backend debe arrancarse desde
`backend/`: ahí viven `alembic.ini` y el `.env`.

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt

copy .env.example .env
```

Edita `backend\.env` y deja la base de datos en SQLite:

```dotenv
DATABASE_URL=sqlite+aiosqlite:///./urbansync.db
```

La recuperación de contraseña funciona en local sin proveedor de correo: si
`SMTP_HOST` está vacío, el backend escribe el enlace de restablecimiento en el
log de desarrollo. En producción configura las variables `SMTP_*` y
`FRONTEND_URL` de `backend\.env.example`; sin ellas no se envía ningún correo.

Crea el esquema e instala el operador de demostración:

```powershell
alembic upgrade head
python -m app.db.seed
```

Arranca la API:

```powershell
uvicorn main:app --reload --port 8000
```

Comprueba que responde en <http://localhost:8000/health> (`{"status":"ok"}`).
La documentación interactiva está en <http://localhost:8000/docs>.

### 2. Frontend

En **otra** terminal:

```powershell
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Abre <http://localhost:5173>. El frontend apunta al backend por
`VITE_API_URL=http://localhost:8000`; Socket.io reutiliza esa misma URL, así que
`VITE_WS_URL` no hace falta.

### 3. Entrar

```
correo:  admin@urbansync.sim
clave:   admin123
```

Es la cuenta que crea `python -m app.db.seed`, no una autenticación simulada.
También puedes crear una cuenta desde `/register` y recuperar la contraseña desde
`/forgot-password`. Sin backend no se puede iniciar sesión; `/`, `/observer` y
las pantallas de autenticación sí son públicas.

## PostgreSQL o Docker (opcional)

Si prefieres PostgreSQL, cambia `DATABASE_URL` en `backend\.env`:

```dotenv
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/urbansync
```

y repite `alembic upgrade head` + `python -m app.db.seed`. Los mismos comandos
sirven con el `docker-compose.yml` del proyecto.

## Rutas

| Ruta               | Pantalla                                                    |
| ------------------ | ----------------------------------------------------------- |
| `/`                | Landing pública: argumento del producto y vista del cruce    |
| `/login`           | Autenticación contra el backend                              |
| `/register`        | Creación de cuenta con inicio de sesión automático           |
| `/forgot-password` | Solicitud de enlace de recuperación                          |
| `/reset-password`  | Formulario de nueva contraseña a partir del token            |
| `/dashboard`       | Consola: cruce en 3D, transporte, métricas y comparación     |
| `/config`          | Parámetros de simulación y reparto de flota                  |
| `/reports`         | Historial de corridas y descargas CSV/PDF                    |
| `/observer`        | Vista ampliada del cruce, sin cuenta                         |

## Comandos útiles

```powershell
cd frontend

npm run dev          # servidor de desarrollo con HMR
npm run build        # typecheck + bundle de producción
npm run typecheck    # solo TypeScript, sin emitir
npm run lint         # oxlint
npm run format       # prettier sobre src/
```

```powershell
cd backend

python -m pytest     # 109 tests, sin base de datos externa (SQLite en memoria)
alembic upgrade head # aplica migraciones
python -m app.db.seed
```

Puertas del motor de simulación (sin navegador, desde `frontend/`):

```powershell
npx tsx scripts/verify-model.ts 10    # invariantes del modelo (~2 min)
npx tsx scripts/overlap-seeds.ts 5    # solapes en 5 semillas (~10 min)
```

## Estructura

```
frontend/src/
├─ components/     # UI: base (ui/), simulación, dashboard, informes, layout
├─ pages/          # componentes de nivel de ruta
├─ routes/         # rutas protegidas y redirección de auth
├─ store/          # estado global (Zustand)
├─ simulation/
│  ├─ core/        # modelo del motor: TypeScript puro, sin DOM ni three.js
│  ├─ three/       # escena 3D: una vista del modelo, no una segunda verdad
│  └─ events/      # bus de eventos entre motor, renderer y React
├─ hooks/          # hooks propios
├─ services/       # cliente HTTP (Axios) y Socket.io
└─ types/          # interfaces compartidas

backend/
├─ app/
│  ├─ api/         # rutas REST y canal Socket.io
│  ├─ core/        # configuración y seguridad
│  ├─ db/          # sesión, seed y migraciones Alembic
│  ├─ models/      # modelos SQLAlchemy
│  ├─ schemas/     # contratos Pydantic
│  └─ services/    # lógica de negocio, algoritmo y simulación
└─ tests/
```

## Despliegue (Vercel + Railway)

El frontend va a Vercel y el backend con PostgreSQL a Railway. Los dos
servicios se despliegan desde el mismo repositorio, cada uno con su carpeta
raíz. La configuración ya está versionada: `frontend/vercel.json` resuelve el
fallback de la SPA y las cabeceras; `backend/railway.json` y `backend/Dockerfile`
migran, siembran y arrancan la API en el puerto que Railway asigne.

### 1. Backend en Railway

1. Crea un proyecto y añade el plugin **PostgreSQL**.
2. Añade un servicio desde el repositorio y configura **Root Directory** en
   `backend`. Railway detecta el `Dockerfile` y usa `railway.json`.
3. Variables del servicio:

   ```dotenv
   ENVIRONMENT=production
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   SECRET_KEY=<valor-aleatorio-de-32-bytes-o-más>
   CORS_ORIGINS=https://<tu-frontend>.vercel.app
   ```

   Genera `SECRET_KEY` con
   `python -c "import secrets; print(secrets.token_urlsafe(32))"`. No uses el
   valor de ejemplo: el arranque lo rechaza fuera de desarrollo.
   `CORS_ORIGINS` acepta una lista separada por comas; los previews de Vercel
   ya quedan cubiertos por `cors_origin_regex` en `app/core/config.py`.

4. El primer arranque ejecuta `alembic upgrade head` y
   `python -m app.db.seed` (idempotente). Comprueba
   `https://<tu-backend>.up.railway.app/health` → `{"status":"ok","db":"ok"}`.

La cuenta demo (`admin@urbansync.sim` / `admin123`) se crea en ese primer
arranque. Si el despliegue deja de ser una demo, cámbiala o desactívala.

### 2. Frontend en Vercel

1. Importa el repositorio y configura **Root Directory** en `frontend`.
   El framework es Vite; `vercel.json` fija build y salida.
2. Variable de entorno (Production y Preview):

   ```dotenv
   VITE_API_URL=https://<tu-backend>.up.railway.app
   ```

   `VITE_API_URL` se incrusta en el bundle: tras cambiarla hay que volver a
   desplegar. Socket.io reutiliza ese mismo host, no hay variable de WebSocket.

3. Despliega y abre la URL de Vercel. La landing y `/observer` son públicas;
   el resto pide login contra el backend.

### 3. Orden y comprobación

Despliega primero el backend (necesitas su URL para Vercel) y después el
frontend. Al final, en `/dashboard`, el badge debe pasar a **EN LÍNEA** al
iniciar una corrida; si queda **SIN CONEXIÓN**, revisa `VITE_API_URL` y
`CORS_ORIGINS`.

## Problemas frecuentes

- **PowerShell bloquea `Activate.ps1`:** ejecuta una vez
  `Set-ExecutionPolicy -Scope Process RemoteSigned` y vuelve a activar.
- **`python` no existe o abre la Microsoft Store:** usa `py -3.12` (o la versión
  instalada) en lugar de `python`.
- **`alembic` o `uvicorn` no se reconocen:** activa el venv o llama al ejecutable
  directamente (`.\.venv\Scripts\alembic.exe`).
- **Login devuelve 500 o «no se pudo conectar»:** faltan la migración o el seed,
  o el backend no está en el puerto 8000. Repite `alembic upgrade head` y
  `python -m app.db.seed`.
- **El puerto 5173 está ocupado:** Vite usará otro, pero CORS solo permite 5173.
  Arranca con `npm run dev -- --port 5173` o añade el nuevo origen a
  `CORS_ORIGINS` en `backend\.env`.
- **Quieres empezar de cero:** detén el backend y borra `backend\urbansync.db`;
  vuelve a ejecutar migración y seed.

## Documentación

Decisiones de implementación y contexto de cada fase: [`PLAN.md`](PLAN.md) y
[`CONTINUIDAD.md`](CONTINUIDAD.md). Convenciones de diseño visual:
[`DESIGN.md`](DESIGN.md). Contexto para agentes: [`AGENTS.md`](AGENTS.md).
