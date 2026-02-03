# Arcadia Atelier — Premium E‑Commerce Experience

A cinematic, world‑class ecommerce storefront built with React + Vite and powered by the DummyJSON API.  
Includes a live market, product detail pages, wishlist, and a multi‑step checkout flow.

## Highlights
1. Curated home + market experiences
2. Product detail route with gallery and CTAs
3. Wishlist with persistence
4. Multi‑step checkout (Client → Shipping → Payment → Review)
5. Responsive, premium visual system

## Tech Stack
1. React
2. Vite
3. TypeScript
4. DummyJSON API
5. React Router

## Getting Started
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Deploy (Vercel)
1. Import the GitHub repo into Vercel
2. Framework preset: Vite
3. Build command: `npm run build`
4. Output directory: `dist`

## Notes
- Client-side routing is enabled via `vercel.json` rewrite.
- Cart, wishlist, and checkout draft state persist in localStorage.
