import { useState, useEffect } from "react";
import "./App.css";

// Where the backend lives. Later we can change this without touching the code.
const API = "/api";

const fmt = (d) => new Date(d).toLocaleDateString();

// ---------- Screen 1: New Reservation ----------
function NewReservation() {
  const [hotels, setHotels] = useState([]);
  const [form, setForm] = useState({ hotelId: "", fullName: "", email: "", checkIn: "", checkOut: "" });
  const [msg, setMsg] = useState(null); // { ok: true/false, text: "..." }

  useEffect(() => {
    fetch(`${API}/hotels`).then((r) => r.json()).then(setHotels);
  }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API}/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg({ ok: true, text: `${data.message}. Your reservation ID: ${data.reservation._id}` });
    } else {
      setMsg({ ok: false, text: data.error });
    }
  };

  return (
    <form onSubmit={submit}>
      <h2>New Reservation</h2>
      <select name="hotelId" value={form.hotelId} onChange={change} required>
        <option value="">Select a hotel...</option>
        {hotels.map((h) => (
          <option key={h._id} value={h._id}>
            {h.name} - {h.location} (${h.pricePerNight}/night)
          </option>
        ))}
      </select>
      <input name="fullName" placeholder="Full name" value={form.fullName} onChange={change} required />
      <input name="email" type="email" placeholder="Email" value={form.email} onChange={change} required />
      <label>Check-in</label>
      <input name="checkIn" type="date" value={form.checkIn} onChange={change} required />
      <label>Check-out</label>
      <input name="checkOut" type="date" value={form.checkOut} onChange={change} required />
      <button type="submit">Reserve</button>
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.text}</p>}
    </form>
  );
}

// ---------- Screen 2: Reservation Lookup ----------
function Lookup() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = haven't searched yet
  const [msg, setMsg] = useState(null);

  const search = async (e) => {
    e.preventDefault();
    setMsg(null);
    const res = await fetch(`${API}/reservations?q=${encodeURIComponent(query)}`);
    setResults(await res.json());
  };

  const cancel = async (id) => {
    if (!window.confirm("Cancel this reservation?")) return;
    const res = await fetch(`${API}/reservations/${id}`, { method: "DELETE" });
    const data = await res.json();
    setMsg({ ok: res.ok, text: data.message || data.error });
    setResults(results.filter((r) => r._id !== id)); // remove it from the screen
  };

  return (
    <div>
      <form onSubmit={search}>
        <h2>Find My Reservation</h2>
        <input placeholder="Full name or email" value={query} onChange={(e) => setQuery(e.target.value)} required />
        <button type="submit">Search</button>
      </form>
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.text}</p>}
      {results && results.length === 0 && <p>No reservations found.</p>}
      {results && results.map((r) => (
        <div className="card" key={r._id}>
          <b>{r.hotelId?.name}</b> ({r.hotelId?.location})<br />
          {r.fullName} - {r.email}<br />
          {fmt(r.checkIn)} to {fmt(r.checkOut)}<br />
          <small>ID: {r._id}</small><br />
          <button className="danger" onClick={() => cancel(r._id)}>Cancel reservation</button>
        </div>
      ))}
    </div>
  );
}

// ---------- The app: two tabs ----------
export default function App() {
  const [tab, setTab] = useState("new");
  return (
    <div className="container">
      <h1>Hotel Reservations</h1>
      <nav>
        <button className={tab === "new" ? "active" : ""} onClick={() => setTab("new")}>New Reservation</button>
        <button className={tab === "lookup" ? "active" : ""} onClick={() => setTab("lookup")}>Find Reservation</button>
      </nav>
      {tab === "new" ? <NewReservation /> : <Lookup />}
    </div>
  );
}