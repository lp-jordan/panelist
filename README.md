# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Manual Testing

The `SmartFlow` extension adds keyboard shortcuts for navigating script panels.

1. Run `npm run dev` and open the editor.
2. Create a `PageHeader` node. Press **Enter** to insert the next node (`PanelHeader`), then **Enter** again to continue through the flow (`Description` → `Dialogue`).
3. Use **Tab** to move the cursor forward through nodes in the current panel.
4. Use **Shift+Tab** to move the cursor backward within the panel.

Verify that the cursor stops when reaching the start or end of a panel.

## Supabase connectivity

Set the `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables and run:

```
npm run test:supabase
```

The script will report whether the project can reach the configured Supabase instance.
Scripts are persisted in a Supabase table called `pages`.

To create the table, run the following SQL in the Supabase SQL editor:

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

Seed it with a sample row if desired:

```sql
insert into pages (
  title,
  page_content,
  version,
  project_id,
  created_at,
  updated_at
)
values ('Example', '{}'::jsonb, 1, null, now(), now());
```
