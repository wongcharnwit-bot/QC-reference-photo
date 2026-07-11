/* global supabase, SUPABASE_URL, SUPABASE_ANON_KEY */

const { createClient } = supabase;

const LOGO_PATH = "./logo.png?v=4";
const MAX_PHOTOS_PER_LOT = 3;

let client = null;
let currentUser = null;
let currentRole = "user";

function getClient() {
  if (!client) {
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY || window.SUPABASE_URL.includes("xxxxxxxx")) {
      throw new Error("กรุณาตั้งค่า config.js ก่อนใช้งาน");
    }
    client = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return client;
}

function logoImg(className) {
  return `<img src="${LOGO_PATH}" alt="Logo" class="${className}" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')" /><span class="logo-fallback" style="display:none">H</span>`;
}

function shell(title, bodyHtml, showLogout = true) {
  return `
    <header>
      <div class="header-brand">
        ${logoImg("header-logo")}
        <div>
          <p class="label">HEXA QC</p>
          <h1>${title}</h1>
        </div>
      </div>
      ${showLogout ? '<button class="btn-text" id="logout-btn">ออก</button>' : ""}
    </header>
    <main>${bodyHtml}</main>
  `;
}

function showError(el, msg) {
  el.innerHTML = `<p class="error">${msg}</p>`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function ensureSession() {
  const sb = getClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  return session;
}

// ─── Login ───────────────────────────────────────────
function renderLogin(errorMsg = "") {
  const app = document.getElementById("app");
  app.innerHTML = shell(
    "เข้าสู่ระบบ",
    `
    <div class="center-content">
      <form id="login-form" class="gap-6" style="width:100%">
        <div class="text-center">
          <div class="logo-box">${logoImg("logo-large")}</div>
          <h2 class="login-title">เข้าสู่ระบบ</h2>
          <p class="text-muted">ดูรูปอ้างอิง QC ตาม Lot No.</p>
        </div>
        ${errorMsg ? `<p class="error">${errorMsg}</p>` : ""}
        <div class="field">
          <label for="email">อีเมล</label>
          <input id="email" type="email" required placeholder="your@email.com" autocomplete="email" />
        </div>
        <div class="field">
          <label for="password">รหัสผ่าน</label>
          <input id="password" type="password" required placeholder="••••••••" autocomplete="current-password" />
        </div>
        <button type="submit" class="btn-primary" id="login-btn">เข้าสู่ระบบ</button>
      </form>
    </div>
    `,
    false
  );

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("login-btn");
    btn.disabled = true;
    btn.textContent = "กำลังเข้าสู่ระบบ...";

    try {
      const rawEmail = document.getElementById("email").value.trim().toLowerCase();
      const email = rawEmail.includes("@") ? rawEmail : `${rawEmail}@hexarpd.com`;
      const password = document.getElementById("password").value;
      const { error } = await getClient().auth.signInWithPassword({ email, password });
      if (error) {
        const message = (error.message || "").toLowerCase();
        if (message.includes("email not confirmed")) {
          renderLogin("บัญชียังไม่ยืนยันอีเมล ให้แอดมินสร้างแบบ Auto Confirm");
          return;
        }
        if (message.includes("invalid login credentials")) {
          renderLogin("อีเมลหรือรหัสผ่านไม่ถูกต้อง (ตรวจใน Supabase > Auth > Users)");
          return;
        }
        renderLogin(`เข้าสู่ระบบไม่สำเร็จ: ${error.message}`);
        return;
      }
      await initApp();
    } catch (err) {
      renderLogin(err.message || "เข้าสู่ระบบไม่สำเร็จ");
    }
  });
}

// ─── Search (User) ───────────────────────────────────
function renderSearch() {
  const app = document.getElementById("app");
  app.innerHTML = shell(
    "ค้นหารูป QC",
    `
    <div class="center-content" id="search-view">
      <div class="text-center">
        <p class="text-muted">ใส่ Lot No. / SO</p>
        <p class="text-muted">เพื่อดูรูปอ้างอิงจาก QC</p>
      </div>
      <form id="search-form">
        <div id="search-error"></div>
        <div class="field">
          <label for="lotNo">Lot No. / SO</label>
          <input id="lotNo" class="lot-input" type="text" required placeholder="SO-12345" autocomplete="off" />
        </div>
        <button type="submit" class="btn-primary" id="search-btn">OK</button>
      </form>
    </div>
    `
  );

  document.getElementById("logout-btn").addEventListener("click", handleLogout);

  document.getElementById("search-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("search-btn");
    const errorEl = document.getElementById("search-error");
    errorEl.innerHTML = "";

    const lotNo = document.getElementById("lotNo").value.trim().toUpperCase();
    if (!lotNo) return;

    btn.disabled = true;
    btn.textContent = "กำลังค้นหา...";

    try {
      const { data: photos, error } = await getClient()
        .from("photos")
        .select("*")
        .eq("lot_no", lotNo)
        .order("created_at", { ascending: true });

      if (error || !photos?.length) {
        showError(errorEl, `ไม่พบรูปสำหรับ SO: ${lotNo}`);
        return;
      }

      const urls = [];
      for (const photo of photos) {
        const { data: signed, error: signErr } = await getClient()
          .storage.from("qc-photos")
          .createSignedUrl(photo.storage_path, 3600);
        if (!signErr && signed?.signedUrl) urls.push(signed.signedUrl);
      }

      if (!urls.length) {
        showError(errorEl, "ไม่สามารถโหลดรูปได้ กรุณาลองใหม่");
        return;
      }

      renderPhotoView(lotNo, photos, urls);
    } catch (err) {
      showError(errorEl, err.message || "ค้นหาไม่สำเร็จ");
    } finally {
      btn.disabled = false;
      btn.textContent = "OK";
    }
  });
}

function renderPhotoView(lotNo, photos, imageUrls) {
  const app = document.getElementById("app");
  app.innerHTML = shell(
    "ค้นหารูป QC",
    `
    <div class="photo-view">
      <div class="photo-header">
        <div>
          <p class="text-muted small">SO / Lot No.</p>
          <p class="lot-display">${lotNo}</p>
        </div>
        <button class="btn-secondary" id="back-btn">ค้นหาใหม่</button>
      </div>
      <p class="text-muted small">${imageUrls.length} รูป · อัปโหลด ${formatDate(photos[0].created_at)}</p>
      <div class="photo-gallery">
        ${imageUrls.map((url, i) => `
          <div class="photo-frame">
            <p class="photo-label">รูปที่ ${i + 1}</p>
            <img src="${url}" alt="QC ${lotNo} - ${i + 1}" />
          </div>
        `).join("")}
      </div>
      <p class="text-center text-muted">เปรียบเทียบกับงานปัจจุบันของคุณ</p>
    </div>
    `
  );

  document.getElementById("logout-btn").addEventListener("click", handleLogout);
  document.getElementById("back-btn").addEventListener("click", renderSearch);
}

// ─── QC Dashboard ────────────────────────────────────
function renderQC() {
  const app = document.getElementById("app");
  app.innerHTML = shell(
    "QC Dashboard",
    `
    <div class="gap-6">
      <form id="upload-form" class="card gap-6">
        <h3 class="card-title">เพิ่มรูป QC ใหม่</h3>
        <div id="upload-msg"></div>
        <div class="field">
          <label for="uploadLot">Lot No. / SO</label>
          <input id="uploadLot" class="lot-input" type="text" required placeholder="SO-12345" style="font-size:1rem" />
        </div>
        <div class="field">
          <label for="uploadFile">รูปภาพ (สูงสุด ${MAX_PHOTOS_PER_LOT} รูปต่อ SO)</label>
          <div class="upload-zone" id="upload-zone" role="button" tabindex="0">
            <div id="upload-placeholder">
              <span class="upload-icon">📷</span>
              <span class="upload-hint">แตะเพื่อเลือกรูป</span>
              <span class="btn-upload-select">เลือกรูป (1-${MAX_PHOTOS_PER_LOT} รูป)</span>
            </div>
            <div id="preview-grid" class="preview-grid hidden"></div>
          </div>
          <input id="uploadFile" type="file" accept="image/*" multiple class="file-input-hidden" />
        </div>
        <button type="submit" class="btn-primary" id="upload-btn" style="font-size:1rem;padding:1rem" disabled>
          บันทึกรูป QC
        </button>
      </form>
      <div id="photo-list"><p class="text-center text-muted">กำลังโหลด...</p></div>
    </div>
    `
  );

  document.getElementById("logout-btn").addEventListener("click", handleLogout);

  let selectedFiles = [];
  const fileInput = document.getElementById("uploadFile");
  const uploadBtn = document.getElementById("upload-btn");
  const uploadPlaceholder = document.getElementById("upload-placeholder");
  const previewGrid = document.getElementById("preview-grid");
  const uploadZone = document.getElementById("upload-zone");

  uploadZone.addEventListener("click", () => fileInput.click());
  uploadZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });

  function updateUploadBtn() {
    uploadBtn.disabled = !document.getElementById("uploadLot").value.trim() || selectedFiles.length === 0;
  }

  function renderPreviews() {
    if (!selectedFiles.length) {
      previewGrid.classList.add("hidden");
      previewGrid.innerHTML = "";
      uploadPlaceholder.classList.remove("hidden");
      return;
    }
    uploadPlaceholder.classList.add("hidden");
    previewGrid.classList.remove("hidden");
    previewGrid.innerHTML = selectedFiles
      .map((f, i) => `<div class="preview-item"><img src="${URL.createObjectURL(f)}" alt="preview ${i + 1}" /><span>${i + 1}</span></div>`)
      .join("");
  }

  fileInput.addEventListener("change", (e) => {
    const msgEl = document.getElementById("upload-msg");
    msgEl.innerHTML = "";

    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const valid = files.filter((f) => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024);
    if (valid.length !== files.length) {
      msgEl.innerHTML = '<p class="error">เลือกได้เฉพาะรูปภาพ ไม่เกิน 10MB</p>';
    }

    selectedFiles = valid.slice(0, MAX_PHOTOS_PER_LOT);
    if (files.length > MAX_PHOTOS_PER_LOT) {
      msgEl.innerHTML = `<p class="error">เลือกได้สูงสุด ${MAX_PHOTOS_PER_LOT} รูป</p>`;
    }

    renderPreviews();
    updateUploadBtn();
  });

  document.getElementById("uploadLot").addEventListener("input", updateUploadBtn);

  document.getElementById("upload-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById("upload-msg");
    msgEl.innerHTML = "";

    const lotNo = document.getElementById("uploadLot").value.trim().toUpperCase();
    if (!lotNo || !selectedFiles.length) return;

    uploadBtn.disabled = true;
    uploadBtn.textContent = "กำลังอัปโหลด...";

    try {
      await ensureSession();

      const { count } = await getClient()
        .from("photos")
        .select("*", { count: "exact", head: true })
        .eq("lot_no", lotNo);

      const existing = count || 0;
      if (existing + selectedFiles.length > MAX_PHOTOS_PER_LOT) {
        throw new Error(`SO ${lotNo} มีรูปอยู่ ${existing} รูปแล้ว เพิ่มได้อีก ${MAX_PHOTOS_PER_LOT - existing} รูป`);
      }

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const storagePath = `${lotNo}/${Date.now()}_${i}.${ext}`;

        const { error: uploadErr } = await getClient()
          .storage.from("qc-photos")
          .upload(storagePath, file, { contentType: file.type, upsert: false });

        if (uploadErr) throw new Error(`อัปโหลดรูปที่ ${i + 1} ไม่สำเร็จ: ${uploadErr.message}`);

        const { error: insertErr } = await getClient().from("photos").insert({
          lot_no: lotNo,
          storage_path: storagePath,
          uploaded_by: currentUser.id,
        });

        if (insertErr) {
          await getClient().storage.from("qc-photos").remove([storagePath]);
          throw new Error(`บันทึกรูปที่ ${i + 1} ไม่สำเร็จ`);
        }
      }

      msgEl.innerHTML = `<p class="success">บันทึก SO ${lotNo} สำเร็จ ${selectedFiles.length} รูป</p>`;
      document.getElementById("uploadLot").value = "";
      selectedFiles = [];
      fileInput.value = "";
      renderPreviews();
      loadPhotoList();
    } catch (err) {
      const msg = err.message?.includes("fetch")
        ? "เชื่อมต่อไม่สำเร็จ — ตรวจ Supabase URL/Key และรัน fix-upload.sql"
        : err.message || "อัปโหลดไม่สำเร็จ";
      msgEl.innerHTML = `<p class="error">${msg}</p>`;
    } finally {
      uploadBtn.textContent = "บันทึกรูป QC";
      updateUploadBtn();
    }
  });

  loadPhotoList();
}

async function loadPhotoList() {
  const listEl = document.getElementById("photo-list");
  const { data: photos } = await getClient()
    .from("photos")
    .select("*")
    .order("created_at", { ascending: false });

  if (!photos?.length) {
    listEl.innerHTML = `<div class="text-center empty-state"><p class="text-muted">ยังไม่มีรูป QC</p></div>`;
    return;
  }

  listEl.innerHTML = `
    <p class="text-muted list-title">รายการทั้งหมด (${photos.length})</p>
    <div class="photo-list">
      ${photos.map((p) => `
        <div class="photo-item">
          <div>
            <p class="lot">${p.lot_no}</p>
            <p class="text-muted small">${formatDate(p.created_at)}</p>
          </div>
          <button class="btn-danger" data-delete="${p.id}" data-lot="${p.lot_no}" data-path="${p.storage_path}">ลบ</button>
        </div>
      `).join("")}
    </div>
  `;

  listEl.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm(`ลบรูป SO ${btn.dataset.lot}?`)) return;
      btn.disabled = true;
      await getClient().storage.from("qc-photos").remove([btn.dataset.path]);
      await getClient().from("photos").delete().eq("id", btn.dataset.delete);
      loadPhotoList();
    });
  });
}

async function handleLogout() {
  await getClient().auth.signOut();
  currentUser = null;
  renderLogin();
}

async function getProfile(userId) {
  const { data } = await getClient().from("profiles").select("role").eq("id", userId).single();
  return data?.role || "user";
}

async function initApp() {
  try {
    getClient();
  } catch (err) {
    renderLogin(err.message);
    return;
  }

  const { data: { session } } = await getClient().auth.getSession();
  if (!session?.user) {
    renderLogin();
    return;
  }

  currentUser = session.user;
  currentRole = await getProfile(currentUser.id);
  currentRole === "qc" ? renderQC() : renderSearch();
}

initApp().catch((err) => {
  document.getElementById("app").innerHTML = shell("ข้อผิดพลาด", `<p class="error">${err.message}</p>`, false);
});
