# D3oiraM ✦

An original 3D platform adventure built with **Three.js**. Play as **Niu**, an original wind-and-leaf creature with leaf ears, a leafy tail and expressive eyes, and reconnect three floating worlds by recovering their crystals.

## Play

- **WASD / arrow keys:** camera-relative movement.
- **Space:** jump. Press again in the air for a double jump.
- **Q / E** or drag the background: orbit the camera.
- **Esc / P:** pause.
- **Mobile/tablet:** left analog stick, right jump button, camera rotation buttons. Two simultaneous touches are supported.

Collect the **3 crystals** in each world, then enter the portal on its last island. Coins are optional. Jump onto guardians from above to defeat them. Turquoise rings mark checkpoints; gold pads launch you higher. Falling or touching a guardian removes a heart. After losing all three hearts, resume from your checkpoint with your collected items intact.

### Worlds

1. **Wind gardens** — a gentle introduction to jumping and sky exploration.
2. **Tangerine ruins** — warm sandstone islands and moving platforms.
3. **Moonlit observatory** — a moonlit final climb above the clouds.

The interface supports **Catalan, Spanish and English**. Completed levels, best completion times, coin records, language and sound settings are saved in this browser. In-progress runs do not persist after reloading. Browser storage can be cleared or unavailable; the game still works without it. No account or backend is required.

## Develop

Requires Node.js 22+ and npm.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

The build uses relative asset URLs (`base: './'`), so it works on GitHub Pages project paths as well as other static hosts. Three.js is included in the bundle; there is no runtime JavaScript CDN dependency. Optional Google Fonts have local system fallbacks. WebGL 2 and a modern browser are required. Audio starts after a user interaction.

## Publish to GitHub Pages

The repository is intended to be named **D3oiraM** and use **main**.

1. Create a public GitHub repository named `D3oiraM` and push this project to `main`.
2. Open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. The included `Test, build and deploy D3oiraM` workflow tests, builds and publishes automatically on pushes to `main`. If the first run happened before enabling Pages, re-run the workflow from **Actions**.
4. Open the URL shown by the successful workflow deployment.

If you have the official GitHub CLI installed and authenticated, `bash scripts/publish-github.sh` performs the repository setup, Pages configuration and initial push. It stops if a repository of the same name already exists; it never overwrites one.

## Architecture

- `src/main.js`: rendering, UI, inputs, audio, game loop and progression.
- `src/physics.js`: renderer-independent fixed-step physics and moving platforms.
- `src/levels.js`: deterministic hand-authored worlds and collectibles.
- `src/i18n.js`: Catalan, Spanish and English text.
- `tests/physics.test.js`: movement, double jump, collision, moving-platform carry and route reachability tests.

Simulation runs at 120 Hz with capped catch-up; rendering follows the display. Static island meshes are batched by material, resource cleanup runs between levels, and mobile pixel ratio is capped at 1.5. Switching tabs pauses the game. Resizing the viewport preserves the running game.

## Scope and verification

This is a compact, complete **three-level indie game**, inspired by the exploration and jumping of classic 3D platformers. Characters, world geometry and sounds are procedural and original; terrain also uses an original AI-generated natural rock texture. It does not contain Nintendo characters, names, assets or music.

Automated physics and build checks pass. Visual/browser gameplay QA remains pending because the development environment blocked its local browser preview. Real-device performance, touch handling and WebGL appearance should be checked after deployment.

## License

Original source and procedural artwork: MIT. Three.js and Vite retain their respective MIT licenses. Optional fonts: DM Sans and Outfit, distributed by Google Fonts under the SIL Open Font License.

## Creature designs

The character art uses original pocket-monster-inspired silhouettes with physically based skin, leaf and mineral materials:

- **Niu:** mint wind-and-leaf explorer, cream muzzle, leaf ears and animated leaf-fan tail.
- **Brotort:** green seed-shell garden guardian with a sprouting flower.
- **Brasec:** orange sunstone guardian with a mineral back and crystal tail.
- **Llunalat:** lavender moonwing guardian with animated wings and a golden forehead gem.

All have eye highlights, blinking and secondary animation. The three guardian species retain the same stomp/contact rules and collision bounds.

## Naturalistic rendering update

The renderer now uses environment reflections, physically based skin/leaf/stone materials, a natural rock-and-moss albedo with matching derived normal and roughness maps, and procedural micro-scale skin and leaf veins. Rounded organic volumes replace coarse creature facets; smaller glossy eyes, dark sockets and fine whiskers replace painted eye highlights. Islands have eroded rock undersides, rock fragments, instanced edge grass, branched trees and transparent drifting mist. Desktop shadows use a 2048 map; mobile keeps 1024.

This moves the live game toward a naturalistic, realistic look. These remain procedural creature models, not scanned animals or film-quality sculpted assets; full photorealism is not established by the build checks. Browser visual validation is still blocked by the test browser's missing WebGL 2 support.

The generated material is stored at `public/textures/moss-limestone.webp` with its derived normal and roughness maps. It was created with the built-in image generator using this prompt:

> A tileable, flat orthographic macro photograph of weathered pale grey limestone with irregular dark forest-green moss, fine cracks, mineral grains, pores and dry lichen; neutral diffuse illumination, no perspective, cast shadows, text or objects. Dense natural material detail, seamless edges for repeating over 3D rock surfaces.
