import { hashPassword } from "better-auth/crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Creating admin user...");

  const password = await hashPassword("admin12345");

  // Check if user already exists
  let user = await prisma.users.findUnique({
    where: { email: "admin@example.com" },
  });

  if (!user) {
    // Create admin user
    user = await prisma.users.create({
      data: {
        name: "Admin User",
        email: "admin@example.com",
        emailVerified: true,
      },
    });
  }

  console.log("Linking user with account...");

  // Check if account already exists
  const existingAccount = await prisma.accounts.findFirst({
    where: {
      userId: user.id,
      providerId: "credential",
    },
  });

  if (!existingAccount) {
    // Create account for admin user
    await prisma.accounts.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } else {
    // Update password if account exists
    await prisma.accounts.update({
      where: { id: existingAccount.id },
      data: {
        password,
        updatedAt: new Date(),
      },
    });
  }

  console.log("\n✅ Admin user created successfully!");
  console.log("Email: admin@example.com");
  console.log("Password: admin12345");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
