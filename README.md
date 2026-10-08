# UrbanSync Sim

Simulador web de un cruce de tráfico con semáforo adaptativo. Demuestra, en
tiempo real, cómo un algoritmo de control adaptativo supera a un ciclo fijo, y
cómo da prioridad a los vehículos de emergencia.

**Estado:** Fase 1 completa — solo frontend. La simulación corre localmente en
el navegador con datos generados por el propio motor; el backend en tiempo real
llega en la Fase 2. Por eso el indicador de conexión de la barra superior
muestra «Sin conexión»: es la verdad, no un fallo.

## Requisitos

- Node.js 20 o superior
- npm 10 o superior

## Arrancar la aplicación

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Credenciales de prueba (autenticación simulada, sin backend):

```
correo:  admin@urbansync.sim
clave:   admin123
```

## Rutas

| Ruta        | Pantalla                                                       |
| ----------- | -------------------------------------------------------------- |
| `/login`    | Autenticación simulada                                         |
| `/`         | Dashboard: cruce en 3D, métricas y controles de la corrida     |
| `/config`   | Parámetros de simulación con vista previa del reparto de flota |
| `/reports`  | Historial de corridas de la sesión local                       |
| `/observer` | Vista ampliada del cruce para observación en clase             |

## Comandos

```bash
cd frontend

npm run dev          # servidor de desarrollo con HMR
npm run build        # typecheck + bundle de producción
npm run typecheck    # solo TypeScript, sin emitir
npm run lint         # oxlint
npm run format       # prettier sobre src/

# Puertas del motor de simulación (sin navegador):
npx tsx scripts/verify-model.ts 10    # invariantes del modelo (~2 min)
npx tsx scripts/overlap-seeds.ts 5    # solapes en 5 semillas (~10 min)
```

## Estructura

```
frontend/src/
├── components/     # UI: base (ui/), simulación, dashboard, informes, layout
├── pages/          # componentes de nivel de ruta
├── routes/         # rutas protegidas y redirección de auth
├── store/          # estado global (Zustand)
├── simulation/
│   ├── core/       # modelo del motor: puro TypeScript, sin DOM ni three.js
│   ├── three/      # escena 3D: una vista del modelo, no una segunda verdad
│   └── events/     # bus de eventos entre motor, renderer y React
├── hooks/          # hooks propios
├── services/       # cliente HTTP (Axios) y WebSocket
└── types/          # interfaces compartidas
```

Decisiones de implementación y contexto de cada fase: `PLAN.md` y
`CONTINUIDAD.md` en la raíz del repositorio. Convenciones de diseño:
`frontend/DESIGN.md`.
