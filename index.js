import express from "express";
import { engine } from "express-handlebars";
import path from "path";
import { fileURLToPath } from "url";
import pool from "./src/config/db.js";

/**
 * 1. INITIALIZATION
 */
const app = express();
const port = 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 2. BUSINESS LOGIC HELPERS
 */
const calculateDuration = (start, end) => {
  const diff = Math.ceil(Math.abs(new Date(end) - new Date(start)) / 86400000);
  return diff >= 30 ? `${Math.floor(diff / 30)} months` : `${diff} days`;
};

const parseTechnologies = (body) => {
  const techMap = {
    node: "Node Js",
    next: "Next Js",
    react: "React Js",
    ts: "TypeScript",
  };
  return Object.keys(techMap)
    .filter((key) => body[key])
    .map((key) => techMap[key]);
};

// Mempersiapkan data form agar siap masuk ke Query SQL
const formatProjectPayload = (body) => ({
  title: body.title,
  content: body.content,
  startDate: body.startDate,
  endDate: body.endDate,
  image: body.image || "pizza.png", // Default image jika input kosong
  duration: calculateDuration(body.startDate, body.endDate),
  technologies: parseTechnologies(body), // Menghasilkan array
});

/**
 * 3. CONFIGURATION & MIDDLEWARE
 */
app.engine(
  "hbs",
  engine({
    extname: "hbs",
    defaultLayout: "main",
    layoutsDir: path.join(__dirname, "src/views/layouts"),
    partialsDir: path.join(__dirname, "src/views/partials"),
    helpers: {
      isChecked: (list, val) => (list?.includes(val) ? "checked" : ""),
      formatInputDate: (date) =>
        date ? new Date(date).toISOString().split("T")[0] : "",
    },
  }),
);

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "src/views"));

app.use(express.urlencoded({ extended: false }));
app.use("/assets", express.static(path.join(__dirname, "src/assets")));

/**
 * 4. NAVIGATION ROUTES (READ)
 */
app.get("/", (req, res) => res.render("home", { title: "Home | ManadoCode" }));

app.get("/project", async (req, res) => {
  try {
    const query = `
      SELECT projects.*, users.name AS author_name 
      FROM projects 
      LEFT JOIN users ON projects.author_id = users.id 
      ORDER BY projects.id DESC`;
    const result = await pool.query(query);
    res.render("project", { title: "My Projects", projects: result.rows });
  } catch (err) {
    console.error("❌ DB Read Error:", err.message);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/add-project", (req, res) =>
  res.render("add-project", { title: "Add Project" }),
);

app.get("/project-detail/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM projects WHERE id = $1", [
      id,
    ]);
    const project = result.rows[0];
    project
      ? res.render("project-detail", { title: "Detail", project })
      : res.redirect("/project");
  } catch (err) {
    res.redirect("/project");
  }
});

app.get("/edit-project/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM projects WHERE id = $1", [
      id,
    ]);
    const project = result.rows[0];
    if (!project) return res.redirect("/project");
    res.render("edit-project", { title: "Edit Project", project });
  } catch (err) {
    res.redirect("/project");
  }
});

/**
 * 5. ACTION ROUTES (CREATE, UPDATE, DELETE)
 */

// Simpan Project Baru
app.post("/project", async (req, res) => {
  try {
    const data = formatProjectPayload(req.body);

    // Sesuaikan urutan kolom dengan ERD kamu:
    // title, content, start_date, end_date, duration, image, author_id, technologies
    const query = `
      INSERT INTO projects (title, content, start_date, end_date, duration, image, author_id, technologies)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;

    const values = [
      data.title,
      data.content,
      data.startDate,
      data.endDate,
      data.duration,
      data.image || "pizza.png",
      1, // author_id
      data.technologies, // Ini harus berupa Array ["Node Js", "React Js"]
    ];

    await pool.query(query, values);
    res.redirect("/project");
  } catch (err) {
    // Jika masih error, pesan ini akan muncul di terminal
    console.error("❌ Insert Error Detail:", err.message);
    res.redirect("/add-project");
  }
});

// Update Project
app.post("/update-project/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = formatProjectPayload(req.body);

    // Sesuaikan urutan kolom agar sama dengan logika INSERT kamu
    const query = `
      UPDATE projects 
      SET title=$1, content=$2, start_date=$3, end_date=$4, duration=$5, image=$6, technologies=$7 
      WHERE id=$8`;

    const values = [
      data.title, // $1
      data.content, // $2
      data.startDate, // $3
      data.endDate, // $4
      data.duration, // $5
      data.image, // $6
      data.technologies, // $7 (Array)
      id, // $8
    ];

    await pool.query(query, values);
    res.redirect("/project");
  } catch (err) {
    console.error("❌ Update Error:", err.message);
    res.redirect("/project");
  }
});

// Hapus Project
app.get("/delete-project/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM projects WHERE id = $1", [id]);
    res.redirect("/project");
  } catch (err) {
    res.redirect("/project");
  }
});
// Menampilkan halaman form contact
app.get("/contact", (req, res) => {
  res.render("contact", { title: "Contact Me | ManadoCode" });
});

// Menangani pengiriman form contact (POST)
app.post("/contact", (req, res) => {
  // Sementara kita redirect ke halaman sukses
  res.redirect("/contact-success");
});

// Rute untuk halaman sukses setelah kirim pesan
app.get("/contact-success", (req, res) => {
  res.render("contact-success", {
    title: "Success",
    message: "Terima kasih! Pesan kamu sudah terkirim.",
  });
});

/**
 * 6. SERVER ACTIVATION
 */
app.listen(port, () =>
  console.log(`🚀 Server running: http://localhost:${port}`),
);
