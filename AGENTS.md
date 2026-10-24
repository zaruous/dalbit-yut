# Codex repository guide — 달빛 윷마당

## Project goals
- Korean Yutnori game, Vercel static hosting, 1 human vs AI (1–3 opponents) or 2–4 local humans.
- Keep the user's chosen **A 팔각 순환형** and **B 이중 링형** boards. **Do not reintroduce C 확장 교차형**.
- The game board is directly above the throwing-mat animation in one screen. Maintain the moonlit hanok background.
- **Humans select their own piece and destination** after rolling. On forks, they choose the outer/shortcut route before confirming. Do not auto-move human pieces.
- AI players can auto-roll and auto-move only on their own turn.

## Core gameplay
- Each player has four pieces. Implement do(1)/gae(2)/geol(3)/yut(4)/mo(5)/backdo(-1).
- Keep stacking, capture, bonus turns after capture/yut/mo, finish and actual movement-history backdo.
- Shortcut entry is allowed only when the piece is **exactly stopped on the fork**.
- Nak (낙) occurs if one or more Yut sticks are **fully outside** the throw mat. A stick partly overlapping the boundary is valid. A nak loses the throw and passes the turn.
- Current falling Yut effect is an animated 2D simulation, not a physically accurate rigid-body simulator.

## Files
- `src-ts/mapEngine.ts`: board graph, lanes, route generation and fork behavior.
- `src-ts/gameEngine.ts`: turns, pieces, captures, stacks, roll results, AI candidate scoring.
- `src-ts/App.tsx`: React UI, manual piece/destination interactions, animation.
- `src/styles.css`: moonlit hanok UI and effects.
- `public/hanok-night.svg`: background asset.
- `vendor/`: locally bundled React/ReactDOM UMD scripts (React 16); read THIRD_PARTY_NOTICES.md.
- `test-engine.cjs`: Node.js engine test/simulation.

## Development workflow
1. Inspect the current code and README before modifying behavior; preserve user-selected UX.
2. Run `npm test` (Node.js, no install required) and confirm both maps.
3. Serve the repository root as static files, e.g. `python -m http.server 8000`, then test browser interactions.
4. Verify human piece click → selectable routes → highlighted destination click, nak/end turn, bonus throw, stacking/capture, AI and responsive mobile.
5. Vercel: framework Other, no build command, repository root output.

## Notes
This is a static, no-server UMD React implementation. It is not a Vite-based project; do not silently change build assumptions. If modernizing React, migrate and test as a separate scoped change. Custom board paths and nak handling are explicitly house rules.

## Cinematic UI redesign (2026-10-24)

- Keep the React 16 UMD project and both existing board engines. Do not rewrite user-manual movement as automation.
- `src-ts/theme-cinematic.css` overlays `src/styles.css` and controls the warm sunset/hanok theme. If changing colors/layout, edit the theme first.
- `public/hanok-sunset-atmosphere.webp` is a softened scene reference: it sits behind truly interactive elements. Never bake buttons/board controls into a static screenshot.
- `src-ts/App.tsx` contains SVG ThrowMat with 4 independent sticks, actual `낙` result and `Board` target rings; preserve keyboard/click handlers and destination confirmation.
- PC layout: left player portraits / center board + directly-below throw / right manual controls & game history. Mobile: board + throw first, player info second, actions third.
- Run `npm test` (150 complete randomized games) and browser-check the manual piece click, gold target click, map switches, forced nak and small screen width.

## React + TypeScript migration

`src-ts/*.ts` and `src-ts/App.tsx` are canonical. `index.html` loads the TSX entry with Vite, Vercel builds `dist/`. Use `npm run typecheck && npm test && npm run build` after changes; 150 gameplay simulations test A/B graphs. Keep manual piece/destination confirmation, local/AI modes, cinematic CSS and nak animation. `preview.html` is generated from the TypeScript code for standalone local preview.
