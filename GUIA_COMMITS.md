# GUIA_COMMITS.md — UrbanSync Sim

> Guía de commits para el repositorio. Complementa la subsección **Git** de
> `AGENTS.md` (Code conventions), que es el resumen breve; este documento es la
> referencia completa con tipos, scopes, orden de dependencia y ejemplos.
>
> El proyecto es un **monorepo de dos apps**: `frontend/` (React + TypeScript +
> Vite + TailwindCSS + Phaser.js + Zustand) y `backend/` (Python + FastAPI +
> SQLAlchemy + Alembic). Todo lo de abajo está pensado para esa estructura.

---

## 1. Por qué "por etapas" y no "todo en un commit"

Un solo commit gigante ("scaffold completo de UrbanSync Sim") es difícil de
revisar, difícil de revertir si algo falla, y no cuenta la historia real de cómo
se construyó el proyecto. La idea es que el historial de git sea legible: cada
commit debe poder aplicarse solo, sin depender de código que todavía no existe.

Por eso el orden importa: no tiene sentido commitear `IntersectionScene.ts` antes
que `SimulationEventBus.ts` que emite los eventos que la escena escucha, ni
`DashboardPage.tsx` antes que `mockTicker.ts` que genera los datos que la página
renderiza.

---

## 2. Idioma de los commits: **siempre en inglés**

Esta es la regla más rígida del documento. **Los mensajes de commit se escriben
íntegramente en inglés**: tipo, scope, subject, body y footers. Sin excepciones.

```bash
# ✅ Correcto
feat(simulation): add emergency vehicle priority pulse to IntersectionScene
fix(algorithm): respect min green time before switching phase

# ❌ Incorrecto
feat(simulacion): agregar pulso de prioridad para vehiculos de emergencia
fix(algoritmo): respeta el tiempo minimo de verde antes de cambiar de fase
```

**Por qué inglés:** el historial es infrastructure. Se lee en revisiones de código,
en `git blame`, en issues de GitHub y en CVs. Mezclar idiomas lo vuelve
imposible de consultar de forma fiable con `git log --grep`.

**Alcance exacto de la regla:**

| Elemento | Idioma |
| :--- | :--- |
| Mensajes de commit (subject, body, footers) | **Inglés, siempre** |
| Nombres de ramas (`feat/`, `fix/`, `chore/`) | **Inglés, siempre** |
| Nombres de archivo, carpetas, identificadores, tipos | **Inglés, siempre** |
| Comentarios de código | **Inglés, siempre** |
| Textos de UI visibles en la app | **Español** (decisión de producto, ver `PRODUCT.md`) |
| Docs de proyecto (`PLAN.md`, `AGENTS.md`, este archivo) | Español o inglés, indistinto |

Es decir: la documentación y la interfaz pueden estar en español, pero **el código
y el historial no**. Los labels de la UI en español conviven sin problema con
identificadores en inglés: `stat.esperaMedia` renderiza "Espera media".

**Formato del subject:**

```bash
<type>(<scope>): <description in english, lowercase, imperative, no trailing period>
```

```bash
# ✅
feat(ui): add Badge variants for flow severity levels
feat(algorithm): implement pressure-based phase selection

# ❌
feat(ui): Agrega variantes de Badge          # español y no imperativo
feat(ui): added badge variants               # pasado, no imperativo
feat(ui): add badge variants.                # punto final
Feat(ui): add badge variants                 # tipo capitalizado
```

Máximo **72 caracteres** en el subject. Si necesita más, va un `: ` y el resto
en el body, separadas por una línea en blanco.

---

## 3. Tipos de Conventional Commits usados en este proyecto

| Tipo | Cuándo usarlo en UrbanSync Sim |
| :--- | :--- |
| `feat` | Nueva funcionalidad visible: un componente, una página, un endpoint, un tick del algoritmo. |
| `fix` | Corrección de un comportamiento roto. |
| `refactor` | Reorganización de código sin cambiar comportamiento observable (extraer un componente repetido, mover lógica a un servicio, partir un archivo largo). **No usar `style` para esto** — ver nota abajo. |
| `style` | Solo formato/espaciado/linting, sin tocar lógica ni estructura de archivos. Autofix de Prettier u oxlint. |
| `docs` | Cambios en `README.md`, `PLAN.md`, `AGENTS.md`, `docs/`, comentarios de documentación. |
| `chore` | Configuración, dependencias, scaffolding inicial, `.gitignore`, `tsconfig`, `.env.example`. |
| `build` | Cambios en el sistema de build (`Dockerfile`, scripts de `package.json`, `alembic.ini`, CI). |
| `perf` | Mejora medible de rendimiento (reduce frame drops del canvas, evita un N+1 en el backend). |
| `test` | Pruebas (`frontend` cuando existan, `backend/tests/` en Fase 3). |

> **Nota importante — el error más común en proyectos de UI.** Con TailwindCSS el
> "estilo" de la app vive en las clases, y eso genera dos trampas:
>
> - **Extraer markup repetido a un componente nuevo, o mover clases inline a una
>   variante de un componente que ya existía** (p. ej. añadir `variant="danger"`
>   a `Button`) es **reestructuración de código, no cambio de formato**. Usa
>   `refactor`. Si el componente base entra al historial por primera vez en ese
>   commit, entonces es `feat`.
> - **Cambiar un color hardcodeado por un token** (`#0ea5e9` → `bg-accent-500`)
>   es alineación con el design system de `DESIGN.md`: `refactor` si no cambia
>   la intención visual, `fix` si corrige un color que estaba mal.
>
> El tipo `style` es específicamente para formato de código (espacios, comas,
> punto y coma). Nunca para estilos visuales de la app.

---

## 4. Scopes sugeridos (el `(scope)` entre paréntesis)

El scope indica **qué parte del monorepo** toca el commit. Debe ser
inequívoco dentro del repo: si un mismo nombre pudiera aplicar a dos carpetas,
desambigua (`(engine)` vs `(simulation)`).

**Frontend — `frontend/src/`**

| Scope | Cubre |
| :--- | :--- |
| `(ui)` | Componentes base: `Button`, `Badge`, `Card`, `Stat`, `Spinner`, `EmptyState`, `ErrorBoundary`, `Tooltip` |
| `(layout)` | `AppShell`, `Sidebar`, `TopBar`, `PageHeader` |
| `(canvas)` | Wrappers de Phaser en React: `SimulationCanvas` / `PhaserGame` |
| `(dashboard)` | Paneles de métricas y gráficos: `MetricsPanel`, `FlowChart`, `SimulationControls` |
| `(simulation)` | Motor del canvas: `IntersectionScene`, `UIScene`, `Vehicle`, `TrafficLight`, `Lane`, `mockTicker` |
| `(events)` | `SimulationEventBus` y los tipos de eventos Phaser ↔ React |
| `(store)` | Slices de Zustand: `authStore`, `simulationStore`, `metricsStore`, `configStore` |
| `(hooks)` | Hooks de React (`useAuth`, `useSimulation`, …) |
| `(services)` | Cliente HTTP (Axios), Socket.io, servicios de auth |
| `(pages)` | Componentes de ruta: `LoginPage`, `DashboardPage`, `ConfigPage`, `ReportsPage` |
| `(types)` | Interfaces de dominio compartidas en `src/types/` |

**Backend — `backend/app/`**

| Scope | Cubre |
| :--- | :--- |
| `(api)` | Endpoints REST en `app/api/routes/` |
| `(ws)` | Handlers de WebSocket en `app/api/ws/` |
| `(algorithm)` | `adaptive_controller.py`, `fixed_controller.py` |
| `(engine)` | `tick_engine.py`, `vehicle_generator.py`, `state.py` |
| `(db)` | Modelos ORM, sesión de BD, migraciones Alembic |
| `(schemas)` | Modelos Pydantic de request/response |
| `(core)` | Config, security, dependencias de FastAPI |

**Transversal**

| Scope | Cubre |
| :--- | :--- |
| `(deps)` | Altas y subidas de versiones de paquetes |
| `(docker)` | `Dockerfile`, `docker-compose.yml` |
| `(design)` | `PRODUCT.md`, `DESIGN.md`, tokens y `tailwind.config.js` |
| `(config)` | `vite.config.ts`, `tsconfig*.json`, `.oxlintrc.json`, `.prettierrc`, `.env.example` |
| `(docs)` | Documentación general del repo |

Cuando el commit toca **frontend y backend a la vez** (típico del flujo de auth
o de WebSocket), elige el scope del lado donde vive la lógica principal y
menciónalo en el body:

```bash
feat(api): add JWT login endpoint and token dependency
feat(ws): expose per-session simulation tick stream
```

---

## 5. Orden de dependencia: guía por defecto, no ley fija

La lista siguiente es un punto de partida razonable, **pero la regla vinculante
real es otra**: ningún commit puede importar código que se introduzca en un commit
posterior. Antes de aplicar esta lista tal cual, audita los imports reales del
código — si `IntersectionScene` importa `SimulationEventBus`, el bus va *antes*;
si `ProtectedRoute` importa `authStore`, el store va *antes*. Cuando el grafo
real contradiga el orden ilustrativo, gana el grafo real, y el agente debe
explicar el desvío.

Este orden está alineado con los sprints de `PLAN.md`, que ya los secuencia de
forma respetable:

1. **`chore(config)`** — `.gitignore`, `tsconfig.json`, `vite.config.ts`,
   `.oxlintrc.json`, `.prettierrc`, `.env.example`.
2. **`chore(deps)`** — scaffold de Vite, instalación de dependencias, Tailwind v3,
   path aliases. (Sprint 1-A)
3. **`docs(design)`** — `PRODUCT.md` y `DESIGN.md`: paleta, tokens, tipografía.
   Van antes de los componentes porque los componentes los consumen.
4. **`feat(types)`** — interfaces de `src/types/`. Antes que cualquier capa que
   las importe.
5. **`feat(ui)`** — componentes base que consumen los tokens del design system.
6. **`feat(layout)`** — `AppShell`, `Sidebar`, `TopBar`, `PageHeader`, que
   consumen `ui`.
7. **`feat(auth)`** — orden interno obligatorio:
   `authStore` → `services/auth` → `useAuth` → `ProtectedRoute` → `LoginPage`.
   (Sprint 1-C)
8. **`feat(store)`** — `simulationStore`, `metricsStore`, `configStore`.
9. **`feat(simulation)`** — orden interno **inside-out**:
   `SimulationEventBus` → `types` de eventos → `Lane`/`Vehicle`/`TrafficLight` →
   `IntersectionScene` → `UIScene` → `PhaserGame.tsx` → `mockTicker.ts`.
   (Sprint 1-E)
10. **`feat(dashboard)`** — `MetricsPanel`, `FlowChart`, `SimulationControls`.
11. **`feat(pages)`** — `DashboardPage`, `ConfigPage`, `ReportsPage`, que
    ensamblan todo lo anterior. (Sprints 1-D y 1-F)
12. **`docs`** — `README.md`, plantillas, `.env.example` documentado.

### Regla adicional: cada commit compila

Antes de cerrar cada commit, `frontend` debe pasar `npm run build`
(`tsc -b && vite build`) y `oxlint` sin errores. Un commit que no compila rompe
la regla de "cada commit se aplica solo". En el backend, `pytest` debe pasar
cuando el commit toque código con tests.

---

## 6. Cómo se activa esto en la práctica

No hace falta pegar ningún prompt: cualquier agente que lea `AGENTS.md`
(subsección **Code conventions → Git**) ya conoce la regla resumen. Si en algún
momento un agente propone un commit que no la respeta — por ejemplo agrupa
capas distintas, usa `style` para una reestructuración, escribe el mensaje en
español, o deja el build roto — basta con señalarle este documento, sin
reexplicar todo el criterio desde cero.

Si quieres forzar el chequeo al final de una sesión larga, un recordatorio corto
basta:

```
Antes de continuar, verifica que los commits pendientes cumplan GUIA_COMMITS.md:
idioma inglés, tipo/scope correctos, orden de dependencia, cada commit compila.
Muéstrame git status y git diff --stat antes de commitear.
```

---

## 7. Ejemplo de historial esperado

Historial ilustrativo del Sprint 1-A + 1-B de `PLAN.md`. El orden real depende
del grafo de imports, no de esta lista:

```
chore(config): add tsconfig, path aliases, oxlint and prettier configs
chore(deps): scaffold vite react-ts app with tailwind v3 and core dependencies
docs(design): add product brief and dark theme design tokens
feat(types): add shared simulation and auth domain interfaces
feat(ui): add base components Button, Badge, Card, Stat, Spinner, EmptyState
feat(ui): add ErrorBoundary with recovery action and Tooltip wrapper
feat(layout): add AppShell, Sidebar, TopBar and PageHeader
docs: add frontend setup instructions to README
```

Y para el motor de simulación (Sprint 1-E), que es donde el orden interno más se
aprieta:

```
feat(events): add typed SimulationEventBus between phaser and react
feat(simulation): add Lane geometry and queue logic
feat(simulation): add Vehicle entity with sedan, bus and ambulance variants
feat(simulation): add TrafficLight entity with priority pulse state
feat(simulation): add IntersectionScene rendering lanes, lights and vehicles
feat(simulation): add UIScene overlay with mode label and speed
feat(canvas): add PhaserGame react wrapper with mount and unmount lifecycle
feat(simulation): add mock ticker emitting plausible state every 150ms
```

> Estos dos ejemplos reflejan el criterio aplicado de "el grafo real gana":
> `mockTicker` va antes de `DashboardPage` porque la página lo importa, y
> `SimulationEventBus` va antes de `IntersectionScene` por la misma razón —
> al revés de como se escribiría leyendo el sprint de arriba abajo. Ese es el
> caso de ejemplo de por qué el grafo de imports siempre manda sobre cualquier
> lista ilustrativa.
