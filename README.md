# Senkuro Profile Cosmetics Preview

Static preview site for testing Senkuro profile cosmetics without calling Senkuro APIs at runtime.

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

## Deployment

The repository includes `.github/workflows/pages.yml`. After pushing to `main` or `master`, GitHub Pages publishes the static files from the repository root.
