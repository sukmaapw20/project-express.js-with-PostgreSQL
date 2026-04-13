import express from "express";
import { engine } from "express-handlebars";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import flash from "express-flash";
import cookieParser from "cookie-parser";
import pool from "./src/config/db.js";

// 1. IMPORT ROUTER AUTH
import authRouter from "./src/routes/auth.js";

const app = express();
const port = 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @section 1. BUSINESS LOGIC HELPERS
 */
const calculateDuration = (start, end) => {
  const diffInMs = Math.abs(new Date(end) - new Date(start));
  const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
  return diffInDays >= 30
    ? `${Math.floor(diffInDays / 30)} months`
    : `${diffInDays} days`;
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

const formatProjectPayload = (body) => ({
  title: body.title,
  content: body.content,
  startDate: body.startDate,
  endDate: body.endDate,
  image: body.image || "default-project.png",
  duration: calculateDuration(body.startDate, body.endDate),
  technologies: parseTechnologies(body),
});

/**
 * @section 2. MIDDLEWARE & SESSION
 */
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use("/assets", express.static(path.join(__dirname, "src/assets")));

app.use(
  session({
    name: "manado-session",
    secret: "manado_secret_2026",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
  }),
);

app.use(flash());

// Middleware Global: Mengirim status login & pesan flash ke semua .hbs
app.use((req, res, next) => {
  res.locals.isLogin = req.session.isLogin;
  res.locals.user = req.session.user;
  res.locals.messages = req.flash();
  next();
});

// Middleware Pelindung Rute (Auth Guard)
const authGuard = (req, res, next) => {
  if (!req.session.isLogin) {
    req.flash("error", "Please login first to access this page!");
    return res.redirect("/login");
  }
  next();
};

/**
 * @section 3. VIEW ENGINE SETUP
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

/**
 * @section 4. ROUTES
 */

// A. Autentikasi (Panggilan Router yang dipisah)
app.use(authRouter);

// B. Navigasi Umum
app.get("/", (req, res) => res.render("home", { title: "Home | ManadoCode" }));

app.get("/project", async (req, res) => {
  try {
    const query = `SELECT projects.*, users.name AS author_name FROM projects 
                   LEFT JOIN users ON projects.author_id = users.id 
                   ORDER BY projects.id DESC`;
    const result = await pool.query(query);
    res.render("project", { title: "My Projects", projects: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to load projects.");
  }
});

// C. Manajemen Proyek (CRUD - Dilindungi authGuard)
app.get("/add-project", authGuard, (req, res) =>
  res.render("add-project", { title: "Add Project" }),
);

app.post("/project", authGuard, async (req, res) => {
  try {
    const data = formatProjectPayload(req.body);
    const authorId = req.session.user.id;
    const query = `INSERT INTO projects (title, content, start_date, end_date, duration, image, author_id, technologies) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
    const values = [
      data.title,
      data.content,
      data.startDate,
      data.endDate,
      data.duration,
      data.image,
      authorId,
      data.technologies,
    ];

    await pool.query(query, values);
    req.flash("success", "Project added successfully!");
    res.redirect("/project");
  } catch (err) {
    req.flash("error", "Failed to add project.");
    res.redirect("/add-project");
  }
});

app.get("/delete-project/:id", authGuard, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM projects WHERE id = $1", [id]);
    req.flash("success", "Project deleted!");
    res.redirect("/project");
  } catch (err) {
    req.flash("error", "Delete failed.");
    res.redirect("/project");
  }
});

app.get("/edit-project/:id", authGuard, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query("SELECT * FROM projects WHERE id = $1", [id]);
  res.render("edit-project", {
    title: "Edit Project",
    project: result.rows[0],
  });
});

/**
 * @section 5. ERROR HANDLING & SERVER
 */
app.use((req, res) => res.status(404).send("Page not found."));

app.listen(port, () => {
  console.log(`🚀 ManadoCode Server Is Live! URL: http://localhost:${port}`);
});
