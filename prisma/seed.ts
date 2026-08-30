import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const name = process.env.OWNER_NAME;
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;

  if (!name || !email || !password) {
    throw new Error("OWNER_NAME, OWNER_EMAIL, and OWNER_PASSWORD must be set in .env before seeding.");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Keyed on role, not email: MVP has exactly one OWNER, and OWNER_EMAIL may
  // change between seed runs. Matching on email would create a second owner
  // instead of updating the existing one.
  const existing = await prisma.user.findFirst({ where: { role: "OWNER" } });

  const owner = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name, email, passwordHash },
      })
    : await prisma.user.create({
        data: { name, email, passwordHash, role: "OWNER" },
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
