# The Skin Tree — React Client

This is a Vite + React scaffold that mirrors the existing static site.

Quick start:

1. From `client/` install dependencies:

```bash
npm install
```

2. (Optional) Copy the `assets/images` folder into `client/public/assets/images` so images load:

```bash
mkdir -p client/public/assets/images
cp -r "../assets/images/" client/public/assets/
```

3. Run dev server:

```bash
npm run dev
```

Notes:
- CSS from the original site was copied into `src/styles/` and is imported in `src/main.jsx`.
- Components are basic React versions of the original sections (Header, Home, Footer).
- Next steps: port the remaining JS behaviors (gallery, booking flow) into components and copy any remaining assets.
