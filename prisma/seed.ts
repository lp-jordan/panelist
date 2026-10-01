import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const name = process.env.OWNER_NAME;
  const email = process.env.OWNER_EMAIL;

  // Sign-in is passwordless (emailed code / link), so the owner is just a name
  // and an email — they sign in with a code sent to OWNER_EMAIL.
  if (!name || !email) {
    throw new Error("OWNER_NAME and OWNER_EMAIL must be set in .env before seeding.");
  }

  // Keyed on role, not email: MVP has exactly one OWNER, and OWNER_EMAIL may
  // change between seed runs. Matching on email would create a second owner
  // instead of updating the existing one.
  const existing = await prisma.user.findFirst({ where: { role: "OWNER" } });

  const owner = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name, email: email.trim().toLowerCase() },
      })
    : await prisma.user.create({
        data: { name, email: email.trim().toLowerCase(), role: "OWNER" },
      });

  console.log(`Owner user ready: ${owner.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
