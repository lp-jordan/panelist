import { prisma } from "@/lib/prisma";

export default async function Home() {
  const scriptCount = await prisma.script.count();

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Panelist</h1>
      <p>Scaffold running. Scripts in database: {scriptCount}</p>
    </main>
  );
}
