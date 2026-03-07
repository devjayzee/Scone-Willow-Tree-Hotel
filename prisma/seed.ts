import "dotenv/config";
import { PrismaClient, Role, BookingStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { addDays, format } from "date-fns";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Delete existing bookings first (due to foreign key constraint)
  await prisma.booking.deleteMany({});
  console.log("Cleared existing bookings");

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

  const createdRooms = [];
  for (const room of rooms) {
    const created = await prisma.room.create({
      data: room,
    });
    createdRooms.push(created);
  }
  console.log("Created", rooms.length, "rooms");

  // Helper to generate booking reference
  const generateBookingRef = (index: number) => {
    const date = format(new Date(), "yyyyMMdd");
    return `BK${date}${String(index).padStart(4, "0")}`;
  };

  // Get today's date at midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Sample guest data
  const guests = [
    { name: "John Smith", phone: "0412345678", email: "john.smith@email.com" },
    { name: "Sarah Johnson", phone: "0423456789", email: "sarah.j@email.com" },
    { name: "Michael Brown", phone: "0434567890", email: "m.brown@email.com" },
    { name: "Emily Davis", phone: "0445678901", email: "emily.d@email.com" },
    { name: "David Wilson", phone: "0456789012", email: "d.wilson@email.com" },
    { name: "Jessica Taylor", phone: "0467890123", email: "jess.t@email.com" },
    { name: "Chris Anderson", phone: "0478901234", email: "chris.a@email.com" },
    { name: "Amanda White", phone: "0489012345", email: "amanda.w@email.com" },
    { name: "Robert Martin", phone: "0490123456", email: "rob.m@email.com" },
    { name: "Lisa Thompson", phone: "0401234567", email: "lisa.t@email.com" },
    { name: "James Garcia", phone: "0412345679", email: "james.g@email.com" },
    { name: "Michelle Lee", phone: "0423456780", email: "michelle.l@email.com" },
  ];

  const bookings = [];
  let bookingIndex = 1;

  // Scenario 1: All 8 rooms fully booked for a 3-day period (starting in 5 days)
  // This ensures no overlap with current bookings
  const fullBookingStart = addDays(today, 5);
  const fullBookingEnd = addDays(fullBookingStart, 3);

  for (let i = 0; i < 8; i++) {
    bookings.push({
      bookingRef: generateBookingRef(bookingIndex++),
      roomId: createdRooms[i].id,
      guestName: guests[i].name,
      guestPhone: guests[i].phone,
      guestEmail: guests[i].email,
      checkIn: fullBookingStart,
      checkOut: fullBookingEnd,
      status: BookingStatus.CONFIRMED,
      createdById: manager.id,
    });
  }

  // Scenario 2: Current bookings (rooms 1 & 2 - no overlap with full booking period)
  bookings.push({
    bookingRef: generateBookingRef(bookingIndex++),
    roomId: createdRooms[0].id,
    guestName: guests[8].name,
    guestPhone: guests[8].phone,
    guestEmail: guests[8].email,
    checkIn: addDays(today, -1),
    checkOut: addDays(today, 2),
    status: BookingStatus.CHECKED_IN,
    createdById: manager.id,
  });

  bookings.push({
    bookingRef: generateBookingRef(bookingIndex++),
    roomId: createdRooms[1].id,
    guestName: guests[9].name,
    guestPhone: guests[9].phone,
    guestEmail: guests[9].email,
    checkIn: today,
    checkOut: addDays(today, 2),
    status: BookingStatus.CHECKED_IN,
    createdById: manager.id,
  });

  // Scenario 3: Future bookings (after full booking period - no overlap)
  bookings.push({
    bookingRef: generateBookingRef(bookingIndex++),
    roomId: createdRooms[2].id,
    guestName: guests[10].name,
    guestPhone: guests[10].phone,
    guestEmail: guests[10].email,
    checkIn: addDays(today, 10),
    checkOut: addDays(today, 13),
    status: BookingStatus.CONFIRMED,
    createdById: staff.id,
  });

  bookings.push({
    bookingRef: generateBookingRef(bookingIndex++),
    roomId: createdRooms[5].id,
    guestName: guests[11].name,
    guestPhone: guests[11].phone,
    guestEmail: guests[11].email,
    checkIn: addDays(today, 10),
    checkOut: addDays(today, 12),
    status: BookingStatus.CONFIRMED,
    createdById: staff.id,
  });

  // Scenario 4: Past completed bookings
  bookings.push({
    bookingRef: generateBookingRef(bookingIndex++),
    roomId: createdRooms[3].id,
    guestName: "Past Guest One",
    guestPhone: "0411111111",
    guestEmail: "past1@email.com",
    checkIn: addDays(today, -7),
    checkOut: addDays(today, -4),
    status: BookingStatus.CHECKED_OUT,
    createdById: manager.id,
  });

  bookings.push({
    bookingRef: generateBookingRef(bookingIndex++),
    roomId: createdRooms[4].id,
    guestName: "Past Guest Two",
    guestPhone: "0422222222",
    guestEmail: "past2@email.com",
    checkIn: addDays(today, -5),
    checkOut: addDays(today, -2),
    status: BookingStatus.CHECKED_OUT,
    createdById: manager.id,
  });

  // Create all bookings
  for (const booking of bookings) {
    await prisma.booking.create({
      data: booking,
    });
  }
  console.log("Created", bookings.length, "bookings");
  console.log("Full occupancy period:", format(fullBookingStart, "yyyy-MM-dd"), "to", format(fullBookingEnd, "yyyy-MM-dd"));

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
