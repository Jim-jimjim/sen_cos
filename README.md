# Senkuro Profile Cosmetics Preview

Static preview site for testing Senkuro profile cosmetics without calling Senkuro APIs at runtime.

The profile area is rendered from saved public Senkuro `.com` profile snapshots plus vendored Senkuro CSS chunks. The preview drawer is separate UI; it swaps wallpaper, banner, avatar, and frame media over the captured profile DOM.

## Local Use

```bash
npm run start
```

Open `http://localhost:4173`.

## Refresh Collectibles

```bash
npm run fetch:collectibles
```

The script calls the public Senkuro GraphQL persisted query and writes `assets/data/collectibles.generated.json`. GitHub Pages reads this JSON directly because browser CORS blocks live GraphQL calls from `*.github.io`.

## Refresh Profile Snapshots

```bash
npm run fetch:profiles
```

The script fetches the public `.com` profiles and stores the extracted profile/header/mobile-nav HTML in `assets/data/profile-snippets/`. Refresh this when Senkuro changes its profile markup or CSS bundle names.

## Deployment

The repository includes `.github/workflows/pages.yml`. After pushing to `main` or `master`, GitHub Pages publishes the static files from the repository root.
