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
completa y verificada**: API FastAPI escrita, **36 tests en verde** sobre SQLite
*y* sobre Postgres real, migración Alembic que reproduce los modelos
(`alembic check` sin diferencias), canal socket.io cableado (sin ticks todavía),
imagen Docker construida y stack completo probado end-to-end. Todo bajo
`backend/` (más `docker-compose.yml`), **sin commitear**. Ver §3.4.

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
3. **Fase 2 — Backend API** (`PLAN.md` § Phase 2): **completa y verificada**,
   ver §3.4. Falta solo **decidir si se commitea** y confirmar el canal realtime
   (socket.io vs. la ruta literal de PLAN).
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

### 3.4 Fase 2 — Backend API (en curso, sin commitear)

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

**Decisión pendiente del usuario:** el canal realtime es **socket.io** (namespace
`/simulation`), no la ruta literal `/ws/simulation/{session_id}` de PLAN. Tres
fuentes (stack de `AGENTS.md`, el log de decisiones, la Fase 4 con
`socket.io-client`) piden socket.io; solo el bullet de PLAN pedía la ruta.
Confirmar antes de la Fase 4.

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

Rama `feat/frontend-foundation`. Cinco sesiones (motor, canvas 3D,
configuración+informes, transversales, fidelidad+landing), todos los commits
verificados con `npm run build` y con las puertas en verde — y desde 1-G, además
**cada commit verificado compilando solo** en un worktree limpio con
`node_modules` junctionado (`TSC=0`). La rama está **29 commits por delante de
`origin` y sin pushear**: empujar es decisión del usuario. Existe además una
rama local `main` en `84fbe44` (instantánea del estado al abrir esta sesión),
sin upstream: `origin/main` no existe todavía.

Último commit: `901153c fix(frontend): align the landing with the design tokens`.
El trabajo de la **Fase 2 está sin commitear** (`backend/` y `docker-compose.yml`
en la raíz) — ver §3.4.

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
