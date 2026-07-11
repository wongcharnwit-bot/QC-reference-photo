/* global supabase, SUPABASE_URL, SUPABASE_ANON_KEY */

const { createClient } = supabase;

let client = null;
let currentUser = null;
let currentRole = "user";

function getClient() {
  if (!client) {
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY || window.SUPABASE_URL.includes("xxxxxxxx")) {
      throw new Error("กรุณาตั้งค่า config.js ก่อนใช้งาน");
    }
    client = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }
  return client;
}

function shell(title, bodyHtml, showLogout = true) {
  return `
    <header>
      <div>
        <p class="label">HEXA QC</p>
        <h1>${title}</h1>
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

// ─── Login ───────────────────────────────────────────
function renderLogin(errorMsg = "") {
  const app = document.getElementById("app");
  app.innerHTML = shell(
    "เข้าสู่ระบบ",
    `
    <div class="center-content">
      <form id="login-form" class="gap-6" style="width:100%">
        <div class="text-center">
          <div class="icon-box">📷</div>
          <h2 style="font-size:1.25rem;margin-bottom:0.25rem">เข้าสู่ระบบ</h2>
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

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { error } = await getClient().auth.signInWithPassword({ email, password });

    if (error) {
      renderLogin("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      return;
    }

    await initApp();
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

    const { data: photo, error } = await getClient()
      .from("photos")
      .select("*")
      .eq("lot_no", lotNo)
      .maybeSingle();

    if (error || !photo) {
      showError(errorEl, `ไม่พบรูปสำหรับ SO: ${lotNo}`);
      btn.disabled = false;
      btn.textContent = "OK";
      return;
    }

    const { data: signed, error: signErr } = await getClient()
      .storage.from("qc-photos")
      .createSignedUrl(photo.storage_path, 3600);

    if (signErr || !signed?.signedUrl) {
      showError(errorEl, "ไม่สามารถโหลดรูปได้ กรุณาลองใหม่");
      btn.disabled = false;
      btn.textContent = "OK";
      return;
    }

    renderPhotoView(photo, signed.signedUrl);
  });
}

function renderPhotoView(photo, imageUrl) {
  const app = document.getElementById("app");
  app.innerHTML = shell(
    "ค้นหารูป QC",
    `
    <div class="photo-view">
      <div class="photo-header">
        <div>
          <p class="text-muted" style="font-size:0.75rem">SO / Lot No.</p>
          <p class="lot-display">${photo.lot_no}</p>
        </div>
        <button class="btn-secondary" id="back-btn">ค้นหาใหม่</button>
      </div>
      <p class="text-muted" style="font-size:0.75rem">อัปโหลดเมื่อ ${formatDate(photo.created_at)}</p>
      <div class="photo-frame">
        <img src="${imageUrl}" alt="QC ${photo.lot_no}" />
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
        <h3 style="font-weight:600">เพิ่มรูป QC ใหม่</h3>
        <div id="upload-msg"></div>
        <div class="field">
          <label for="uploadLot">Lot No. / SO</label>
          <input id="uploadLot" class="lot-input" type="text" required placeholder="SO-12345" style="font-size:1rem" />
        </div>
        <div class="field">
          <label>รูปภาพ</label>
          <label class="upload-zone" id="upload-zone">
            <span id="upload-preview-text">📁 แตะเพื่อเลือกรูป</span>
            <img id="upload-preview" class="hidden" alt="preview" />
            <input id="uploadFile" type="file" accept="image/*" capture="environment" hidden />
          </label>
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

  let selectedFile = null;
  const fileInput = document.getElementById("uploadFile");
  const uploadBtn = document.getElementById("upload-btn");
  const preview = document.getElementById("upload-preview");
  const previewText = document.getElementById("upload-preview-text");

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      document.getElementById("upload-msg").innerHTML = '<p class="error">กรุณาเลือกไฟล์รูปภาพเท่านั้น</p>';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      document.getElementById("upload-msg").innerHTML = '<p class="error">ไฟล์ใหญ่เกิน 10MB</p>';
      return;
    }

    selectedFile = file;
    preview.src = URL.createObjectURL(file);
    preview.classList.remove("hidden");
    previewText.classList.add("hidden");
    uploadBtn.disabled = !document.getElementById("uploadLot").value.trim();
  });

  document.getElementById("uploadLot").addEventListener("input", () => {
    uploadBtn.disabled = !document.getElementById("uploadLot").value.trim() || !selectedFile;
  });

  document.getElementById("upload-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById("upload-msg");
    msgEl.innerHTML = "";

    const lotNo = document.getElementById("uploadLot").value.trim().toUpperCase();
    if (!lotNo || !selectedFile) return;

    uploadBtn.disabled = true;
    uploadBtn.textContent = "กำลังอัปโหลด...";

    const ext = selectedFile.name.split(".").pop() || "jpg";
    const storagePath = `${lotNo}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await getClient()
      .storage.from("qc-photos")
      .upload(storagePath, selectedFile);

    if (uploadErr) {
      msgEl.innerHTML = `<p class="error">อัปโหลดไม่สำเร็จ: ${uploadErr.message}</p>`;
      uploadBtn.disabled = false;
      uploadBtn.textContent = "บันทึกรูป QC";
      return;
    }

    const { error: insertErr } = await getClient().from("photos").insert({
      lot_no: lotNo,
      storage_path: storagePath,
      uploaded_by: currentUser.id,
    });

    if (insertErr) {
      await getClient().storage.from("qc-photos").remove([storagePath]);
      const msg = insertErr.code === "23505"
        ? `SO ${lotNo} มีอยู่แล้ว กรุณาลบรายการเดิมก่อน`
        : "บันทึกข้อมูลไม่สำเร็จ";
      msgEl.innerHTML = `<p class="error">${msg}</p>`;
      uploadBtn.disabled = false;
      uploadBtn.textContent = "บันทึกรูป QC";
      return;
    }

    msgEl.innerHTML = `<p class="success">บันทึก SO ${lotNo} สำเร็จ</p>`;
    document.getElementById("uploadLot").value = "";
    selectedFile = null;
    fileInput.value = "";
    preview.classList.add("hidden");
    previewText.classList.remove("hidden");
    uploadBtn.textContent = "บันทึกรูป QC";
    uploadBtn.disabled = true;

    loadPhotoList();
  });

  loadPhotoList();
}

async function loadPhotoList() {
  const listEl = document.getElementById("photo-list");
  const { data: photos } = await getClient()
    .from("photos")
    .select("*")
    .order("created_at", { ascending: false });

  if (!photos || photos.length === 0) {
    listEl.innerHTML = `
      <div class="text-center" style="padding:2rem 0">
        <p class="text-muted">ยังไม่มีรูป QC</p>
        <p class="text-muted" style="font-size:0.8rem;margin-top:0.25rem">อัปโหลดรูปแรกด้านบน</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = `
    <p class="text-muted" style="font-size:0.875rem;font-weight:600">รายการทั้งหมด (${photos.length})</p>
    <div class="photo-list">
      ${photos.map((p) => `
        <div class="photo-item" data-id="${p.id}">
          <div>
            <p class="lot">${p.lot_no}</p>
            <p class="text-muted" style="font-size:0.75rem">${formatDate(p.created_at)}</p>
          </div>
          <button class="btn-danger" data-delete="${p.id}" data-lot="${p.lot_no}" data-path="${p.storage_path}">ลบ</button>
        </div>
      `).join("")}
    </div>
  `;

  listEl.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const lot = btn.dataset.lot;
      const id = btn.dataset.id;
      const path = btn.dataset.path;

      if (!confirm(`ลบ SO ${lot} และรูปภาพ?`)) return;

      btn.disabled = true;
      btn.textContent = "...";

      await getClient().storage.from("qc-photos").remove([path]);
      const { error } = await getClient().from("photos").delete().eq("id", id);

      if (error) {
        alert("ลบไม่สำเร็จ กรุณาลองใหม่");
        btn.disabled = false;
        btn.textContent = "ลบ";
        return;
      }

      loadPhotoList();
    });
  });
}

// ─── Auth helpers ────────────────────────────────────
async function handleLogout() {
  await getClient().auth.signOut();
  currentUser = null;
  renderLogin();
}

async function getProfile(userId) {
  const { data } = await getClient()
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
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

  if (currentRole === "qc") {
    renderQC();
  } else {
    renderSearch();
  }
}

// Start
initApp().catch((err) => {
  document.getElementById("app").innerHTML = shell(
    "ข้อผิดพลาด",
    `<p class="error">${err.message}</p>`,
    false
  );
});
