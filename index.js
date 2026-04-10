import express from "express";
import { engine } from "express-handlebars";
import path from "path";
import { fileURLToPath } from "url";
import pool from "./src/config/db.js";

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
 * @section 2. MIDDLEWARE & VIEW ENGINE
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
 * @section 3. NAVIGATION ROUTES (READ)
 */
app.get("/", (req, res) => res.render("home", { title: "Home | ManadoCode" }));
app.get("/contact", (req, res) =>
  res.render("contact", { title: "Contact Me" }),
);
app.get("/contact-success", (req, res) =>
  res.render("contact-success", { title: "Success | ManadoCode" }),
);

app.get("/project", async (req, res) => {
  try {
    const query = `SELECT projects.*, users.name AS author_name FROM projects LEFT JOIN users ON projects.author_id = users.id ORDER BY projects.id DESC`;
    const result = await pool.query(query);
    res.render("project", { title: "My Projects", projects: result.rows });
  } catch (err) {
    res.status(500).send("Failed to load projects.");
  }
});

app.get("/project-detail/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const query = `SELECT projects.*, users.name AS author_name FROM projects LEFT JOIN users ON projects.author_id = users.id WHERE projects.id = $1`;
    const result = await pool.query(query, [id]);
    const project = result.rows[0];
    if (!project) return res.redirect("/project");

    const options = { day: "numeric", month: "short", year: "numeric" };
    project.start_date = new Date(project.start_date).toLocaleDateString(
      "en-US",
      options,
    );
    project.end_date = new Date(project.end_date).toLocaleDateString(
      "en-US",
      options,
    );

    res.render("project-detail", { title: "Project Detail", project });
  } catch (err) {
    res.redirect("/project");
  }
});

/**
 * @section 4. ACTION ROUTES (CREATE, UPDATE, DELETE)
 */
app.post("/contact", (req, res) => {
  console.log("Message received:", req.body);
  res.redirect("/contact-success");
});

app.get("/add-project", (req, res) =>
  res.render("add-project", { title: "Add Project" }),
);

app.post("/project", async (req, res) => {
  try {
    const data = formatProjectPayload(req.body);
    const query = `INSERT INTO projects (title, content, start_date, end_date, duration, image, author_id, technologies) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
    const values = [
      data.title,
      data.content,
      data.startDate,
      data.endDate,
      data.duration,
      data.image,
      1,
      data.technologies,
    ];
    await pool.query(query, values);
    res.redirect("/project");
  } catch (err) {
    res.redirect("/add-project");
  }
});

app.get("/edit-project/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM projects WHERE id = $1", [
      id,
    ]);
    res.render("edit-project", {
      title: "Edit Project",
      project: result.rows[0],
    });
  } catch (err) {
    res.redirect("/project");
  }
});

app.post("/update-project/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = formatProjectPayload(req.body);
    const query = `UPDATE projects SET title=$1, content=$2, start_date=$3, end_date=$4, duration=$5, image=$6, technologies=$7 WHERE id=$8`;
    const values = [
      data.title,
      data.content,
      data.startDate,
      data.endDate,
      data.duration,
      data.image,
      data.technologies,
      id,
    ];
    await pool.query(query, values);
    res.redirect("/project");
  } catch (err) {
    res.redirect("/project");
  }
});

app.get("/delete-project/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM projects WHERE id = $1", [req.params.id]);
    res.redirect("/project");
  } catch (err) {
    res.redirect("/project");
  }
});

/**
 * @section 5. ERROR HANDLING & SERVER ACTIVATION
 */
app.use((req, res) => res.status(404).send("Page not found."));

app.listen(port, () => {
  const now = new Date();
  console.log(`
  🚀 ManadoCode Server Is Live!
  -----------------------------
  URL  : http://localhost:${port}
  Date : ${now.toLocaleDateString("en-US")}, ${now.toLocaleTimeString("en-US")}
  -----------------------------
  `);
});
