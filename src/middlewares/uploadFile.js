import multer from "multer";
import path from "path";

// 1. Konfigurasi penyimpanan file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // File akan disimpan di folder src/assets/img sesuai struktur foldermu
    cb(null, "src/assets/img");
  },
  filename: (req, file, cb) => {
    // Membuat nama file unik (timestamp + nama asli file)
    // .replace(/\s/g, "-") digunakan untuk menghilangkan spasi pada nama file
    const uniqueSuffix =
      Date.now() + "-" + file.originalname.replace(/\s/g, "-");
    cb(null, uniqueSuffix);
  },
});

// 2. Filter validasi tipe file dan ukuran
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // Batasi ukuran maksimal 2MB
  },
  fileFilter: (req, file, cb) => {
    // Mendapatkan ekstensi file
    const ext = path.extname(file.originalname).toLowerCase();

    // Hanya izinkan format gambar tertentu
    if (ext === ".jpg" || ext === ".jpeg" || ext === ".png") {
      cb(null, true);
    } else {
      // Error jika format tidak sesuai
      cb(
        new Error("Hanya file .png, .jpg, dan .jpeg yang diperbolehkan!"),
        false,
      );
    }
  },
});

export default upload;
