# Continuidad — motor de simulación y handoff

> Documento de traspaso. Dice **qué está cerrado, qué sigue, y qué reglas no hay
> que tocar**. No repite el razonamiento: ese vive en los comentarios de
> `src/simulation/core/world.ts` y `controller.ts`, y el relato completo de la
> investigación está en el relato de `PLAN.md` § Sprint 1-E status y en los
> comentarios del código.
>
> **Regla de oro: `PLAN.md` es la fuente de verdad del trabajo pendiente.**
> Si algo de este documento discrepa de `PLAN.md`, sigue a `PLAN.md`.

---

## 0. ESTADO EN UNA LÍNEA

Motor **cerrado**: **0 solapamientos en 8 semillas a ambas demandas**, todos los
Invariantes en verde, y **2,7× el caudal** del código original. Canvas 3D commiteado,
**Sprint 1-F cerrado** (Configuración gobierna el motor de verdad, Informes lee un
registro local en `localStorage`) y **Sprint 1-G cerrado** (a11y, touch targets del
suelo de 44px, spinner que sobrevive a reduced-motion, skip link, README en la raíz,
audit 19/20). **La Fase 1 está completa a nivel de código y verificada en navegador**
(FPS ≥ 30 confirmados por el usuario). **Sprint 1-H cerrado**: los coches se paran
**detrás** de la cebra (geometría `928aab0` + interlock de peatones `25cdb4c`, con
el nuevo gate `scripts/ped-safety.ts` en verde), la **landing pública `/` existe**
(`9069bb9`, consola de instrumentos), la **cebra se lee** (`db49c0b`), **todos los
vehículos llevan faros y stop luces** (`819b1db`), la **flota tiene camión de
bomberos** y lo alterna con la ambulancia (`d866dc8`) y los carriles llevan
**flechas pintadas** (`2a4b13b`). Ver §3.1 para el detalle y lo que queda
(la verificación visual de `/` por el usuario). **La Fase 2 (backend) está
completa, verificada y commiteada**: API FastAPI escrita, **36 tests en verde**
sobre SQLite *y* sobre Postgres real, migración Alembic que reproduce los modelos
(`alembic check` sin diferencias), canal socket.io cableado (sin ticks todavía),
imagen Docker construida y stack completo probado end-to-end. 17 commits
(`b35b535`…`1de3c03`), árbol limpio. Ver §3.4. **El frontend ya autentica contra
el backend real** (Axios en `services/http.ts` + `services/auth.ts`, mock retirado
— §3.5) y el **canal realtime queda confirmado como socket.io** (namespace
`/simulation`). **La Fase 3 está completa (backend)**: el modelo
de colas + generador de llegadas (scope `(engine)`), los dos controladores (scope
`(algorithm)`) que **replican la ley del motor del navegador**, el **motor de ticks
por sesión** con su vocabulario de eventos (`tick`/`phase_change`/`evp_activated`/
`session_ended`) y el **benchmark CSV** adaptive-vs-fixed. **El transporte Socket.io
también está hecho** (`hub.py` + `ws/server.py`): el backend **ya emite ticks
reales**, una corrida por sesión, con `submit_config`/`stop_session`. **27 tests
nuevos, 71 en verde**. Ver §3.6, §3.7, §3.8 y §3.9. **La Fase 4 está cerrada salvo el test de latencia**:
el backend ahora corre **las dos políticas sobre la misma secuencia** y **soporta
pausa** (`pause_session`/`resume_session`), y el **frontend consume el stream
real** — panel de métricas en vivo con badge de conexión, mock borrado. **75 tests
en verde**, `tsc`/`oxlint`/`vite build` OK, smoke socket end-to-end OK, y la
**latencia one-way medida** (p95 0.67 ms; `sentAt` en el wire) — **la Fase 4 está
cerrada**. **La Fase 6 arrancó por donde el usuario la pidió: el pulido visual.**
El primer rebanado está **commiteado** (`70c9016`) en
`frontend/src/simulation/three/entities/LanePath.ts`: **guías de giro punteadas**
dentro de la caja, muestreadas de la propia ruta de cada movimiento de giro a la
izquierda, y la **cebra reorientada** al modo continental. Revisado en render
headless a 1440px y 375px; `npm run build` en verde. El hallazgo: los "cruces
diagonales" eran un hueco del render, no un defecto del modelo. Decisión: los
giros a la derecha **no** llevan guía (el A/B los mostró como dos anillos
concéntricos). Ver §3.10.

**El segundo rebanado del pulido también está commiteado** (`1c9375e`, más el
`da57b80` que lo precede): el panel de métricas deja de mostrar una lectura por
stat y pasa a un **rack de comparación** (`StrategyComparison.tsx`) con las cinco
lecturas por política —espera, atendidos, caudal, cola máxima y respuesta de
emergencia—, y la franja de procedencia reporta la **latencia one-way en vivo**
(p95 de una ventana de 60 ticks y la última lectura), leída de `sentAt`. `core/`
sigue intacto. Ver §3.11. **Pendiente**: el resto del pulido (más instrumentos
más allá de la columna de métricas, mejores animaciones), la verificación visual
en el navegador del usuario y todo el deploy.

---

## 1. LO QUE ESTÁ HECHO — no lo repitas

### 1.1 Motor de simulación (`frontend/src/simulation/core/`)

Escrito, verificado y con la puerta cerrada. Ver `PLAN.md` § Sprint 1-E status para
la tabla de mediciones y el relato de los cinco defectos que se cerraron. Resumen de
lo que hay:

- `layout.ts` — geometría: `APPROACH_LENGTH = 76,00`, `MIN_GAP = 1,35`, `LANES_PER_DIRECTION = 2`
  (carril 0 = giro izquierda + 직行; carril 1 = 直行 + giro derecha — compromiso de
  `PRODUCT.md`, no un descuido).
- `fleet.ts` — flota y dimensiones. Solo el bus de `11,2 m` alcanza por detrás de una
  línea de stop (`2,20–3,60 m`, medido con `scripts/band-matrix.ts`).
- `controller.ts` — máquina de estados con fase 直行 y **fase de giro izquierda
  protegido**, `MIN_GREEN`/`AMBER`/`ALL_RED`, interlock de caja, `MAX_CONSECUTIVE_SKIPS`
  (anti-inanición) y `ControllerInput.leftReady` (no abre flecha sobre un carril
  compartido ocupado).
- `world.ts` — el modelo. Integración, `boxConflict`, `holdForBodyConflict`,
  `holdAtConflict`, `sweptOverAStoppedBody`, y las trazas (`setBodyTrace`,
  `setTraceVehicle`, `takeTrace`).

### 1.2 Frontera `core/` ↔ `three/` ↔ React

`core/` **no importa** `three/`, ni el DOM, ni `process`. No es una preferencia de
estilo: es lo que permitió medir los invariantes con **8 semillas y sin renderizar
un solo cuadro**. Si rompes esa frontera, la siguiente sesión pierde la capacidad
de verificar el modelo, que es lo que costó cerrar estos defectos.

### 1.3 Migración 2D → 3D

Hecha en la documentación: `PLAN.md`, `AGENTS.md`, `PRODUCT.md`, `DESIGN.md` y
`GUIA_COMMITS.md` ya no dicen Phaser. La dependencia también (`fb14c11`). Las
seis menciones que quedan son **registros deliberados** de la decisión, no
afirmaciones de que esté en uso.

### 1.4 Medición (scripts, no tests)

El proyecto **no tiene test suite**; tiene arneses de medición. Son la puerta:

| Script | Pregunta que responde |
| :--- | :--- |
| `scripts/overlap-seeds.ts 5` | **La puerta.** 0 solapamientos en 8 semillas × ambas demandas |
| `scripts/verify-model.ts 10` | Invariantes en una corrida de 10 min (semilla 7) |
| `scripts/ped-safety.ts 3` | **Gate de los cambios de peatones.** 0 contactos vehículo↔peatón en 8 semillas (440 cruces en la corrida de cierre) |
| `scripts/red-entry.ts` | ¿Algún vehículo cruzó en rojo? |
| `scripts/overlap-pairs.ts` | ¿Qué par de movimientos sobrevive y con qué profundidad? |
| `scripts/stall.ts` | ¿El cruce se niega a descargar, o se niega porque está lleno? |
| `scripts/stranded.ts` | ¿Quién ocupa la caja? Serie temporal cada 30 s |
| `scripts/left-share.ts` | Distribución real de presión izq/直行 → `LEFT_SHARE_OF_DENIED` |
| `scripts/left-conflicts.ts` | La tabla de conflictos, verificada antes de escribir código |

`stall.ts` y `stranded.ts` son los que destaparon los livelocks: separan "rechaza con
la caja vacía" de "rechaza porque está llena", que es la pregunta en la que se
distinguió cada uno de estos defectos.

### 1.5 Capa de render (`frontend/src/simulation/three/` + runner + bus)

Escrito en esta sesión, con la frontera intacta (`core/` no importa nada de esto):

- `events/SimulationEventBus.ts` — mitt tipado. Dos eventos: `frame` (el mundo a
  frecuencia de refresco) y `readout` (el mismo mundo a 4 Hz para React).
- `runner.ts` — **un único RAF con refcount**; es el reloj del modelo. Stepea salvo
  en `paused`; en `idle` previsualiza; Stop (transición a `idle`) recrea el mundo con
  la misma semilla. El mundo sobrevive a los mounts: salir y volver retoma el mismo
  cruce. `getLastReadout()` / `getRunnerFrame()` son el puente para consumidores que
  se montan entre frames.
- `three/scene.ts` — stage: renderer, cámara (32,40,32), niebla `FOG_NEAR/FOG_FAR`,
  luces; `resize` sin tocar el CSS del canvas.
- `three/entities/LanePath.ts` — la carretera derivada **solo** de `layout.ts`, con
  `approachFrame(arm)` para el lado derecho del conductor (ojo: `rightOf` **no** está
  exportado de `core/index`; no hace falta añadirlo).
- `three/entities/{VehicleMesh,WalkerMesh,TrafficLightMesh}.ts` — silueta desde
  `VehicleSpec`, ciclo de marcha desde `stride`, farola desde `aspects()` +
  `leftOpen()`, barra azul de prioridad solo en el acceso servido.
- `three/IntersectionScene.ts` — pools por id, se reconstruyen si cambia la
  referencia del mundo (reset), **un `render()` por `frame`** y nunca más.
- `components/simulation/ThreeCanvas.tsx` — ciclo de vida del stage, estado de error
  si no hay WebGL, catch-up al montar (importante montado con el mundo en pausa).
- `hooks/useEngineReadout.ts` — la suscripción de `readout` para React.

**Reglas de esta capa (cada una evita un fallo concreto):**

1. **Sin segundo reloj para el modelo.** `useSimulationClock` sigue siendo el único
   `setInterval` y avanza *solo las métricas mock*; el runner es el reloj del motor.
   No mezclar los dos.
2. **Sin `renderer.render()` fuera del ciclo del runner** (salvo el repintado de
   resize en pausa). React, el readout y los resizes no compran frames.
3. **`core/` sigue intocado.** La preemption de la farola se deriva de
   `summary.activeArm`, no exponiendo campos privados del controlador.
4. **La geometría es del modelo.** El renderer no tiene ni un número que describa
   el cruce; todo sale de `layout.ts`.

---

## 2. MEDICIÓN ACTUAL

```bash
cd frontend
npx tsx scripts/overlap-seeds.ts 5     # la puerta
npx tsx scripts/verify-model.ts 10     # invariantes, 10 min
npx tsx scripts/ped-safety.ts 3       # gate de peatones
npm run build                          # tsc + vite
```

| | antes de esta sesión | ahora |
| :--- | --- | --- |
| solapamientos, 8 semillas, default | 58 | **0** |
| solapamientos, 8 semillas, calibrated | 36 | **0** |
| served, 8 semillas, default / calibrated | 437 / 540 | **1167 / 1102** |
| `verify-model` served (semilla 7) | 151 | **319** |
| `verify-model` peor espera | 119,1 s | **35,3 s** |

Tras el cierre de 1-H P1, la corrida de cierre del motor: `overlap-seeds 5` → 0 overlaps
(served default 913 / calibrated 877), `verify-model 10` → **ALL INVARIANTS HOLD**
(served 191), `ped-safety 3` → **0 contactos, 0,000 m**, 440 cruces, 96 walkers.

Y la corrida de cierre de 1-H (con el camión de bomberos): `overlap-seeds 5` → 0
overlaps (served default **916** / calibrated **890**), `verify-model 10` →
**ALL INVARIANTS HOLD** (served **210**, peor espera **227,0 s**), `ped-safety 3` →
0 contactos, 440 cruces. Los totales se mueven respecto a 191 porque el camino de
aparición consume aleatoriedad por tamaño de vehículo —una clase nueva desplaza el
flujo—, no por física del camión: en esa semilla el vehículo de emergencia es una
ambulancia en ambos casos, porque la intersección congestionada no le da cabida.

`verify-model` actual: `overlaps 0, teleports 0, entered on red 0, order violations
0, reverse motion 0` → `ALL INVARIANTS HOLD`.

**Sobre los números "antes": parte de ese 151 served era artefacto.** El ámbar
cobraba 2,5 m de reacción a *cualquier* velocidad, así que una cola parada se
liberaba en ámbar y drenaba de regalo. Al corregirlo (`v * REACTION_SECONDS`) el
caudal se partió en dos y aparecieron cuatro livelocks que el ámbar estaba
enmascarando. Los números de ahora son los reales.

---

## 3. LO QUE SIGUE

### 3.1 Fase 1 verificada en navegador — Sprint 1-H cerrado (los defectos que salieron)

**Verificación hecha (usuario, post 1-G):** FPS ≥ 30 confirmados (a veces un poco
lentos, aceptado). Tres precisiones para no repetir malentendidos:

1. **"Sliders al arrastrar el dedo" = los `input range` de la pantalla
   Configuración**, no la escena 3D. La **cámara de la simulación es fija por
   diseño** (consola de observación, no orbit controls): arrastrar el canvas no
   mueve nada y eso es correcto.
2. Skip link y flechas de los radio groups: no reportados como rotos → verificados
   por código.
3. Defectos visuales reportados → todos anotados en `PLAN.md` § Sprint 1-H con
   prioridad.

**Los defectos, con su geometría ya diagnosticada (no re-investigar):**

- **[P1 — CERRADO] Coches parados ENCIMA de la cebra** (`928aab0`). La geometría
  se reordenó al orden real: **caja → cebra (10,9–14,1 m) → línea de parada
  (15,1 m) → cola**, con `route.stopS` movido 4,7 m atrás. Acompañado por la
  campaña de peatones (`25cdb4c`): bucle de cruce, 12 peatones, interlock por
  brazo ocupado, el controlador cede a los brazos de cruce (extensión de
  despeje hasta 10 s) y un girador comprometido se detiene antes del arco de
  entrada de la cebra en vez de arrastrarse entre peatones. Gates en verde: las
  puertas de arriba + `ped-safety 3`.
- **[P1 — CERRADO] Landing page antes del login** (`9069bb9`). Ruta pública `/`
  construida con el workflow `impeccable shape` (líder «consola de
  instrumentos», seed `eb15258e`): intersección en vivo en un bezel, dos
  medidores y dos puertas — `Entrar` (`/login`) y `Observar` (`/observer`). Sin
  cifras en la página: demuestra el mecanismo; las mediciones se calculan en el
  dashboard. Brief en `.impeccable/surfaces`. **Verificación visual pendiente
  del usuario** (375px, 1440px, reduced-motion, teclado).
- **[P2 — CERRADO] Cebra poco legible** (`db49c0b`). Opacidad 0,4 → 0,85, la
  misma franja que la línea de parada (el 0,7 intermedio se coló en `928aab0`).
  La orientación de las franjas ya era la correcta (paralelas al tráfico que
  cruzan).
- **[P2 — CERRADO] Faros y stop luces en todos los vehículos** (`819b1db`).
  Tiras emisivas cálidas delante y rojas detrás en todas las clases, con un
  pequeño glow y tamaño derivado del cuerpo: una cola lee dirección e intención
  solo por la luz.
- **[P2 — CERRADO] Camión de bomberos** (`d866dc8`). `firetruck` de 8,4 m
  (la longitud ya lo deja fuera de los giros a la izquierda por la regla
  existente, así que no necesita lógica nueva), `weight: 0` para que nunca salga
  del flujo ordinario, y una escala en el techo para que se lea desde arriba.
  `updateEmergency` alterna ambulancia y camión, empezando por la ambulancia
  como hasta ahora. **Puertas de motor re-corridas en verde.** Nota medida: en
  la semilla de `verify-model` los totales cambian (served 191 → 210, peor
  espera 179,6 → 227,0 s) porque el camino de aparición consume aleatoriedad
  por tamaño, y una clase nueva desplaza el flujo; en esa corrida el vehículo
  de emergencia es una ambulancia en ambos casos (la intersección congestionada
  no da cabida al camión), y la demo empieza en una intersección vacía, donde
  ambos caben.
- **[P3 — CERRADO] Flechas de carril pintadas** (`2a4b13b`). Dos glifos por
  carril de aproximación, a un coche de longitud de la línea de parada, leídos
  de `lane.turns` para que la pintura siga al modelo y no al índice del carril.

**Sprint 1-H queda cerrado** (los seis ítems). Lo que falta, en orden:

1. **Verificación visual de `/` por el usuario** (375px, 1440px, reduced-motion,
   teclado) — es lo único pendiente de 1-H.
2. **`impeccable polish`** sobre las pantallas una vez vistas en pantalla
   (`impeccable detect` ya limpio sobre todos los archivos UI tocados; el audit
   manual cerró en 19/20).
3. **Fase 2 — Backend API + cableado del frontend** (`PLAN.md` § Phase 2):
   **completa** (17 commits, ver §3.4) y **el frontend ya habla con ella**:
   `services/http.ts` (Axios) + `services/auth.ts` real, con el mock retirado (ver
   §3.5). El canal realtime queda confirmado como **socket.io** (namespace
   `/simulation`); falta cablearlo en la Fase 4, no decidirlo.
4. **Métricas reales (Fase 3/4).** Mientras tanto, el canvas es el motor y los
   paneles son mock — y lo dicen: badge «Motor real» en el canvas, «Simulado» en
   `MetricsPanel`. El toggle en vivo de `SimulationControls` sigue afectando solo
   a las métricas mock; el radio de Configuración sí escribe `simulationStore.mode`
   (política por defecto de la próxima corrida), pero `core/` no lo sabe.
5. **Skeletons (Fase 3).** Diferidos con confirmación del usuario: no existe
   operación asíncrona con datos en la Fase 1 (todo es síncrono: engine tick,
   `localStorage`), y un skeleton sobre datos síncronos es teatro. Se escribirán
   cuando lleguen las llamadas reales al backend.

Los tres avisos que el motor le dejó al canvas siguen vigentes y se cumplieron:

1. **Deriva la geometría de `layout.ts`.** Hecho: `LanePath.ts` y las farolas no
   tienen ni un número propio; `approachFrame()` lee el lado derecho del conductor
   de `LANES`. Mantenerlo así si se retoca la escena.
2. **No pongas un segundo reloj.** Hecho: `runner.ts` es el único reloj del modelo
   y `useSimulationClock` sigue siendo el único `setInterval` (métricas mock).
3. **Presupuesto de `core/`:** sin DOM, sin `three`, sin `process`. intacto — la
   preemption de la farola se deriva de `summary.activeArm` en vez de abrir el
   controlador.

### 3.2 Si aparece un defecto de modelo otra vez

El orden que funcionó, y que sigue siendo el método:

1. `overlap-seeds.ts 5` para tener la puerta en rojo con 8 semillas.
2. `overlap-pairs.ts` para el par exacto.
3. Trazar ese par frame a frame con `setBodyTrace` / `setTraceVehicle`.
4. **Serial temporal con `stall.ts` / `stranded.ts` antes de tocar código.** Cinco
de los cinco defectos se veían como "saturación": `served` congelado y caja vacía.
Un contador congelado se ve igual si el cruce está saturado o atascado, así
   que la pregunta correcta no es *si* se congeló sino *cuándo*.
5. Verificar 10 min **y** 8 semillas antes de commitear.

### 3.3 Deuda conocida, no urgente

- `scripts/` tiene ~16 scripts de una sola vez de la investigación (`corner-*`,
  `pair-*`, `sweep-*`, `box-*`, `release-gap`, `check-pinned`, `aspect-timeline`).
  Están a propósito en un commit aparte para que limpiarlos después sea trivial.
  **No son gates**: no los ejecutes como criterio de aceptación.
- `verify-model.ts` corre **una sola semilla** (7). Es diseño suyo, pero la sesión
  pasada escondió un defecto entero porque en esa semilla era benigno. Para aceptar un
  cambio, `overlap-seeds.ts` manda.
- **`npm run format:check` está en rojo en archivos de `core/`** (`controller`,
  `fleet`, `layout`, `pedestrians` — `world` e `index` se formatearon al tocarlos
  en 1-F). Es **preexistente**: el fallo ya estaba en HEAD con el Prettier fijado
  por el repo. Arreglarlo es un `style` (prettier sobre esos) + re-ejecutar las
  puertas. Igual, `oxlint` avisa ~9 unused-vars en `scripts/` (mismo origen). El
  build de Vite avisa un chunk > 500 kB: es three.js, informativo.

### 3.4 Fase 2 — Backend API (commiteada; ver §6 para los hashes)

Todo `backend/` está escrito, importa y pasa `pytest`. Está construido **contra el
contrato que el frontend ya declaraba** (`frontend/src/types/*`,
`services/auth.ts`, `store/sessionsStore.ts`): los nombres y las formas no cambian
cuando el mock se reemplaza por la llamada real.

**Lo que hay:**

- **Modelos** (7 tablas): `roles`, `users`, `sessions` (revocación por `jti`),
  `simulation_configs`, `simulation_sessions`, `simulation_metrics`,
  `simulation_reports`.
- **API** (sin prefijo de versión, coincide con `VITE_API_URL`): `GET /health`,
  `POST /auth/login`, `POST /auth/logout`, `POST|GET|GET{id}|PATCH /sessions`,
  `POST|GET{id} /configs`. Payloads en **camelCase** (`displayName`, `expiresAt`,
  `quietRatePerMinute`) vía `CamelModel`.
- **Auth**: bcrypt (12 rondas) + JWT `python-jose`; el login devuelve el `AuthSession`
  que el store persiste; el logout revoca la fila `sessions` (efecto inmediato). Un
  email inexistente y una password errónea devuelven **el mismo** 401
  (`«Correo o contraseña incorrectos»`) y cuestan el mismo tiempo (hash señuelo real).
  Recursos ajenos → **404**, nunca 403 (no filtrar existencia).
- **Realtime**: `app/api/ws/server.py` — namespace `/simulation`, rooms por sesión,
  stub honesto que emite `ticking: false`. **No emite ticks**, eso es Fase 3.
- **Migración** `0001_initial_schema` + `docker-compose.yml` (Postgres + API que
  migra y seedea `admin@urbansync.sim` / `admin123` al arrancar).

**Cómo correr:**

```bash
cd backend
python -m venv .venv                 # local: Python 3.14; la imagen fija 3.11
.venv\Scripts\activate
pip install -r requirements.txt
$env:DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/urbansync"
alembic upgrade head
python -m app.db.seed
uvicorn main:app --reload --port 8000
```

**Verificado (todo en verde):**

- `pytest` → **36 en verde** sobre **SQLite** y sobre **Postgres real** (auth,
  configs, sessions, health, realtime, y el parseo de settings). El suite es
  agnóstico del motor: `TEST_DATABASE_URL` lo apunta a Postgres.
- `alembic check` → *"No new upgrade operations detected"*; el DDL de Postgres
  confirmado (`type_weights` → `jsonb`, `expires_at` → `timestamp with time zone`,
  5 CHECK de enums).
- **Imagen Docker construida** (`python:3.11-slim`, todos los wheels cp311) y
  **stack completo end-to-end**: `docker compose up` corre `alembic upgrade head`
  → `seed` → `uvicorn`, y contra `http://localhost:8000` responden
  `GET /health` 200, `POST /auth/login` 200, `POST /configs` 201,
  `POST /sessions` 201, `GET /sessions` 200, handshake `socket.io` 200,
  `POST /auth/logout` 200, y con el token revocado / sin token / password errónea
  → 401 (esta última con el mensaje exacto `«Correo o contraseña incorrectos»`).

**Nota — base de datos de test:** el fixture hace `drop_all`/`create_all`, así que
`tests/conftest.py` **rechaza** un `TEST_DATABASE_URL` cuyo nombre de base no
contenga `test`. Apuntarlo siempre a una base desechable
(`urbansync_test`), nunca a la de la aplicación: la borraría.

**Bloqueado / sin verificar:**

1. **Verificación visual de `/`** — sigue pendiente de 1-H (arriba).

**Canal realtime — decidido:** es **socket.io** (namespace `/simulation`), no la
ruta literal `/ws/simulation/{session_id}`. Tres fuentes (stack de `AGENTS.md`, el
log de decisiones de `PLAN.md`, la Fase 4 con `socket.io-client`) piden socket.io;
solo el bullet original de PLAN pedía la ruta, y `PLAN.md` ya lo registra como
superado (Phase 2 #906 y la tabla de decisiones #1027). **Confirmado por el
usuario.**

### 3.5 Cableado del frontend al backend real (commiteado)

El mock de auth se retiró y la consola habla con la API. Tres piezas, en orden de
dependencia (cada commit compila solo):

- **`services/http.ts`** — una sola instancia Axios con `baseURL = VITE_API_URL`
  (fallback `http://localhost:8000`) y un interceptor que inyecta
  `Authorization: Bearer`. El token vive en el módulo (`setAuthToken`) en vez de
  leerse del store al vuelo: importar el store aquí cerraría el ciclo
  `store/authStore → services/auth → services/http → store/authStore`.
- **`services/auth.ts`** — `POST /auth/login` y `POST /auth/logout` reales. Se
  conserva `InvalidCredentialsError` (solo para 401) con el mensaje exacto
  `«Correo o contraseña incorrectos»`, y `DEMO_CREDENTIALS` (el seed real:
  `admin@urbansync.sim` / `admin123`). El resto de fallos → mensaje de conexión.
- **`store/authStore.ts`** — fija el token al hacer login y al rehidratar
  (`onRehydrateStorage`), lo limpia al salir, y revoca la fila del backend de
  forma best-effort sin bloquear la UI.

**Verificado en vivo** (stack `docker compose up`, luego `down`): contrato del
login idéntico a `AuthSession`/`User` (`token, user, expiresAt` / `id, email,
displayName, role`, `id` UUID); 401 con `{"detail":"Correo o contraseña
incorrectos"}`; `GET /sessions` autenticado 200; el mismo token tras el logout →
**401**. `npm run build` y `oxlint` en verde; `prettier --check` limpio en los tres
archivos.

**Lo que no se tocó:** el canal realtime sigue siendo el stub honesto de
`app/api/ws/server.py` (no emite ticks) y el frontend todavía no lo consume. Los
`GET/POST /sessions` y `/configs` existen en el backend pero el frontend aún no
los llama (el log de informes sigue en `localStorage`).

### 3.6 Fase 3 — núcleo del algoritmo de control (commiteado)

Primer rebanado de la Fase 3, por decisión del usuario: **el núcleo de control +
tests**, sin `tick_engine` ni socket todavía. El algoritmo del backend **replica la
ley medida del motor del navegador** (`frontend/src/simulation/core/controller.ts`),
no el boceto simplificado de `PLAN.md`: misma presión `Σ (1 + waited/12)` con el tope
`PRESSURE_HORIZON = 120`, mismos interlocks `MIN_GREEN`/`MAX_GREEN`/`AMBER`/`ALL_RED`,
misma cota anti-inanición (`MAX_CONSECUTIVE_SKIPS`) y misma preemptión de emergencia.
Así los dos motores obedecen **una sola ley** — el requisito de `PRODUCT.md`.

**Scope `(engine)`:**

- `app/services/simulation/state.py` — `SimulationState`, un modelo de **colas** (no
  de geometría): admisión por carril, descarga a *saturation headway* (2 s/veh), la
  presión, `preemption_arm()` y `snapshot()` con las cuatro cantidades de
  `StrategyFrame`. Incluye `run()`, el bucle puro que `tick_engine` conducirá por
  sesión. La frontera es la del navegador: el modelo no importa el controlador (lo
  recibe por un `Protocol`).
- `app/services/simulation/vehicle_generator.py` — llegadas por semilla que
  reproducen la curva de demanda del navegador (quiet→base/pico con los dos senos de
  `world.ts`) y el reparto de tipos del operador + policía fija; emergencias
  deliberadas alternando ambulancia/bombero. Devuelve una **lista de `Arrival`**, para
  que el benchmark replaye la *misma* secuencia por ambos controladores.

**Scope `(algorithm)`:**

- `controller.py` — la máquina de estados compartida (interlocks, ámbar, todo-rojo,
  latch de preemptión, `same_axis`). `adaptive_controller.py` (presión + cota
  anti-inanición + preemptión) y `fixed_controller.py` (ciclo fijo, **sin**
  preemptión) difieren **solo en `choose`**: es lo que hace que el benchmark compare
  una política y no dos implementaciones.

**Alcance de este rebanado:** giros al paso (fases de eje N-S/E-O) + EVP. La fase de
**giro izquierda protegido** del navegador necesita geometría de carril (qué girador
alcanza la línea, qué movimientos cruzan) que un modelo de colas no tiene; queda para
un rebanado posterior, no olvidada.

**Verificado:** `.venv\Scripts\python.exe -m pytest` → **54 en verde** (36 previos +
18 nuevos). El test del benchmark corre **3 semillas** y exige que adaptativo gane en
espera media *y* en respuesta de emergencia, sin sacrificar caudal. En la corrida de
referencia (quiet 30, avenida asimétrica, semilla 20260929): adaptativo **16,5 s** vs
fijo **32,6 s** de espera media; **10,3 s** vs **33,8 s** de respuesta de emergencia;
caudal 74 vs 68 veh/min; cola máx. 23 vs 39.

**Hallazgo, para Fase 4/5:** con el reparto asimétrico del benchmark y
`quietRatePerMinute = 55` (el default) la demanda supera la capacidad del cruce
(~2 veh/s) y el régimen es de saturación. Ahí el adaptativo **sigue moviendo más
vehículos** (92 vs 79 veh/min; cola máx. 392 vs 512) pero su espera media **sube** por
encima del fijo (160 vs 135 s): vacía el eje cargado y deja esperar al ligero. No es
un defecto del controlador, es el régimen — por eso el test del benchmark corre por
debajo de capacidad y exige el resultado en ese régimen.

### 3.7 Fase 3 — motor de ticks y benchmark CSV (commiteado)

Segundo rebanado de la Fase 3: **cerrar los dos deliverables que faltaban**. El
transporte (socket) queda para la Fase 4, que es donde `PLAN.md` lo sitúa.

- `app/services/simulation/tick_engine.py` — el motor. `state.run` tocaba la
  secuencia entera en un bucle; aquí se le da la vuelta: `SimulationEngine.step()`
  avanza **un** tick y devuelve los eventos que produjo, y `run_session(engine, sink,
  sleep=…)` lo conduce a ritmo real. Es el `world.ts` del backend: **el único punto
  que empareja una política con el modelo** (importa `algorithm/`), por eso el motor
  va en `simulation/` pero **no se re-exporta** desde `simulation/__init__.py` — así
  no se crea un ciclo con `algorithm/`, que a su vez lee `simulation.state`.
  - `EngineConfig` (session_id, quiet_rate, type_weights, `mode: ControlMode`, seed,
    duration, dt). `ControlMode` se toma de `app/models/enums.py` (el vocabulario
    canónico) y mapea a `AdaptiveController`/`FixedController`.
  - Eventos (camelCase, el contrato de la Fase 4): `tick` (el snapshot entero por
    tick), `phase_change` (edge de fase, con `reason`), `evp_activated` (**rising
    edge** de la preemptión de la *política*, no del hecho del modelo), `session_ended`
    (una vez, al llegar al horizonte). `snapshot()` sirve también para el dashboard.
  - Decisión: la preemptión se detecta con `controller.preemption_request(state)` y
    **después** de la descarga — un EV que llega a un verde ya servido se despeja en
    el acto y **no** anuncia preemptión (correcto: no hizo falta); un fijo **nunca** la
    reporta.
- `app/services/simulation/benchmark.py` — `compare(config, duration)` juega **una**
  secuencia generada por ambos controladores y devuelve las dos `Metrics`;
  `to_csv(comparison)` la rinde `metric,adaptive,fixed`. `python -m
  app.services.simulation.benchmark` imprime el CSV (artifact de la Fase 3).

**Verificado:** `.venv\Scripts\python.exe -m pytest` → **63 en verde** (54 previos +
9 nuevos en `tests/test_tick_engine.py`). El CSV de referencia sale idéntico al
núcleo: 16,519 s / 74,012 / 10,309 / 23 (adaptativo) vs 32,583 / 67,911 / 33,788 /
39 (fijo).

### 3.8 Fase 4 (backend) — el transporte over Socket.io (commiteado)

Tercer rebanado: **cablear la emisión**, lo único que faltaba del lado servidor.
El stub de `ws/server.py` ya no es un stub: ahora **streama ticks reales**. El
frontend (cliente socket + panel de métricas reales) queda para el siguiente
rebanado, porque necesita diseño (Impeccable).

- `app/api/ws/hub.py` — `SessionHub`: **una tarea `asyncio` por sesión**, con una
  `SimulationEngine` cada una, que llama a `run_session` y reenvía cada
  `EngineEvent` por un `emit` inyectable. **No conoce Socket.io** (el `emit` es un
  parámetro), así que se testea con un grabador y un `sleep` que cede sin esperar.
  `start` **reemplaza** la corrida previa de la misma sesión (no dos motores
  peleando por un room); `stop` cancela y espera; una corrida terminada se limpia
  sola; hay **tope de corridas** (`max_runs`, default 8) porque el stream es
  público y sin auth. `engine_config(request, duration)` traduce el payload.
  - **Bug encontrado y corregido**: `stop` confiaba en el `finally` de la tarea
    para limpiar el registro, pero una tarea cancelada **antes de su primer
    `await`** nunca entra a su corrutina y por tanto **nunca corre su `finally`** →
    la sesión quedaba registrada. Ahora `stop` limpia el registro él mismo; el
    `finally` (con comprobación de identidad) solo cubre el final natural.
- `app/api/ws/server.py` — la capa fina: `submit_config` (`{sessionId, config}`)
  valida con `SimulationStreamRequest`, arranca la corrida y responde
  `simulation_status {ticking: true}`; `stop_session` (`{sessionId}`) la termina;
  `disconnect` termina la corrida que **esa** conexión arrancó (se recuerda el
  dueño por `sid`). Los eventos se emiten al room `session:<id>` con el `kind` como
  nombre de evento y `sessionId` en el cuerpo. El stream sigue **público y sin
  auth** (el REST es donde viajan las credenciales); el tope del hub es lo que lo
  acota.
- `app/schemas/stream.py` — `SimulationStreamRequest` reutiliza
  `SimulationConfigCreate` (mismo contrato que `POST /configs`); `StopRequest`.

**Verificado:** `.venv\Scripts\python.exe -m pytest` → **71 en verde** (63 previos +
8 de `tests/test_socket_hub.py`). Además, smoke test de los handlers contra un
`SessionHub` real: `submit_config` arranca, `stop_session` detiene, un config
inválido y un `disconnect` ajeno no rompen, `stop_all` limpia.

---

### 3.9 Fase 4 (backend emparejado + pausa, y frontend real) — **commiteado**

Cuarto rebanado. Cierra el lado servidor que faltaba (**correr las dos políticas a
la vez** y **pausar**) y cablea el **frontend real** (cliente socket + panel de
métricas en vivo). Diseño previo: brief Impeccable en
`.impeccable/surfaces/frontend-src-components-dashboard-metricspanel-tsx.md`.

**Backend (committeable, tests en verde):**

- `app/services/simulation/state.py` — se rastrea la espera **por acceso**
  (`served_by_arm` / `wait_by_arm`) para que `mean_wait(arm)` sea la media real de
  cada acceso y no la global.
- `app/services/simulation/tick_engine.py` — **`SessionEngine(config)`**: corre
  `adaptive` **y** `fixed` sobre la **misma** secuencia de llegadas (una semilla,
  dos controladores), así el tick lleva `adaptive`, `fixed`, un mapa
  `vehiclesProcessed: {adaptive, fixed}`, `congestedShare` y `queue[]`. `step()`
  avanza **ambos** en sincronía. `SimulationEngine` / `run_session` quedan intactos
  (tests y benchmark los usan).
  - **Por qué un mapa:** el toggle de modo del navegador **re-lee** la misma
    corrida sin reiniciarla; con un solo número, cambiar de estrategia re-etiquetaría
    el total de una política como el de la otra.
- `app/api/ws/hub.py` — el hub usa `SessionEngine`; añade `_gates` (un
  `asyncio.Event` por sesión), `pause` / `resume` / `is_paused`. El bucle del
  `_drive` es propio y hace `await gate.wait()` en **frontera de tick** (la pausa
  nunca corta un tick por la mitad).
- `app/api/ws/server.py` — eventos `pause_session` / `resume_session` (reutilizan
  `SimulationStreamRequest`); `simulation_status` ahora incluye `paused` (en
  connect, submit, stop, pause y resume). `_emit` **sella `sentAt`** (epoch ms) en
  cada evento: la latencia one-way no es medible sin una hora de envío, y ponerla en
  el motor volvería dependientes del reloj el benchmark y sus tests. Vive en el
  wire, no en el modelo.
- Tests: `test_a_paired_tick_carries_both_strategies`,
  `test_a_paired_engine_is_two_policy_runs_over_one_sequence`,
  `test_a_streamed_tick_carries_both_policies`,
  `test_pausing_holds_a_run_without_ending_it`,
  `test_the_wire_envelope_stamps_every_event`. → **71 → 76 en verde**.

**Frontend (cliente):**

- `src/services/socket.ts` — `openSimulationStream()` abre el namespace
  `/simulation` y expone `start/pause/resume/stop` + `peek()`; `toMetricsFrame()`
  traduce el tick al `MetricsFrame` que consume la tienda. Marca `stale` a los
  1500 ms sin tick.
- `src/store/streamStore.ts` — `connection` / `error` (el badge de estado).
- `src/hooks/useSimulationStream.ts` — instala el **controlador module-level**
  (`ensureSimulationStream`), que vive fuera de React: la vida de la corrida es la
  de la tienda, no la de una pantalla (navegar a `/config` no reinicia el run).
- `src/store/metricsStore.ts` — reescrito: `receive(frame, elapsedSeconds)` pliega
  ticks reales en cabecera + historia (un punto por ventana de 2 s); `reset()`.
- `src/store/simulationStore.ts` — `advance` → `applyTick`; `stop()` graba el
  total real de la estrategia activa.
- `src/components/dashboard/MetricsPanel.tsx` — reescrito: franja de procedencia
  (el dato viene del algoritmo real, no de un mock) + **badge de conexión dentro
  del panel** (Live / Stale / Reconectando / Error); guarda contra `NaN` cuando el
  baseline aún es 0.
- **Eliminados**: `src/services/metrics.ts` (el mock) y
  `src/hooks/useSimulationClock.ts` (el reloj falso). Ya no existe una segunda
  fuente de verdad de métricas junto al stream.

**Verificado (esta sesión):** `tsc -b --noEmit` OK; `oxlint` OK (solo warnings
pre-existentes en `scripts/`); `vite build` OK; backend `pytest` **76 en verde**;
**smoke socket end-to-end** (uvicorn + `socket.io-client` de Node): conecta →
`submit_config` → llegan ticks con `adaptive`/`fixed`/`vehiclesProcessed` →
`pause_session` deja de emitir (**0 ticks durante la pausa**) → `resume` reanuda →
`stop_session` cierra. **Latencia one-way medida** (`Date.now() - sentAt`, 30 ticks
en localhost): **p95 0.67 ms**, máx 0.89 ms — muy por debajo del umbral de 150 ms,
que cierra el único ítem de la Fase 4.

**Queda aquí:** solo **el pulido visual** (ver Fase 6 de `PLAN.md`: más elementos en
el dashboard, mejores animaciones y, sobre todo, **corregir los cruces diagonales**
de la animación en `frontend/src/simulation/core/`).

**Commits (3, en orden de dependencia, cada uno compila solo):**

```
feat(engine):     run both policies over one arrival sequence per session
feat(ws):         let a streamed run pause and resume at a tick boundary
feat(realtime):   stream live metrics from the backend into the panel
```

No se pudieron separar más fino sin romper el build: el cambio de tipo de
`vehiclesProcessed` (número → mapa) obliga a tocar el mock, la tienda y el test
viejo en el mismo paso, así que cada commit lleva su test donde la aserción cambia
(los dos primeros incluyen sus tests; separarlos dejaría la suite roja). El tercero
es todo el frontend: `vehiclesProcessed` pasa a mapa, se borran el mock
(`services/metrics.ts`) y el reloj (`hooks/useSimulationClock.ts`), y el panel lee el
stream real. El `docs` del final cierra `PLAN.md`, este archivo y el brief de
`.impeccable/surfaces/`.

---

### 3.10 Fase 6 — pulido visual (primer rebanado, commiteado)

Primer rebanado de la Fase 6, y es el que el usuario pidió como siguiente paso.
**Todo el cambio es del renderer**
(`frontend/src/simulation/three/entities/LanePath.ts`, commit `70c9016`); `core/`
**no se tocó**, así que no hubo que re-correr las puertas del motor.

**El defecto diagnosticado ("cruces diagonales") resultó ser un hueco del render,
no del modelo.** `PLAN.md` lo había anotado como un problema de geometría en
`core/` (destinos de giro en `layout.ts`, movimiento en `fleet.ts`). Lo que salió
del renderer es que **el giro siempre se dibujó bien**: lo que faltaba era
**pintura en el suelo que dijera por dónde va el giro**. Una caja de intersección
vacía se lee como asfalto en blanco, y por eso un coche que la atraviesa
describiendo su arco **parece** uno cruzando el cuadro en diagonal.

**Los dos cambios:**

1. **Guías de giro punteadas dentro de la caja** (`buildTurnGuides`). Una línea
   punteada por **movimiento de giro a la izquierda**, muestreada directo de
   `movement.route.samples` —la ruta real del modelo—, de modo que la pintura que
   lee el conductor y la curva que dibuja el coche son **la misma geometría**; una
   guía con sus propios puntos de control sería una segunda definición del giro,
   más silenciosa, que se desvía en cuanto se toca cualquiera de las dos. Solo se
   pinta el tramo **dentro** de la caja (`GUIDE_INSET = JUNCTION_HALF − 0,9`): la
   aproximación y la salida ya llevan línea de carril, y una segunda a su lado
   leería como un carril que no existe. Guion 0,9 m / hueco 0,6 m, en el **tier
   tenue** (el de las líneas de carril). **Solo giros a la izquierda**: un giro a la
   derecha es un cuarto de círculo pegado al bordillo que se pinta solo, y guiar
   ambos duplica los arcos hasta una roseta —decoración, no guía.
2. **Cebra reorientada al modo continental.** Las franjas iban **a lo ancho** de la
   calzada, apiladas hacia el conductor; en la cámara a tres cuartos eso se leía
   como una escalera ladeada sobre el asfalto. Ahora van **a lo largo** de la
   calzada y se repiten **a lo ancho** (franja 0,4 m, hueco 0,8 m), con el número
   derivado de `crosswalk.length` y la profundidad de `CROSSWALK_WIDTH` —ambos de
   `layout.ts`, no elegidos en el renderer.

**Verificado:** `npm run build` (`tsc -b` + `vite build`) pasa con el cambio (solo
el aviso informativo de siempre, el chunk de three.js > 500 kB) y `prettier
--check` está limpio en el archivo. **Revisado en render headless** (Chrome sin
ventana, WebGL por SwiftShader) a **1440px y 375px**, no solo leído: la cebra se
lee como paso continental y las guías quitan el efecto de cruce diagonal.

**Decisión sobre los giros a la derecha:** se probó el A/B con los cuatro arcos
derechos añadidos y el conjunto se lee como **dos anillos concéntricos** —los
izquierdos por el centro, los derechos por las esquinas—: más ruido, no más
información. Se quedan **solo los izquierdos**, que es lo que el código pinta.

**Falta de este rebanado:** nada de código; queda la mirada del usuario en su
navegador (`/observer`, 1440px y 375px). El resto del pulido (más instrumentos en
el dashboard, mejores animaciones) y el deploy siguen intactos en `PLAN.md` § Fase 6.

---

### 3.11 Fase 6 — pulido visual (segundo rebanado: rack + latencia, commiteado)

Segundo rebanado, commiteado en `1c9375e feat(dashboard): compare both strategies
and read the live latency`, precedido por `da57b80 fix(ui): keep the custom font
sizes when merging classes`. Es frontend puro (panel de métricas, transporte del
stream y utilidad de clases); `core/` **no se tocó**.

**1. Rack de comparación (`StrategyComparison.tsx`).** El panel mostraba tres
`Stat`, cada uno con la lectura de la política activa y su comparación en el
`hint`. Ahora muestra **las cinco lecturas por política a la vez**, como pares de
barras: espera media, vehículos atendidos, caudal, cola máxima y respuesta de
emergencia. Detalles que importan:

- **Escala por fila, no entre filas.** Una cola de nueve y una espera de nueve
  segundos son unidades distintas; una escala compartida las haría parecer
  comparables. Cada fila se normaliza contra su propio máximo.
- **Piso de escala por fila** (5 s, 1 veh, 10 veh/min, 5 veh, 10 s): evita que una
  corrida quieta convierta una diferencia de un vehículo en una barra llena. Es un
  piso de render, nunca cambia el valor impreso.
- **Adaptativo = `bg-flow`, ciclo fijo = `bg-muted`**, el mismo lenguaje que el
  `FlowChart`. La política activa se marca solo en el **color del texto**, porque
  el toggle cambia qué lectura se titula, no cuál existe.
- **Emergencia con cero se muestra `—`**, no `0,0 s`: cero significa "no se
  observó", no "respondió al instante". Los ceros legítimos (cola 0) sí se
  imprimen.
- **Sin tween de ancho.** A 10 ticks/s una transición de 300 ms se pasa la vida
  persiguiendo un valor que no alcanza y la barra discreparía del número de al
  lado. La barra avanza con el tick y el número es siempre su verdad. El estado
  vacío sigue mostrando `—` y barras a cero.
- Reemplaza los tres `Stat`; el delta de espera promovido se queda arriba como
  titular y el rack es su evidencia.

**2. Latencia one-way en vivo.** `sentAt` ya viajaba en el wire y se ignoraba. El
controlador (`services/socket.ts`) ahora calcula `Date.now() - sentAt` en cada
tick, mantiene una **ventana de 60 ticks** (~6 s) y publica en `streamStore`
(`latency`) la **última** lectura y el **p95**. La franja de procedencia las
muestra en mono/tabular (`p95`/`última`, ms), con `—` antes del primer tick. Se
**resetea al arrancar y al cerrar** la corrida, junto con el resto del estado del
stream. Supone relojes sincronizados entre navegador y backend (cierto en el host
de la demo y en despliegues con NTP); un desfase se muestra como un número
desfasado, no se esconde. Con el backend local, el p95 headless ronda decenas de
ms por la carga del render y la última lectura baja a décimas de ms — la ventana
incluye el pico de arranque y se estabiliza a los 6 s.

**3. `da57b80` — el bug de `tailwind-merge`.** `cn()` usaba `twMerge` a secas, que
no conoce los tamaños de fuente personalizados (`text-micro`, `text-display`,
`text-metric`): los leía como utilidades `text-*` de color y **borraba el tamaño**
cuando se fusionaba un color después (`text-primary`). Efecto medido: el rack
mostraba sus etiquetas a 16 px en vez de 11 px y el delta promovido del panel
llevaba **desde su creación** renderizando a tamaño de cuerpo, no a `text-metric`.
Se registran los tres tamaños con `extendTailwindMerge` en `utils/cn.ts`. Es el
único cambio de esta sesión fuera del panel, y es el arreglo que hace que el
`text-micro`/`text-metric` del resto del panel se vea como `DESIGN.md` manda.

**Verificado:** `npm run build` (`tsc -b` + `vite build`) verde; `oxlint` solo con
los warnings preexistentes de `scripts/`; `prettier --check` limpio en los archivos
tocados; **`impeccable detect` sin hallazgos**. Render headless con **backend en
vivo sobre SQLite** (Chrome + WebGL SwiftShader) a **1440px y 375px**, en modo
adaptativo, con el toggle a **ciclo fijo** (titular +24 % en rojo, etiquetas
activas en blanco) y en el **estado vacío** tras detener (todo `—`). La sonda de
desborde a 375px devuelve `wide: []` (nada supera el viewport). El backend de la
verificación se **detuvo** después; no dejó archivo SQLite (el engine es perezoso y
nunca se usó). Falta solo la mirada del usuario en su navegador.

**Decisión de diseño que conviene no revertir:** el rack **no anima el ancho**. Se
probó con `transition-[width] 300 ms` y el render headless mostró barras de
longitudes distintas junto a valores impresos iguales (3,1/3,1): la barra iba
retrasada respecto al número. A 10 Hz la barra instantánea es más honesta que una
suave.

---

## 4. REGLAS DEL MODELO QUE NO HAY QUE REESCRIBIR

Cada una nació de un bug concreto medido. Antes de "optimizar" o "simplificar"
cualquiera, lee su comentario en `world.ts` y las mediciones de `PLAN.md`.

1. **`sharedLaneLeaderLimit` + tabla `DIVERGENCE`.** Sin él, un coche que seguía
   recto se quedaba sin líder detrás de un girador que salía del carril con otro
   `movement.id`. Restricción longitudinal, no barrido de cuerpo: un barrido mataría
   el tráfico en congestión.
2. **`opposingStreamBlocks` + `arrivalTime`.** La cesión se liberaba con el primer
   coche de la cola opuesta, cuando el segundo estaba a punto de ocupar el hueco.
   Pregunta por el flujo entero.
3. **`holdAtConflict` se libera con `opposingStreamBlocks`**, no con "el líder ya
   pasó". Aplica a cualquier giro. Y `stillApproaching` **pide además que algo de esa
   corriente venga rodando** (`ROLLING_SPEED`): una cola parada en rojo es corta del
   cruce para siempre, y cederle es un livelock, no una cesión.
4. **`holdForBodyConflict`: dónde parar y cuándo soltar son dos preguntas
   distintas.** `bodyOverlapSpan` devuelve un **intervalo**, no un punto.
   `pinnedBodySpan` barre el cuerpo retenido contra todos los puntos entre la espera
   y la línea.
5. **`junctionIntrusion` toma el MÍNIMO sobre los ejes del SAT.** Con el máximo,
   un coche en su línea reportaba 9,62 m de intrusión y dos coches se bloqueaban
   mutuamente en las líneas de stop.
6. **`occupiesBox` con tolerancia de cola, `BOX_INTRUSION = 0,15`.** Y con
   tolerancia al vehículo que está *en* su línea: un test por arco lo cuenta como
   ocupante y la intersección entera se paraliza.
7. **`heldArc = stopS - length - 0,3`.** El punto de retención va ANTES de la línea.
   Si cae dentro de la caja, el freno asintótico no puede pararlo.
8. **`boxConflict` sale con `false` en cuanto `vehicle.s >= stopS + 0,05`.** Un
   vehículo que ya cruzó su línea queda exento de la arbitración de caja.
9. **El clamp de `holdAt`Acota el avance del frame y nunca mueve hacia atrás:**
   ```typescript
   let advance = vehicle.v * dt
   if (holdAt !== null) {
     const room = holdAt - vehicle.s
     if (room > 0 && advance > room) { advance = room; vehicle.v = 0 }
   }
   vehicle.s += advance
   ```
   La versión anterior (`if (holdAt > vehicle.s) vehicle.s = holdAt`) teleportaba a
   la línea a todo vehículo recién nacido: 742 solapamientos en 6 segundos mientras la
   métrica decía 0. No tocar sin leer el commit `e8cd882`.
10. **Una definición de "dentro de la caja".** `clearingJunction` y `occupiesBox`
    discrepaban (centro vs cuerpo) y producían una retención inalcanzable: el
    vehículo retenido a 71,65 cuando su línea está en 76,00. Ahora todo pasa por
    `occupiesBox`. Si añades un tercer consumidor, que llame a esa.
11. **`PRESSURE_HORIZON = 120`.** Sin tope, `waited` se autorrefuerza y el cruce
    queda capturado por un solo vehículo.

**Si alguna te parece dudosa, PREGUNTA antes de relajarla.** Existe porque su
ausencia costó solapamientos medidos, y cada vez que se "relajó" aparecieron dos más
detrás.

---

## 5. CÓMO TRABAJAR

**El método que funcionó:** instrumentar → cambiar → medir → **medir otra vez en 8
semillas** → verificar 10 min → commitear solo con 0 violaciones. **Ninguno de los
cinco bugs se encontró leyendo el código**; todos se encontraron leyendo trazas.

**El método que NO funcionó:** partir de una hipótesis sobre el código y cambiarla
sin instrumentar antes. Cinco cambios seguidos empeoraron los números, y dos
diagnósticos de la sesión fueron erróneos (`corner-decision.ts` —sizing, y las
velocidades de la flota). **Si un cambio deja el resultado peor, eso es información
sobre el mecanismo, no un motivo para intentar el siguiente ajuste.**

**Comparar siempre contra el baseline de la MISMA configuración.** Comparar contra
una corrida con otra modificación ya aplicada hizo que un arreglo pareciera una
mejora cuando era una regresión — pasó con la puerta `sweptOverAStoppedBody`, que se
midió A/B con `SWEEP_GATE=0/1` precisamente por eso.

**Verificar `npm run build` antes de cada commit** (regla de `GUIA_COMMITS.md`: cada
commit compila solo). Conventional commits en inglés, un cambio lógico por commit.

**El conmutador `process.env` que se usó para el A/B ya no existe.** Se revirtió
porque `core/` no lee `process` por contrato; si reintroduces algo así,
`npm run build` lo detecta, pero la frontera es una decisión de diseño y no un
detalle.

---

## 6. ESTADO DE GIT

Rama `feat/frontend-foundation`. Sesiones (motor, canvas 3D, configuración+informes,
transversales, fidelidad+landing, **backend**, **cableado del frontend**), todos los
commits verificados: el frontend con `npm run build` y las puertas en verde (y
desde 1-G, además **cada commit compilando solo** en un worktree limpio con
`node_modules` junctionado, `TSC=0`); el backend con **cada commit importando solo**
en un worktree limpio (`compileall` + import de cada módulo, 0 fallos) y la suite en
verde.

**Estado de la rama (verificado con `git ls-remote`):** el remoto
`origin/feat/frontend-foundation` está en **`b420b0c docs: record the tick engine and
the benchmark`**; todo lo posterior está por delante —la sesión del transporte
Socket.io (Fase 4 backend, §3.8) **y** esta sesión (§3.9, con sus docs)—, es decir,
**ninguno de los dos rebanados está pusheado**. La afirmación anterior de «0 commits
por delante» era incorrecta (el `git branch -vv` local ni siquiera traía el ref
fresco). `origin/main` **no existe**; hay una rama local `main`
en `84fbe44` (instantánea del estado al abrir la sesión del motor), sin upstream.

La sesión §3.9 añade los commits del final de esta sección; el árbol quedó limpio
tras el `docs` que los cierra. **Push solo con autorización del usuario.**

**Primer rebanado de la Fase 6, commiteado:** `70c9016 feat(simulation): paint the
junction's turn guides and continental zebra` (§3.10). Compila (`npm run build`
verde) y se revisó en render headless a 1440px y 375px. El `docs` que cierra este
rebanado actualiza `PLAN.md` y este archivo.

**Segundo rebanado de la Fase 6, commiteado:** `da57b80 fix(ui): keep the custom
font sizes when merging classes` y `1c9375e feat(dashboard): compare both
strategies and read the live latency` (§3.11). Cada uno compila solo, en ese orden
(el rack usa el arreglo de `cn`). El `docs` que cierra este rebanado actualiza
`PLAN.md` y este archivo.

Último commit antes de esta sesión: `e174b8a docs: record the Phase 2 commits and
where to resume`. La **Fase 2 está commiteada** (17 commits, `b35b535`…`1de3c03`);
el árbol de trabajo quedó limpio — ver §3.4. La sesión de cableado del frontend
añade los commits de abajo.

Sesión del backend (17, en orden):

```
chore(deps):     add the backend dependency manifest
chore(config):   add the backend environment template
feat(core):      add the settings object
feat(db):        add the shared base, UTC column type and enum helper
feat(db):        add the ORM models
feat(db):        add the async engine and session dependency
feat(core):      add password hashing, JWT and the request dependencies
feat(db):        seed the roles and the demo operator
feat(schemas):   add the camelCase request and response contract
feat(services):  add the auth, config and session services
feat(api):       add the REST routers and the app factory
feat(ws):        add the socket.io simulation channel
build(db):       add the alembic configuration
feat(db):        add the initial schema migration
test(backend):   add the API, realtime and settings suite
build(docker):   add the API image and the local compose stack
docs:            record the completed Phase 2 backend
```

Sesión de cableado del frontend (3, en orden de dependencia):

```
feat(services): add the axios client with bearer injection
feat(services): call the real auth API instead of the mock
feat(store):    persist and revoke the session token
```

Sesión del motor (6):

```
fix(scripts):   judge signal aspects per movement, not per arm
fix(simulation): close the overlap count to zero
test(simulation): add the overlap and livelock measurement harness
chore(scripts): keep the one-use probes from the overlap investigation
docs(design):   migrate the renderer plan from Phaser 2D to Three.js 3D
docs:           close the Sprint 1-E engine work and hand off the canvas
```

Sesión del canvas 3D (8), en orden de dependencia — cada uno compila solo:

```
feat(events):    add typed SimulationEventBus between engine and renderer
feat(simulation): step the world in a shared RAF runner
feat(simulation): build the stage and road layer from layout constants
feat(simulation): add vehicle, pedestrian and signal meshes
feat(simulation): mirror the world into a Three.js scene
feat(canvas):    add the ThreeCanvas WebGL wrapper
feat(canvas):    run the real engine in SimulationCanvas
docs:            record the canvas swap in PLAN and CONTINUIDAD
```

Sesión de configuración e informes (Sprint 1-F, 8), en orden de dependencia:

```
feat(simulation): let the operator weigh the arriving fleet
feat(config):     persist operator parameters with a validated schema
feat(reports):    record finished runs in a local session log
feat(simulation): build the world from the operator's configuration
feat(config):     add the configuration screen
feat(reports):    add the session history screen
feat(routes):     replace the placeholders with the real screens
docs:             record the configuration and reports sprint
```

Sesión de concerns transversales (Sprint 1-G, 8), en orden de dependencia —
cada uno verificado compilando solo en worktree limpio:

```
chore(frontend): drop the unused grid-backdrop utility
fix(frontend):   keep the spinner visible under reduced motion
feat(layout):    add a skip link to the console shell
feat(a11y):      give the mode radio groups real keyboard semantics
fix(config):     widen the slider hit box to the 44px touch floor
feat(layout):    explain the offline connection badge as design, not fault
docs:            add a root README with run instructions and demo credentials
docs:            close the cross-cutting sprint and the frontend phase
```

Sesión de fidelidad y landing (Sprint 1-H, cerrado), en orden de dependencia:

```
docs:            open the scene-fidelity sprint from browser verification
fix(simulation): keep cars off the crosswalk without clipping a turner
feat(simulation): loop pedestrians and stop cars driving through them
feat(frontend):   add the public landing before the login door
docs:             record the landing and the sprint state
docs:             place PRODUCT.md and DESIGN.md at the root in the tree
fix(simulation):  paint the zebra at the stop line's own brightness
feat(simulation): light every vehicle's head and tail
feat(simulation): paint the lane arrows layout.ts promised
feat(simulation): put a fire truck in the emergency rotation
docs:             close the scene-fidelity sprint
```

Sesión de la Fase 3 — núcleo del control (4, en orden de dependencia):

```
feat(engine):    add the queueing model and its arrival generator
feat(algorithm): add the adaptive and fixed signal controllers
test(backend):   cover the queueing model and both controllers
docs:            record the Phase 3 control core
```

Sesión de la Fase 3 — motor de ticks y benchmark (4, en orden de dependencia):

```
feat(engine):  add the tick engine and its per-session event stream
feat(engine):  benchmark both policies on one sequence and export CSV
test(backend): cover the tick engine and the benchmark export
docs:          record the tick engine and the benchmark
```

Sesión de la Fase 4 (backend) — el transporte Socket.io (4, en orden de dependencia):

```
feat(schemas): add the realtime stream payloads
feat(ws):      stream a session's simulation over Socket.io
test(backend): cover the session hub's lifecycle
docs:          record the Socket.io transport
```

Sesión de la Fase 4 (backend emparejado + pausa, y frontend real) — **commiteada**.
Tres commits que **compilan solos**; no se pudieron separar más fino sin romper el
build (el cambio de tipo de `vehiclesProcessed`, número → mapa, obliga a tocar el
mock, la tienda y el test viejo en el mismo paso, así que cada commit lleva su test
donde cambia la aserción):

```
feat(engine):     run both policies over one arrival sequence per session
feat(ws):         let a streamed run pause and resume at a tick boundary
feat(realtime):   stream live metrics from the backend into the panel
```

`docs: record the paired engine, the pause and the live metrics panel` cierra la
sesión (este archivo, `PLAN.md` y el brief de `.impeccable/surfaces/`). Más dos
`docs:` de corrección del estado de push (el remoto estaba en `b420b0c`, no a la
altura del HEAD).

Cierre de la Fase 4 — la latencia (3, en orden de dependencia):

```
feat(ws):    stamp every streamed event with a send time
feat(types): carry the wire's send time in TickPayload
docs:        record the latency measurement
```

Los dos primeros incluyen sus tests (las aserciones de `vehiclesProcessed` cambian
con el tipo; separarlos dejaría la suite roja). El tercero es todo el frontend: el
`vehiclesProcessed` pasa a mapa, se borran el mock (`services/metrics.ts`) y el
reloj (`hooks/useSimulationClock.ts`), y el panel lee el stream real. `docs` al
final: `PLAN.md`, este archivo y el brief de `.impeccable/surfaces/`.

---

## 7. RETOMAR AQUÍ (próxima sesión)

**Estado al cerrar:** Fases 1–4 cerradas y verificadas (motor, canvas, configuración
e informes, backend FastAPI, algoritmo —§3.6 §3.7—, transporte Socket.io —§3.8—, y
**el frontend consume el stream real** con **pausa** y **latencia one-way medida**
p95 0.67 ms —§3.9—). **76 tests en verde**; `tsc -b --noEmit`/`oxlint`/`vite build`
OK; smoke socket end-to-end OK. **La Fase 6 arrancó**: el primer rebanado del pulido
visual (§3.10) está **commiteado** (`70c9016`) en
`frontend/src/simulation/three/entities/LanePath.ts` — guías de giro punteadas
(solo izquierdas) y cebra continental —, revisado en render headless a 1440px y
375px y con `npm run build` verde. El **segundo rebanado** (§3.11) también está
commiteado (`da57b80` + `1c9375e`): el **rack de comparación** de las cinco
lecturas por política en el panel y la **latencia one-way en vivo** (p95/última)
en la franja de procedencia; `impeccable detect` sin hallazgos y sonda de desborde
375px limpia.

**Siguiente paso — por orden:**

1. **Resto del pulido visual (Fase 6)** — lo que el usuario pidió: más instrumentos
   en el dashboard (el rack y la latencia ya están; falta llevar instrumentos al
   lado del canvas, no solo a la columna de métricas) y mejores animaciones.
   `PLAN.md` § Fase 6.
2. **Fase 5 (persistencia + informes)** — persistir sesiones/métricas, informes
   PDF/CSV, historial real. Y de paso los **skeletons** diferidos (§3.1 item 5): ya
   hay operación asíncrona con datos.
3. **Deploy (Fase 6)** — Vercel + Railway, env de producción, smoke test de URLs.

**Git:** los rebanados §3.9, §3.10 y §3.11 y el cierre de latencia están
commiteados; `origin` en `b420b0c` (ninguno pusheado). El árbol queda limpio tras
el `docs` de §3.11. **Push solo con autorización del usuario** (verifica con
`git ls-remote`).

**Rebanado no hecho de la Fase 3:** los giros a la izquierda protegidos necesitan
geometría de carril que el modelo de colas no tiene (ver §3.6); van en un rebanado
posterior.

**Pendiente visual de 1-H (sin cambios):** verificación de `/` por el usuario a
375px / 1440px / reduced-motion / teclado, y `impeccable polish` después.

**Prompt para retomar (pegar tal cual mañana):**

> Retomamos UrbanSync Sim. Lee `CONTINUIDAD.md` (§0, §3.9, §3.10, §3.11, §6, §7)
> y `AGENTS.md`. Fases 1–4 cerradas y dos rebanados de la Fase 6 commiteados
> (`70c9016`: guías de giro izquierdas + cebra continental en `LanePath.ts`;
> `da57b80` + `1c9375e`: rack de comparación por política y latencia one-way en
> vivo; `core/` intacto). Sigue el resto del pulido visual (más instrumentos,
> mejores animaciones) y luego la Fase 5 (persistencia + informes + skeletons).
> No tocar `frontend/src/simulation/core/` sin correr las puertas.

