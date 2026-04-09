/**
 * 1. INISIALISASI DATA & MANAJEMEN STATUS (STATE)
 */
let dataProject = JSON.parse(localStorage.getItem("projects")) || [];
let isEditing = false;
let editIndex = null;

// Jalankan render agar data dari LocalStorage langsung muncul saat halaman dibuka
renderProject();

/**
 * 2. FUNGSI UTAMA TAMBAH PROJECT (ADD PROJECT)
 */
function addProject(event) {
  event.preventDefault();

  const name = document.getElementById("projectName").value;
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  const description = document.getElementById("description").value;
  const imageInput = document.getElementById("image").files;

  // Logika Checkbox Teknologi
  const nodeJs = document.getElementById("node").checked
    ? '<i class="bi bi-node-js"></i>'
    : "";
  const nextJs = document.getElementById("next").checked
    ? '<i class="bi bi-bootstrap"></i>'
    : "";
  const reactJs = document.getElementById("react").checked
    ? '<i class="bi bi-react"></i>'
    : "";
  const typescript = document.getElementById("ts").checked
    ? '<i class="bi bi-filetype-ts"></i>'
    : "";

  /**
   * 3. LOGIKA PEMROSESAN GAMBAR (FileReader API)
   * Mengubah gambar menjadi format Base64 agar tersimpan permanen di LocalStorage.
   */
  if (imageInput.length > 0) {
    const reader = new FileReader();

    reader.onload = function (e) {
      const base64Image = e.target.result; // Gambar berubah jadi teks panjang
      saveProjectData(
        name,
        startDate,
        endDate,
        description,
        nodeJs,
        nextJs,
        reactJs,
        typescript,
        base64Image,
      );
    };

    reader.readAsDataURL(imageInput[0]); // Mulai proses konversi gambar
  } else if (isEditing) {
    // Jika sedang edit dan tidak ganti gambar, gunakan gambar lama
    const oldImage = dataProject[editIndex].image;
    saveProjectData(
      name,
      startDate,
      endDate,
      description,
      nodeJs,
      nextJs,
      reactJs,
      typescript,
      oldImage,
    );
  } else {
    return alert("Please upload a project image first!");
  }
}

/**
 * 4. FUNGSI SIMPAN DATA (CREATE & UPDATE LOGIC)
 */
function saveProjectData(
  name,
  startDate,
  endDate,
  description,
  nodeJs,
  nextJs,
  reactJs,
  typescript,
  imageUrl,
) {
  const project = {
    name,
    startDate,
    endDate,
    description,
    nodeJs,
    nextJs,
    reactJs,
    typescript,
    image: imageUrl,
    duration: getDuration(startDate, endDate),
  };

  if (isEditing) {
    // Mode Update
    dataProject[editIndex] = project;
    isEditing = false;
    editIndex = null;
    document.getElementById("submit-btn").innerText = "submit";
    alert("Project updated successfully!");
  } else {
    // Mode Tambah Baru
    dataProject.push(project);
    alert("New project added successfully!");
  }

  // Simpan permanen ke LocalStorage
  localStorage.setItem("projects", JSON.stringify(dataProject));

  // Tampilkan data terbaru
  renderProject();

  // Reset Form
  document.querySelector(".form-flex").reset();
}

/**
 * 5. FUNGSI RENDER (DENGAN FILTER & MAP)
 * (a) Refactor menggunakan .map()
 * (b) Implementasi filter functionality
 */
function renderProject(keyword = "") {
  const container = document.getElementById("project-list");
  if (!container) return;

  // 1. FILTER: Mencari data yang sesuai (Poin B)
  const filteredData = dataProject.filter((project) =>
    project.name.toLowerCase().includes(keyword.toLowerCase()),
  );

  // 2. MAPPING: Mengubah array menjadi HTML (Poin A)
  const projectHTML = filteredData
    .map((project) => {
      /**
       * (c) APPLY CALLBACKS UNTUK INTERAKTIVITAS
       * Sangat Penting: Cari index asli dari dataProject (array utama),
       * bukan index dari hasil filter. Jika tidak, kamu akan salah
       * mengedit/menghapus data saat sedang mencari.
       */
      const originalIndex = dataProject.indexOf(project);

      return `
        <div class="project-card">
            <img src="${project.image}" alt="project image">
            <h4>${project.name}</h4>
            <p class="duration">duration: ${project.duration}</p>
            <p class="desc-text">${project.description}</p>
            <div class="tech-icons">
                ${project.nodeJs} ${project.nextJs} ${project.reactJs} ${project.typescript}
            </div>
            <div class="card-buttons">
                <button onclick="editProject(${originalIndex})" class="btn-edit">edit</button>
                <button onclick="deleteProject(${originalIndex})" class="btn-delete">delete</button>
            </div>
        </div>`;
    })
    .join("");

  container.innerHTML =
    projectHTML ||
    `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #ccc;">
        <i class="bi bi-search" style="font-size: 2rem; display: block; margin-bottom: 10px;"></i>
        <p>No projects found matching your search.</p>
    </div>`;
}

/**
 * FUNGSI PENANGKAP FILTER (Callback Event)
 * Fungsi ini bertindak sebagai callback yang merespon input pengguna.
 */
function handleFilter(event) {
  const value = event.target.value;
  renderProject(value);
}

/**
 * 6. FUNGSI HITUNG DURASI (HELPER)
 */
function getDuration(start, end) {
  const diff = new Date(end) - new Date(start);
  if (diff < 0) return "0 days";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);

  return months > 0 ? `${months} month(s)` : `${days} day(s)`;
}

/**
 * 7. FUNGSI EDIT (MEMINDAHKAN DATA KE FORM)
 */
function editProject(index) {
  isEditing = true;
  editIndex = index;
  const item = dataProject[index];

  document.getElementById("projectName").value = item.name;
  document.getElementById("startDate").value = item.startDate;
  document.getElementById("endDate").value = item.endDate;
  document.getElementById("description").value = item.description;

  document.getElementById("node").checked = item.nodeJs !== "";
  document.getElementById("next").checked = item.nextJs !== "";
  document.getElementById("react").checked = item.reactJs !== "";
  document.getElementById("ts").checked = item.typescript !== "";

  document.getElementById("submit-btn").innerText = "update project";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * 8. FUNGSI HAPUS (DELETE)
 */
function deleteProject(index) {
  if (confirm("Are you sure you want to delete this project?")) {
    dataProject.splice(index, 1);
    localStorage.setItem("projects", JSON.stringify(dataProject));
    renderProject();
  }
}
