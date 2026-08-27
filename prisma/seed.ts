import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
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

  const owner = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "OWNER" },
    create: { name, email, passwordHash, role: "OWNER" },
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
