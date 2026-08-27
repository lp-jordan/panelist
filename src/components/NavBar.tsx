import Link from "next/link";
import { getSession } from "@/lib/session";
import { logout } from "@/app/actions/auth";

export async function NavBar() {
  const session = await getSession();
  if (!session?.userId) return null;

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        padding: "0.75rem 2rem",
        borderBottom: "1px solid #ddd",
      }}
    >
      <Link href="/" style={{ fontWeight: "bold" }}>
        Panelist
      </Link>
      <Link href="/trash">Trash</Link>
      <form action={logout} style={{ marginLeft: "auto" }}>
        <button type="submit">Log out</button>
      </form>
    </nav>
  );
}
