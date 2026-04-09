import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  user: "postgres", // Username default pgAdmin
  host: "localhost", // Karena database ada di laptopmu
  database: "manado_db", // Nama database yang kamu buat tadi
  password: "2222", // Ganti dengan password asli pgAdmin-mu
  port: 5432, // Port default PostgreSQL
});

// Tes koneksi di terminal saat server jalan
pool.connect((err) => {
  if (err) {
    console.error("❌ Gagal konek database:", err.message);
  } else {
    console.log("✅ Database terhubung ke manado_db");
  }
});

export default pool;
