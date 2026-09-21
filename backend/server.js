const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Database ----------
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/hotelDB";

const Hotel = mongoose.model("Hotel", new mongoose.Schema({
  name: String,
  description: String,
  location: String,
  pricePerNight: Number,
}));

const Reservation = mongoose.model("Reservation", new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, lowercase: true },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
}));

// Add sample hotels the first time the app starts
async function seedHotels() {
  if ((await Hotel.countDocuments()) > 0) return;
  await Hotel.insertMany([
    { name: "Sea View Resort", description: "Beachfront rooms with a pool", location: "Tel Aviv", pricePerNight: 220 },
    { name: "City Center Inn", description: "Budget stay near downtown", location: "Jerusalem", pricePerNight: 110 },
    { name: "Desert Oasis Lodge", description: "Quiet lodge with spa", location: "Eilat", pricePerNight: 180 },
  ]);
  console.log("Hotels seeded");
}

// ---------- Endpoints ----------

// List hotels (for the dropdown on Screen 1)
app.get("/hotels", async (req, res) => {
  res.json(await Hotel.find());
});

// Function 1: Create reservation
app.post("/reservations", async (req, res) => {
  const { fullName, email, checkIn, checkOut, hotelId } = req.body;

  // Validate
  if (!fullName || !email || !checkIn || !checkOut || !hotelId) {
    return res.status(400).json({ error: "All fields are required" });
  }
  if (!mongoose.isValidObjectId(hotelId) || !(await Hotel.findById(hotelId))) {
    return res.status(400).json({ error: "Hotel not found" });
  }
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (isNaN(start) || isNaN(end)) {
    return res.status(400).json({ error: "Invalid dates" });
  }

  // Business rules
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (start < today) return res.status(400).json({ error: "Check-in cannot be in the past" });
  if (end <= start) return res.status(400).json({ error: "Check-out must be after check-in" });

  // Are the dates free? Two stays overlap if one starts before the other ends
  const conflict = await Reservation.findOne({
    hotelId,
    checkIn: { $lt: end },
    checkOut: { $gt: start },
  });
  if (conflict) return res.status(409).json({ error: "Those dates are not available" });

  // Store
  const reservation = await Reservation.create({ fullName, email, checkIn: start, checkOut: end, hotelId });
  res.status(201).json({ message: "Reservation completed successfully", reservation });
});

// Search by name or email (Screen 2 uses this)
app.get("/reservations", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Provide ?q=name or email" });
  const results = await Reservation.find({ $or: [{ email: q.toLowerCase() }, { fullName: q }] })
    .collation({ locale: "en", strength: 2 }) // ignore upper/lower case
    .populate("hotelId", "name location pricePerNight");
  res.json(results);
});

// Function 2: Lookup by Reservation ID
app.get("/reservations/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid ID" });
  const reservation = await Reservation.findById(req.params.id).populate("hotelId", "name location pricePerNight");
  if (!reservation) return res.status(404).json({ error: "Reservation not found" });
  res.json(reservation);
});

// Function 3: Cancel reservation
app.delete("/reservations/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid ID" });
  const reservation = await Reservation.findByIdAndDelete(req.params.id);
  if (!reservation) return res.status(404).json({ error: "Reservation not found" });
  res.json({ message: "Reservation cancelled" });
});

// Health check (Kubernetes will use this later)
app.get("/health", (req, res) => res.send("ok"));

// ---------- Start ----------
mongoose.connect(MONGO_URL).then(async () => {
  await seedHotels();
  app.listen(3000, () => console.log("Backend running on port 3000"));
}).catch((err) => {
  console.error("DB connection failed:", err.message);
  process.exit(1);
});