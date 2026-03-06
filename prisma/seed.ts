import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create General Manager
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const manager = await prisma.user.upsert({
    where: { email: "manager@hotel.com" },
    update: {},
    create: {
      email: "manager@hotel.com",
      password: hashedPassword,
      firstName: "General",
      lastName: "Manager",
      role: Role.GENERAL_MANAGER,
    },
  });
  console.log("Created manager:", manager.email);

  // Create Staff
  const staffPassword = await bcrypt.hash("staff123", 10);
  const staff = await prisma.user.upsert({
    where: { email: "staff@hotel.com" },
    update: {},
    create: {
      email: "staff@hotel.com",
      password: staffPassword,
      firstName: "Front Desk",
      lastName: "Staff",
      role: Role.STAFF,
    },
  });
  console.log("Created staff:", staff.email);

  // Delete existing rooms to replace with new ones
  await prisma.room.deleteMany({});

  // Create Rooms based on Scone Willow Tree Hotel room plan
  const rooms = [
    {
      roomNumber: "1",
      capacity: 1,
      pricePerNight: 90.0,
      description: "Standard Single Room (1 Single Bed)",
    },
    {
      roomNumber: "2",
      capacity: 2,
      pricePerNight: 105.0,
      description: "Standard Double Room (1 Double Bed)",
    },
    {
      roomNumber: "3",
      capacity: 2,
      pricePerNight: 115.0,
      description: "Large Double Room (1 Double Bed)",
    },
    {
      roomNumber: "4",
      capacity: 2,
      pricePerNight: 125.0,
      description: "Extra Large Double Room (1 Double Bed)",
    },
    {
      roomNumber: "5",
      capacity: 1,
      pricePerNight: 100.0,
      description: "Standard Single Plus Room (1 King Single)",
    },
    {
      roomNumber: "6",
      capacity: 2,
      pricePerNight: 120.0,
      description: "Large Double Plus Room (1 Double Bed)",
    },
    {
      roomNumber: "7",
      capacity: 2,
      pricePerNight: 110.0,
      description: "Standard Double Room (1 Double Bed)",
    },
    {
      roomNumber: "8",
      capacity: 2,
      pricePerNight: 115.0,
      description: "Large Double Room (1 Double Bed)",
    },
  ];

  for (const room of rooms) {
    await prisma.room.create({
      data: room,
    });
  }
  console.log("Created", rooms.length, "rooms");

  console.log("Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
