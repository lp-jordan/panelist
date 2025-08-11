# Panelist

Panelist is a web-based editor for writing comic or storyboard scripts one panel at a time.  It provides a page-sized canvas, keyboard-driven navigation, and persistence through Supabase so projects can be saved and retrieved anywhere.

## Key features

- Panel‑ and page‑oriented script editor built with React and TipTap
- SmartFlow keyboard shortcuts for moving between nodes and panels quickly
- Project and multi-page management with live word counts
- Light/dark themes, zoom controls, and sidebar settings
- Supabase-backed storage of scripts in a `pages` table

## Supabase requirements

The application expects a Supabase project with a table named `pages`.  Configure the connection by setting the following environment variables before running or building the app:

```
VITE_SUPABASE_URL=<your Supabase project URL>
VITE_SUPABASE_ANON_KEY=<your Supabase anon key>
```

Create the table in the Supabase SQL editor:

```sql
create table if not exists pages (
  id uuid primary key default gen_random_uuid(),
  title text,
  page_content jsonb,
  version integer default 1,
  project_id uuid,
  created_at timestamptz,
  updated_at timestamptz
);
```

Optional sample row:

```sql
insert into pages (
  title,
  page_content,
  version,
  project_id,
  created_at,
  updated_at
) values ('Example', '{}'::jsonb, 1, null, now(), now());
```

Test connectivity with:

```
npm run test:supabase
```

## Development

1. Install dependencies

   ```
   npm install
   ```

2. Start the dev server

   ```
   npm run dev
   ```

   The app will be available at http://localhost:5173.

## Build

Create an optimized production build:

```
npm run build
```

Preview the build locally:

```
npm run preview
```

## Deployment

Deploy the contents of the `dist/` folder to any static hosting provider (Netlify, Vercel, Supabase Storage, etc.).  Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in the build environment so the generated files include the correct Supabase credentials.

