import express from "express";
import { engine } from "express-handlebars";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import bcrypt from "bcrypt";
import flash from "req-flash";
import cookieParser from "cookie-parser";
import fs from "fs";
import multer from "multer";
import pool from "./src/config/db.js";
import upload from "./src/middlewares/uploadFile.js";

const app = express();
const port = 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @section 1. HELPERS
 */
const calculateDuration = (start, end) => {
  const diff = Math.abs(new Date(end) - new Date(start));
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Less than a day";
  return days >= 30 ? `${Math.floor(days / 30)} months` : `${days} days`;
};

const formatProjectPayload = (body, authorId) => ({
  title: body.title,
  content: body.content,
  start_date: body.startDate,
  end_date: body.endDate,
  duration: calculateDuration(body.startDate, body.endDate),
  image: body.image || body.oldImage || "default-project.png",
  author_id: authorId,
  technologies: Object.keys({
    node: "Node Js",
    next: "Next Js",
    react: "React Js",
    ts: "TypeScript",
  })
    .filter((key) => body[key])
    .map(
      (key) =>
        ({
          node: "Node Js",
          next: "Next Js",
          react: "React Js",
          ts: "TypeScript",
        })[key],
    ),
});

/**
 * @section 2. MIDDLEWARES
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

app.use((req, res, next) => {
  const rawFlash = req.flash();
  res.locals.isLogin = req.session.isLogin;
  res.locals.user = req.session.user;
  res.locals.messages = {
    success: Array.isArray(rawFlash.success)
      ? rawFlash.success
      : rawFlash.success
        ? [rawFlash.success]
        : null,
    error: Array.isArray(rawFlash.error)
      ? rawFlash.error
      : rawFlash.error
        ? [rawFlash.error]
        : null,
  };
  next();
});

const authGuard = (req, res, next) => {
  if (!req.session.isLogin) {
    req.flash("error", "Please login first!");
    return res.redirect("/login");
  }
  next();
};

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
 * @section 3. AUTH & CONTACT ROUTES
 */
app.get("/register", (req, res) =>
  res.render("register", { title: "Register" }),
);
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
      [name, email, hashedPassword],
    );
    req.flash("success", "Registration successful!");
    res.redirect("/login");
  } catch (err) {
    req.flash("error", "Registration failed.");
    res.redirect("/register");
  }
});

app.get("/login", (req, res) => res.render("login", { title: "Login" }));
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (
      result.rows.length === 0 ||
      !(await bcrypt.compare(password, result.rows[0].password))
    ) {
      req.flash("error", "Invalid email or password!");
      return res.redirect("/login");
    }
    req.session.isLogin = true;
    req.session.user = { id: result.rows[0].id, name: result.rows[0].name };
    res.redirect("/project");
  } catch (err) {
    req.flash("error", "Login error occurred.");
    res.redirect("/login");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

app.get("/contact", (req, res) =>
  res.render("contact", { title: "Contact Me" }),
);
app.post("/contact", (req, res) => {
  res.render("contact-success", {
    title: "Sent Successfully",
    message: "Thank you for reaching out! I will get back to you soon.",
  });
});

/**
 * @section 4. PROJECTS (CRUD)
 */
app.get("/", (req, res) => res.render("home", { title: "Home" }));

app.get("/project", async (req, res) => {
  const result = await pool.query(
    `SELECT p.*, u.name as author_name FROM projects p LEFT JOIN users u ON p.author_id = u.id ORDER BY p.id DESC`,
  );
  res.render("project", { title: "Projects", projects: result.rows });
});

app.get("/project-detail/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT p.*, u.name as author_name FROM projects p LEFT JOIN users u ON p.author_id = u.id WHERE p.id = $1`,
      [id],
    );
    if (result.rows.length === 0)
      return res.status(404).render("404", { title: "Project Not Found" });
    res.render("project-detail", {
      title: "Project Detail",
      project: result.rows[0],
    });
  } catch (err) {
    res.redirect("/project");
  }
});

app.get("/add-project", authGuard, (req, res) =>
  res.render("add-project", { title: "Add Project" }),
);

app.post("/project", authGuard, upload.single("image"), async (req, res) => {
  try {
    const p = formatProjectPayload(req.body, req.session.user.id);
    p.image = req.file ? req.file.filename : "default-project.png";

    await pool.query(
      `INSERT INTO projects (title, content, start_date, end_date, duration, image, author_id, technologies) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        p.title,
        p.content,
        p.start_date,
        p.end_date,
        p.duration,
        p.image,
        p.author_id,
        p.technologies,
      ],
    );
    req.flash("success", "Project added successfully!");
    res.redirect("/project");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/add-project");
  }
});

app.post(
  "/update-project/:id",
  authGuard,
  upload.single("image"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const p = formatProjectPayload(req.body, req.session.user.id);
      p.image = req.file ? req.file.filename : req.body.oldImage;

      await pool.query(
        `UPDATE projects SET title=$1, content=$2, start_date=$3, end_date=$4, duration=$5, image=$6, technologies=$7 WHERE id=$8`,
        [
          p.title,
          p.content,
          p.start_date,
          p.end_date,
          p.duration,
          p.image,
          p.technologies,
          id,
        ],
      );
      req.flash("success", "Project updated successfully!");
      res.redirect("/project");
    } catch (err) {
      req.flash("error", "Update failed: " + err.message);
      res.redirect(`/edit-project/${req.params.id}`);
    }
  },
);

app.get("/edit-project/:id", authGuard, async (req, res) => {
  const result = await pool.query("SELECT * FROM projects WHERE id = $1", [
    req.params.id,
  ]);
  const project = result.rows[0];
  if (project && !Array.isArray(project.technologies)) {
    project.technologies = project.technologies ? [project.technologies] : [];
  }
  res.render("edit-project", { title: "Edit Project", project });
});

app.get("/delete-project/:id", authGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT image FROM projects WHERE id = $1",
      [id],
    );
    const imageName = result.rows[0]?.image;

    if (imageName && imageName !== "default-project.png") {
      const filePath = path.join(__dirname, "src/assets/img", imageName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.query("DELETE FROM projects WHERE id = $1", [id]);
    req.flash("success", "Project deleted successfully!");
    res.redirect("/project");
  } catch (err) {
    req.flash("error", "Delete failed");
    res.redirect("/project");
  }
});

/**
 * @section 5. ERROR HANDLING MIDDLEWARE
 * Handles Multer errors and general server errors
 */
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      req.flash("error", "File too large! Maximum size allowed is 2MB.");
    } else {
      req.flash("error", `Upload Error: ${err.message}`);
    }
    return res.redirect(req.get("Referrer") || "/project");
  }

  if (err) {
    req.flash("error", err.message);
    return res.redirect(req.get("Referrer") || "/project");
  }
  next();
});

/**
 * @section 6. SERVER
 */
app.use((req, res) =>
  res.status(404).render("404", { title: "404 Not Found" }),
);
app.listen(port, () =>
  console.log(`🚀 Server running at http://localhost:${port}`),
);
