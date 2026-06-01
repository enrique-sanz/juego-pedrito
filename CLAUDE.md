# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`juego-pedrito` es un juego web de regalo con temática Star Wars. El protagonista es **Pedrito**; su mujer es **Marian**; el villano final es **Kike Vader**. La aventura encadena cuatro minijuegos retro con interludios narrativos:

1. Space Invaders (oleadas de cazas TIE).
2. Carrera de naves estilo trinchera de la Estrella de la Muerte.
3. Huida del compactador de basura.
4. Duelo final con sables láser contra Kike Vader.

Si Pedrito gana el duelo, una secuencia final lo muestra cavando con una **Manitou** (mini-excavadora) y enterrando a Kike Vader antes de reunirse con Marian. Si pierde, Kike Vader besa a Marian → game over.

## Stack y restricciones

- HTML5 + Canvas 2D + JavaScript **vanilla**. Nada de frameworks, TypeScript ni bundlers.
- Cero dependencias en `node_modules`. Si un día hace falta una librería, se incluye por `<script>` desde CDN y se justifica.
- Despliegue como sitio estático en GitHub Pages sobre la rama `main`.
- Mobile-first vertical (portrait). El juego está pensado para smartphone; cualquier cambio debe seguir funcionando con input táctil.

## Cómo correr en local

Sirve la carpeta raíz con cualquier servidor estático:

```bash
python3 -m http.server 8000
# luego abrir http://localhost:8000
```

Alternativas equivalentes: `npx serve`, extensión Live Server de VS Code. No hay scripts npm porque no existe `package.json` — no añadir uno sin pedirlo.

## Despliegue

GitHub Pages, rama `main`, carpeta raíz. Tras hacer push, la página queda publicada en `https://<usuario>.github.io/juego-pedrito/` en pocos minutos.

## Arquitectura

Un único `<canvas>` con resolución interna fija (360×640) escalada por CSS para ocupar el viewport. Bucle principal con `requestAnimationFrame` y timestep fijo a 60 fps en `js/engine/loop.js`.

Máquina de estados de escenas (en `js/engine/state.js`):

```
INTRO_CRAWL → NARRATIVE_1 → INVADERS
            → NARRATIVE_2 → RACING
            → NARRATIVE_3 → COMPACTOR
            → NARRATIVE_4 → LIGHTSABER
            → VICTORY ó DEFEAT
```

Cada escena vive en `js/scenes/<nombre>.js` y expone `{ enter(), update(dt), render(ctx), exit() }`. El bootstrap (`js/main.js`) registra las escenas y orquesta las transiciones.

Módulos compartidos en `js/engine/`:

- `loop.js`: bucle fijo de simulación + render.
- `input.js`: abstracción de touch + teclado; expone un `pointer` con `x`, `y`, `isDown`, `justPressed`.
- `state.js`: vidas, escena actual, flags (mute, vidas infinitas).
- `audio.js`: WebAudio. Sintetiza la cabecera 8-bit de Star Wars con osciladores cuadrados y produce SFX. Se inicializa tras la primera interacción del usuario (requisito iOS).
- `debug.js`: triple-tap en la esquina superior derecha → dropdown autoescondible con salto de escena y checkbox de vidas infinitas.
- `stars.js`: campo de estrellas reutilizable (intro, racing, lightsaber).
- `characters.js`: dibujo por código de Pedrito, Marian y Kike Vader. **Cuando lleguen imágenes reales se sustituyen aquí**, sin tocar escenas.

Carga de scripts en `index.html`: utilidades primero, escenas después, `main.js` al final.

## Convenciones

- Toda la comunicación con el usuario y los textos de pantalla, en **español** con acentos correctos.
- Nombres canónicos: **Pedrito**, **Marian**, **Kike Vader**. No usar otros.
- El texto de la intro (crawl) vive en `story/intro.txt`. **Solo el subagente `story-keeper` lo modifica.** Si vas a cambiar mecánicas o añadir contenido narrativo, invoca a `story-keeper` para que actualice la intro coherentemente.
- Los dibujos de personajes están centralizados en `js/engine/characters.js`. No reimplementar siluetas en cada escena.

## Controles

- **Móvil (touch):** todos los minijuegos se controlan con el dedo. El duelo final tiene cuatro botones grandes (izquierda: retroceder / avanzar; derecha: BLOQ / ATAC) y soporta multi-touch (moverse y atacar a la vez).
- **Desktop (teclado):**
  - `←` / `→`: mover horizontalmente (invaders, racing, duelo).
  - `Espacio`: disparar (invaders), golpear punto débil (compactor), avanzar texto / atacar (duelo).
  - `Z`: ataque alternativo en el duelo. `X`: defender en el duelo.
  - `Enter` / `Espacio`: desbloquear overlay inicial, saltar intro, avanzar pantallas narrativas, reiniciar tras victoria/derrota.

## Modo debug (huevo de pascua)

Tres taps consecutivos en la esquina superior derecha (~10% del ancho × 10% del alto) abren un panel:

- Selector de pantalla → ir.
- Checkbox de vidas infinitas.
- Checkbox de mute.

Se autoesconde tras unos segundos sin uso. Está siempre disponible (también en producción) — es parte intencional del regalo.

## Performance budget

- 60 fps objetivo en gama media Android.
- Cero allocations dentro del bucle principal (reutilizar vectores, pools para balas y obstáculos).
- `image-rendering: pixelated` en el canvas para conservar el look retro al escalar.
- Assets: en la v1 todo se dibuja con primitivas Canvas para evitar descargas.

## Status

Primera versión funcional con las cuatro escenas, intro con música 8-bit, finales animados, modo debug y agente `story-keeper`. Personajes dibujados por código a la espera de imágenes reales del usuario.
