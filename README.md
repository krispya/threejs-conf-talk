# threejs-conf-talk

A Three.js conference talk built with React, React Three Fiber, and Vite.

Use Node.js 26 and the pnpm version declared in `package.json`.

```sh
pnpm install
pnpm dev
```

## GitHub Pages

The [deployment workflow](.github/workflows/deploy.yml) checks types, runs tests, and
publishes the production build on every push to `main`. It can also be run manually
from the repository's Actions tab.

In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
Once enabled, the site will be available at <https://krispya.github.io/threejs-conf-talk/>.
Private repositories require a GitHub plan that supports Pages.

To preview the same build locally:

```sh
pnpm build --base=/threejs-conf-talk/
pnpm exec vite preview --base=/threejs-conf-talk/
```
