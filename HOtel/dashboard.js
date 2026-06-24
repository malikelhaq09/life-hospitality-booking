/* ============================================================
   LIFE Hospitality — Dashboard Logic
   Sistem login, pengelolaan kuota, dan log booking via LocalStorage
   ============================================================ */

(function () {
  "use strict";

  // Helper
  const $ = (sel) => document.querySelector(sel);
  const formatRupiah = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");
  const formatDateID = (isoStr) => {
    if (!isoStr) return "—";
    const d = new Date(isoStr + "T00:00:00");
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  };

  const todayISO = () => new Date().toISOString().slice(0, 10);

  function getAvailableHotelQuotaToday(hotelId, targetDate) {
    const hotelsList = getHotels();
    const hotel = hotelsList.find((h) => h.id === hotelId);
    if (!hotel || !hotel.roomTypes) return 0;

    const checkDate = targetDate || todayISO();
    const bookings = JSON.parse(localStorage.getItem("life_hospitality_bookings") || "[]");
    
    let totalAvailable = 0;
    for (const rt of hotel.roomTypes) {
      const baseQuota = parseInt(rt.quota || 0, 10);
      
      const overlappingBookings = bookings.filter((b) => {
        if (b.hotelId !== hotelId) return false;
        if (b.status === "Cancelled") return false;
        
        const isSameRoom = b.roomType.toLowerCase() === rt.name.toLowerCase() || b.roomType.toLowerCase() === rt.id.toLowerCase();
        if (!isSameRoom) return false;

        // Tamu menginap di tanggal checkDate jika checkin <= checkDate < checkout
        return b.checkin <= checkDate && b.checkout > checkDate;
      });

      // Sum rooms consumed (support multi-room bookings)
      const roomsConsumed = overlappingBookings.reduce((sum, b) => sum + (parseInt(b.rooms, 10) || 1), 0);
      totalAvailable += Math.max(0, baseQuota - roomsConsumed);
    }
    return totalAvailable;
  }

  const getHotels = () => {
    const defaults = typeof HOTELS !== "undefined" ? HOTELS : [];
    const overrides = JSON.parse(localStorage.getItem("life_hospitality_hotels_overrides") || "{}");
    const newHotels = JSON.parse(localStorage.getItem("life_hospitality_new_hotels") || "[]");
    const quotas = JSON.parse(localStorage.getItem("life_hospitality_quotas") || "{}");

    const getWithRoomTypes = (h) => {
      const merged = overrides[h.id] ? { ...h, ...overrides[h.id] } : h;
      if (!merged.roomTypes || merged.roomTypes.length === 0) {
        const totalQ = quotas[h.id] !== undefined ? parseInt(quotas[h.id], 10) : 5;
        const superiorQ = Math.ceil(totalQ / 2);
        const deluxeQ = Math.floor(totalQ / 2);

        merged.roomTypes = [
          {
            id: "superior",
            name: "Superior Room",
            price: merged.price,
            originalPrice: merged.originalPrice !== undefined ? merged.originalPrice : Math.round(merged.price * 1.15),
            quota: superiorQ,
            image: merged.thumbs && merged.thumbs[0] ? merged.thumbs[0] : merged.image,
            desc: "Kamar standar dengan fasilitas lengkap & nyaman"
          },
          {
            id: "deluxe",
            name: "Deluxe Room",
            price: Math.round(merged.price * 1.2),
            originalPrice: Math.round(merged.price * 1.2 * 1.15),
            quota: deluxeQ,
            image: merged.thumbs && merged.thumbs[1] ? merged.thumbs[1] : merged.image,
            desc: "Kamar luas dengan amenitas premium pilihan"
          }
        ];
      }
      return merged;
    };

    const defaultsMerged = defaults.map(getWithRoomTypes);
    const newHotelsMerged = newHotels.map(getWithRoomTypes);

    return [...defaultsMerged, ...newHotelsMerged];
  };

  // State
  let currentUser = null; // { username, hotelId, hotelName }

  // DOM elements
  const loginOverlay = $("#loginOverlay");
  const loginForm = $("#loginForm");
  const loginError = $("#loginError");
  const usernameInput = $("#username");
  const passwordInput = $("#password");

  const dashContainer = $("#dashContainer");
  const activeHotelLabel = $("#activeHotelLabel");
  const logoutBtn = $("#logoutBtn");
  const resetBtn = $("#resetBtn");

  const addHotelBtn = $("#addHotelBtn");
  const addHotelModal = $("#addHotelModal");
  const addHotelForm = $("#addHotelForm");
  const cancelAddHotelBtn = $("#cancelAddHotelBtn");
  const newHotelName = $("#newHotelName");
  const newHotelArea = $("#newHotelArea");
  const newHotelPrice = $("#newHotelPrice");
  const newHotelOrigPrice = $("#newHotelOrigPrice");
  const newHotelDesc = $("#newHotelDesc");

  const statTotalBookings = $("#statTotalBookings");
  const statCheckedIn = $("#statCheckedIn");
  const statTotalQuota = $("#statTotalQuota");

  const bookingsTab = $("#bookingsTab");
  const quotasTab = $("#quotasTab");
  const reportsTab = $("#reportsTab");
  const bookingsTableBody = $("#bookingsTableBody");
  const quotasTableBody = $("#quotasTableBody");

  const hotelFilter = $("#hotelFilter");
  const searchFilter = $("#searchFilter");
  const dateFilter = $("#dateFilter");

  const reportsTabBtn = $("#reportsTabBtn");
  const monthlyReportBody = $("#monthlyReportBody");
  const busyDaysChart = $("#busyDaysChart");
  const busyHoursChart = $("#busyHoursChart");

  const recapBar = $("#recapBar");
  const recapDateVal = $("#recapDateVal");
  const recapCheckedInVal = $("#recapCheckedInVal");
  const recapConfirmedVal = $("#recapConfirmedVal");
  const recapCancelledVal = $("#recapCancelledVal");
  const recapRevenueVal = $("#recapRevenueVal");

  // Account database configuration
  const accounts = {
    admin: { password: "lifehospitality", hotelId: "all", hotelName: "Master Admin" },
    favor: { password: "favorlife", hotelId: "favor-hotel", hotelName: "Favor Hotel" },
    tree: { password: "treelife", hotelId: "tree-hotel", hotelName: "Tree Hotel" },
    soekarno: { password: "soekarnolife", hotelId: "life-soekarno-hatta", hotelName: "Life Soekarno Hatta" },
    mystudio: { password: "mystudiolife", hotelId: "my-studio-hotel", hotelName: "My Studio Hotel" },
    empress: { password: "empresslife", hotelId: "empress-hotel", hotelName: "Empress Hotel" },
    grandcitra: { password: "grandcitralife", hotelId: "grand-citra-hotel", hotelName: "Grand Citra Hotel" },
    sutomo: { password: "sutomolife", hotelId: "sutomo-hotel", hotelName: "Sutomo Hotel" },
    raising: { password: "raisinglife", hotelId: "raising-hotel", hotelName: "Raising Hotel" },
    max: { password: "maxlife", hotelId: "max-hotel", hotelName: "Max Hotel" },
    jlstar: { password: "jlstarlife", hotelId: "jl-star", hotelName: "JL Star" },
    theone: { password: "theonelife", hotelId: "the-one-hotel", hotelName: "The One Hotel" },
    prima: { password: "primalife", hotelId: "hotel-prima", hotelName: "Hotel Prima" },
    denpasar: { password: "denpasarlife", hotelId: "hotel-denpasar", hotelName: "Hotel Denpasar" },
    dholiday: { password: "dholidaylife", hotelId: "hotel-d-holiday", hotelName: "Hotel D Holiday" }
  };

  // ---------- Sync quotas cache dengan room types (jalankan tiap login) ----------
  function syncQuotasWithRoomTypes() {
    const hotelsList = getHotels();
    const quotas = JSON.parse(localStorage.getItem("life_hospitality_quotas") || "{}");
    let changed = false;

    hotelsList.forEach((h) => {
      if (h.roomTypes && h.roomTypes.length > 0) {
        // Hitung total kuota dari room types
        const totalFromRoomTypes = h.roomTypes.reduce((sum, rt) => sum + parseInt(rt.quota || 0, 10), 0);
        // Update cache jika berbeda (room types adalah sumber kebenaran utama)
        if (quotas[h.id] !== totalFromRoomTypes) {
          quotas[h.id] = totalFromRoomTypes;
          changed = true;
        }
      }
    });

    if (changed) {
      localStorage.setItem("life_hospitality_quotas", JSON.stringify(quotas));
    }
  }

  // ---------- Auth Handling ----------
  function checkSession() {
    const session = sessionStorage.getItem("life_hospitality_session");
    if (session) {
      currentUser = JSON.parse(session);
      showDashboard();
    } else {
      showLoginForm();
    }
  }

  function showLoginForm() {
    loginOverlay.style.display = "flex";
    dashContainer.style.display = "none";
  }

  function showDashboard() {
    loginOverlay.style.display = "none";
    dashContainer.style.display = "block";

    // Update Header
    activeHotelLabel.textContent = currentUser.hotelName;

    // Show/hide reports tab button & add hotel button based on master admin privileges
    if (currentUser.hotelId === "all") {
      reportsTabBtn.style.display = "flex";
      if (addHotelBtn) addHotelBtn.style.display = "flex";
    } else {
      reportsTabBtn.style.display = "none";
      if (addHotelBtn) addHotelBtn.style.display = "none";
      // If a non-admin was somehow on reports, reset active tab to bookings
      if (document.querySelector(".dash-tab.active").dataset.tab === "reportsTab") {
        document.querySelectorAll(".dash-tab").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".dash-panel").forEach((p) => p.classList.remove("active"));
        document.querySelector("[data-tab='bookingsTab']").classList.add("active");
        bookingsTab.classList.add("active");
      }
    }

    // Sinkronkan quotas localStorage dengan total room types dari config terbaru
    syncQuotasWithRoomTypes();

    // Load filter options
    initFilters();

    // Render components
    renderStats();
    renderBookings();
    renderQuotas();
    if (currentUser.hotelId === "all") {
      renderReports();
    }
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const user = usernameInput.value.trim().toLowerCase();
    const pass = passwordInput.value;

    const acc = accounts[user];
    if (acc && acc.password === pass) {
      loginError.hidden = true;
      currentUser = {
        username: user,
        hotelId: acc.hotelId,
        hotelName: acc.hotelName
      };
      sessionStorage.setItem("life_hospitality_session", JSON.stringify(currentUser));
      showDashboard();
      usernameInput.value = "";
      passwordInput.value = "";
    } else {
      loginError.hidden = false;
    }
  });

  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("life_hospitality_session");
    currentUser = null;
    showLoginForm();
  });

  resetBtn.addEventListener("click", () => {
    const warningText = "⚠️ PERINGATAN:\n" +
      "Fitur ini akan MENGHAPUS data transaksi log booking dan laporan analitik saja. Data konfigurasi hotel, harga, tipe kamar, dan kapasitas kuota kamar akan tetap aman dan tidak akan terhapus.\n\n" +
      "Apakah Anda yakin ingin melanjutkan?";

    if (confirm(warningText)) {
      const inputPass = prompt("Masukkan Password Login Anda untuk mengonfirmasi riset data:");
      
      if (inputPass === null) {
        return; // User canceled the prompt
      }

      const correctPass = accounts[currentUser.username]?.password;
      if (inputPass === correctPass) {
        localStorage.removeItem("life_hospitality_bookings");
        alert("Data transaksi log booking dan laporan analitik berhasil diriset!");
        location.reload();
      } else {
        alert("❌ Password salah! Riset data dibatalkan.");
      }
    }
  });

  // ---------- Navigation Tabs ----------
  document.querySelectorAll(".dash-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".dash-tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".dash-panel").forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const targetPanel = btn.dataset.tab;
      $(`#${targetPanel}`).classList.add("active");

      if (targetPanel === "reportsTab") {
        renderReports();
      }
    });
  });

  // ---------- Initialize Filters ----------
  function initFilters() {
    // Clear select
    hotelFilter.innerHTML = "";

    if (currentUser.hotelId === "all") {
      // Admin sees all hotels
      hotelFilter.disabled = false;
      const optAll = document.createElement("option");
      optAll.value = "all";
      optAll.textContent = "Semua Hotel";
      hotelFilter.appendChild(optAll);

      getHotels().forEach((h) => {
        const opt = document.createElement("option");
        opt.value = h.id;
        opt.textContent = h.name;
        hotelFilter.appendChild(opt);
      });
    } else {
      // Hotel Staff locked to their own hotel
      hotelFilter.disabled = true;
      const opt = document.createElement("option");
      opt.value = currentUser.hotelId;
      opt.textContent = currentUser.hotelName;
      hotelFilter.appendChild(opt);
    }
  }

  // ---------- Stats Calculations ----------
  function renderStats() {
    const bookings = JSON.parse(localStorage.getItem("life_hospitality_bookings") || "[]");
    const quotas = JSON.parse(localStorage.getItem("life_hospitality_quotas") || "{}");

    // Filter bookings context
    const viewableBookings = currentUser.hotelId === "all" 
      ? bookings 
      : bookings.filter((b) => b.hotelId === currentUser.hotelId);

    // Calculate metrics
    const totalBookingsCount = viewableBookings.length;
    const checkedInCount = viewableBookings.filter((b) => b.status === "Checked-in").length;

    // Calculate active quota dynamically for today
    let totalQuotaCount = 0;
    const statQuotaSub = $("#statQuotaSub");

    if (currentUser.hotelId === "all") {
      const hotelsList = getHotels();
      hotelsList.forEach((h) => {
        totalQuotaCount += getAvailableHotelQuotaToday(h.id);
      });
      // Show total hotel count as context
      if (statQuotaSub) {
        statQuotaSub.textContent = `gabungan ${hotelsList.length} hotel`;
      }
    } else {
      totalQuotaCount = getAvailableHotelQuotaToday(currentUser.hotelId);
      if (statQuotaSub) {
        statQuotaSub.textContent = currentUser.hotelName;
      }
    }

    statTotalBookings.textContent = totalBookingsCount;
    statCheckedIn.textContent = checkedInCount;
    statTotalQuota.textContent = totalQuotaCount;
  }

  // ---------- Tab 1: Bookings Log ----------
  function renderBookings() {
    const bookings = JSON.parse(localStorage.getItem("life_hospitality_bookings") || "[]");
    const selectedHotel = hotelFilter.value;
    const searchVal = searchFilter.value.toLowerCase().trim();
    const selectedDate = dateFilter.value;

    // Filter bookings list
    const filtered = bookings.filter((b) => {
      // 1. Hotel filter
      if (currentUser.hotelId !== "all" && b.hotelId !== currentUser.hotelId) return false;
      if (currentUser.hotelId === "all" && selectedHotel !== "all" && b.hotelId !== selectedHotel) return false;

      // 2. Search box
      if (searchVal) {
        const matchCode = b.bookingCode.toLowerCase().includes(searchVal);
        const matchName = b.guestName.toLowerCase().includes(searchVal);
        return matchCode || matchName;
      }

      // 3. Date filter (Riwayat / 24 Jam)
      if (selectedDate && b.checkin !== selectedDate) return false;

      return true;
    });

    // Render daily recap bar if date is selected
    if (selectedDate) {
      recapBar.style.display = "flex";
      recapDateVal.textContent = formatDateID(selectedDate);

      const checkedInCount = filtered.filter((b) => b.status === "Checked-in").length;
      const confirmedCount = filtered.filter((b) => b.status === "Confirmed").length;
      const cancelledCount = filtered.filter((b) => b.status === "Cancelled").length;
      const totalRevenue = filtered
        .filter((b) => b.status !== "Cancelled")
        .reduce((sum, b) => sum + b.totalPrice, 0);

      recapCheckedInVal.textContent = checkedInCount;
      recapConfirmedVal.textContent = confirmedCount;
      recapCancelledVal.textContent = cancelledCount;
      recapRevenueVal.textContent = formatRupiah(totalRevenue);
    } else {
      recapBar.style.display = "none";
    }

    if (filtered.length === 0) {
      bookingsTableBody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--dash-text-muted);">Tidak ada data booking ditemukan.</td></tr>`;
      return;
    }

    bookingsTableBody.innerHTML = filtered
      .map((b) => {
        let statusBadge = `<span class="badge badge--confirmed">Confirmed</span>`;
        if (b.status === "Checked-in") {
          statusBadge = `<span class="badge badge--checkedin">Checked-in</span>`;
        } else if (b.status === "Cancelled") {
          statusBadge = `<span class="badge badge--cancelled">Cancelled</span>`;
        }

        // Actions
        const showActions = b.status === "Confirmed";
        const actionHTML = showActions 
          ? `<button class="action-btn action-btn--success" data-action="checkin" data-code="${b.bookingCode}">Check In</button>
             <button class="action-btn action-btn--danger" data-action="cancel" data-code="${b.bookingCode}">Batal</button>`
          : `<span style="color: var(--dash-text-muted); font-size: 12px; font-weight: 500;">Selesai</span>`;

        return `
          <tr>
            <td><strong>${b.bookingCode}</strong></td>
            <td>${b.guestName}</td>
            <td>
              <div>${b.phone}</div>
              <div style="font-size: 11px; color: var(--dash-text-muted);">${b.email}</div>
            </td>
            <td>${b.hotelName}</td>
            <td>${b.roomType}</td>
            <td style="text-align: center;">
              <span style="font-weight: 700; color: var(--dash-gold); font-size: 15px;">${b.rooms || 1}</span>
              <div style="font-size: 11px; color: var(--dash-text-muted);">kamar</div>
            </td>
            <td>
              <div>${formatDateID(b.checkin)}</div>
              <div style="font-size: 11px; color: var(--dash-text-muted);">${b.nights} malam</div>
            </td>
            <td><strong>${formatRupiah(b.totalPrice)}</strong></td>
            <td style="text-transform: uppercase;">${b.paymentMethod === 'qris' ? 'QRIS' : 'Hotel'}</td>
            <td>${statusBadge}</td>
            <td>${actionHTML}</td>
          </tr>
        `;
      })
      .join("");
  }

  // Handle action buttons click inside Table
  bookingsTableBody.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const code = btn.dataset.code;

    const bookings = JSON.parse(localStorage.getItem("life_hospitality_bookings") || "[]");
    const targetIdx = bookings.findIndex((b) => b.bookingCode === code);

    if (targetIdx !== -1) {
      if (action === "checkin") {
        bookings[targetIdx].status = "Checked-in";
        bookings[targetIdx].checkinTimestamp = Date.now(); // Record real check-in timestamp
      } else if (action === "cancel") {
        bookings[targetIdx].status = "Cancelled";
      }

      localStorage.setItem("life_hospitality_bookings", JSON.stringify(bookings));
      renderStats();
      renderBookings();
    }
  });

  // Filters event listeners (booking log)
  hotelFilter.addEventListener("change", renderBookings);
  searchFilter.addEventListener("input", renderBookings);
  dateFilter.addEventListener("change", renderBookings);

  // ---------- Quota date filter (Tab 2) ----------
  document.addEventListener("DOMContentLoaded", () => {
    const quotaDateInput = $("#quotaDateFilter");
    if (quotaDateInput) {
      quotaDateInput.value = todayISO(); // default hari ini
    }
  });

  // Gunakan event delegation karena elemen bisa muncul setelah render
  document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "quotaDateFilter") {
      renderQuotas();
    }
  });

  document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "quotaDateToday") {
      const quotaDateInput = $("#quotaDateFilter");
      if (quotaDateInput) {
        quotaDateInput.value = todayISO();
        renderQuotas();
      }
    }
  });

  // ---------- Tab 2: Database & Configuration ----------
  function saveHotelRoomTypes(hotelId, roomTypes) {
    const overrides = JSON.parse(localStorage.getItem("life_hospitality_hotels_overrides") || "{}");
    if (!overrides[hotelId]) {
      overrides[hotelId] = {};
    }
    
    // Calculate total quota as sum of room type quotas
    const totalQuota = roomTypes.reduce((sum, rt) => sum + parseInt(rt.quota || 0, 10), 0);
    
    // Find min price of room types to set as hotel price
    const minPrice = roomTypes.reduce((min, rt) => {
      const p = parseInt(rt.price, 10);
      return p < min ? p : min;
    }, Infinity);

    overrides[hotelId].roomTypes = roomTypes;
    if (minPrice !== Infinity) {
      overrides[hotelId].price = minPrice;
      const minRt = roomTypes.find(rt => parseInt(rt.price, 10) === minPrice);
      if (minRt) {
        overrides[hotelId].originalPrice = minRt.originalPrice;
      }
    }
    
    localStorage.setItem("life_hospitality_hotels_overrides", JSON.stringify(overrides));
    
    // Save to quotas
    const quotas = JSON.parse(localStorage.getItem("life_hospitality_quotas") || "{}");
    quotas[hotelId] = totalQuota;
    localStorage.setItem("life_hospitality_quotas", JSON.stringify(quotas));
  }

  function renderRoomTypesRows(hotelId) {
    const hotel = getHotels().find(x => x.id === hotelId);
    const container = $(`#room-types-container-${hotelId}`);
    if (!container || !hotel || !hotel.roomTypes) return;

    container.innerHTML = hotel.roomTypes.map((rt, index) => {
      return `
        <div class="room-card" data-index="${index}">
          <!-- Top row: Image and Name -->
          <div style="display: flex; gap: 12px; align-items: center;">
            <img src="${rt.image}" class="room-img-preview" alt="Room preview">
            <div style="flex: 1;">
              <label style="font-size: 9px; color: var(--dash-text-muted); display: block; margin-bottom: 2px; text-transform: uppercase;">Nama Tipe Kamar</label>
              <input type="text" class="edit-input room-name-input" value="${rt.name}">
            </div>
          </div>
          
          <!-- Pricing & Quota row -->
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
            <div>
              <label style="font-size: 9px; color: var(--dash-text-muted); display: block; margin-bottom: 2px; text-transform: uppercase;">Harga Jual</label>
              <input type="number" class="edit-input room-price-input" value="${rt.price}">
            </div>
            <div>
              <label style="font-size: 9px; color: var(--dash-text-muted); display: block; margin-bottom: 2px; text-transform: uppercase;">Harga Coret</label>
              <input type="number" class="edit-input room-orig-input" value="${rt.originalPrice || Math.round(rt.price * 1.15)}">
            </div>
            <div>
              <label style="font-size: 9px; color: var(--dash-text-muted); display: block; margin-bottom: 2px; text-transform: uppercase;">Kuota</label>
              <input type="number" class="edit-input room-quota-input" value="${rt.quota}">
            </div>
          </div>

          <!-- Description row -->
          <div>
            <label style="font-size: 9px; color: var(--dash-text-muted); display: block; margin-bottom: 2px; text-transform: uppercase;">Deskripsi</label>
            <input type="text" class="edit-input room-desc-input" value="${rt.desc || ''}">
          </div>

          <!-- Image Path row -->
          <div>
            <label style="font-size: 9px; color: var(--dash-text-muted); display: block; margin-bottom: 2px; text-transform: uppercase;">Path Gambar</label>
            <input type="text" class="edit-input room-image-input" value="${rt.image}">
          </div>

          <!-- Actions -->
          <div style="display: flex; justify-content: flex-end; margin-top: auto; padding-top: 8px; border-top: 1px dashed rgba(255, 255, 255, 0.06);">
            <button class="action-btn action-btn--danger delete-room-btn" data-hotel-id="${hotelId}" data-index="${index}" style="padding: 4px 10px; font-size: 11px; margin: 0;">Hapus</button>
          </div>
        </div>
      `;
    }).join("");
  }

  function handleSaveRoomTypes(hotelId) {
    const container = $(`#room-types-container-${hotelId}`);
    if (!container) return;

    const cards = container.querySelectorAll(".room-card");
    const roomTypes = [];

    for (const card of cards) {
      const name = card.querySelector(".room-name-input").value.trim();
      const price = parseInt(card.querySelector(".room-price-input").value, 10);
      const originalPrice = parseInt(card.querySelector(".room-orig-input").value, 10);
      const quota = parseInt(card.querySelector(".room-quota-input").value, 10);
      const desc = card.querySelector(".room-desc-input").value.trim();
      const image = card.querySelector(".room-image-input").value.trim();

      if (!name || isNaN(price) || price < 0 || isNaN(quota) || quota < 0) {
        alert("Nama, harga, dan kuota kamar harus diisi dengan benar!");
        return;
      }

      roomTypes.push({
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name,
        price,
        originalPrice: isNaN(originalPrice) ? Math.round(price * 1.15) : originalPrice,
        quota,
        desc,
        image: image || "img/empress-room1.jpg"
      });
    }

    saveHotelRoomTypes(hotelId, roomTypes);
    
    // Flash visual feedback
    const panel = container.closest(".room-panel-content");
    if (panel) {
      panel.style.background = "rgba(16, 185, 129, 0.1)";
      setTimeout(() => {
        panel.style.background = "";
      }, 500);
    }

    renderStats();
    renderQuotas();
  }

  function handleAddRoomType(hotelId) {
    const nameInput = $(`#new-room-name-${hotelId}`);
    const priceInput = $(`#new-room-price-${hotelId}`);
    const origInput = $(`#new-room-orig-${hotelId}`);
    const imageInput = $(`#new-room-image-${hotelId}`);
    const quotaInput = $(`#new-room-quota-${hotelId}`);
    const descInput = $(`#new-room-desc-${hotelId}`);

    const name = nameInput.value.trim();
    const price = parseInt(priceInput.value, 10);
    const originalPrice = parseInt(origInput.value, 10);
    const quota = parseInt(quotaInput.value, 10);
    const image = imageInput.value.trim();
    const desc = descInput.value.trim();

    if (!name || isNaN(price) || price < 0 || isNaN(quota) || quota < 0) {
      alert("Harap isi nama, harga, dan kuota kamar!");
      return;
    }

    const hotel = getHotels().find(x => x.id === hotelId);
    const roomTypes = hotel.roomTypes ? [...hotel.roomTypes] : [];

    roomTypes.push({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name,
      price,
      originalPrice: isNaN(originalPrice) ? Math.round(price * 1.15) : originalPrice,
      quota,
      desc,
      image: image || (hotel.thumbs && hotel.thumbs[0] ? hotel.thumbs[0] : hotel.image)
    });

    saveHotelRoomTypes(hotelId, roomTypes);

    // Clear inputs
    nameInput.value = "";
    priceInput.value = "";
    origInput.value = "";
    imageInput.value = "";
    quotaInput.value = "";
    descInput.value = "";

    renderQuotas();
    
    // Re-open/keep open the panel!
    const panel = $(`#room-panel-${hotelId}`);
    if (panel) {
      panel.style.display = "table-row";
      renderRoomTypesRows(hotelId);
    }
  }

  function handleDeleteRoomType(hotelId, index) {
    if (!confirm("Apakah Anda yakin ingin menghapus tipe kamar ini?")) return;

    const hotel = getHotels().find(x => x.id === hotelId);
    if (!hotel || !hotel.roomTypes) return;

    const roomTypes = [...hotel.roomTypes];
    roomTypes.splice(index, 1);

    saveHotelRoomTypes(hotelId, roomTypes);
    renderQuotas();

    const panel = $(`#room-panel-${hotelId}`);
    if (panel) {
      panel.style.display = "table-row";
      renderRoomTypesRows(hotelId);
    }
  }

  function toggleRoomTypesPanel(hotelId) {
    const panel = $(`#room-panel-${hotelId}`);
    if (!panel) return;

    const isHidden = panel.style.display === "none";
    
    // Close all other room panels to keep it neat
    document.querySelectorAll(".room-panel-row").forEach(p => {
      p.style.display = "none";
    });

    if (isHidden) {
      panel.style.display = "table-row";
      renderRoomTypesRows(hotelId);
    } else {
      panel.style.display = "none";
    }
  }

  function renderQuotas() {
    const quotas = JSON.parse(localStorage.getItem("life_hospitality_quotas") || "{}");
    const hotelsList = getHotels();

    const viewableHotels = currentUser.hotelId === "all"
      ? hotelsList
      : hotelsList.filter((h) => h.id === currentUser.hotelId);

    const isAdmin = currentUser.hotelId === "all";

    // Baca tanggal dari date picker (default: hari ini)
    const quotaDateInput = $("#quotaDateFilter");
    if (quotaDateInput && !quotaDateInput.value) {
      quotaDateInput.value = todayISO();
    }
    const selectedDate = (quotaDateInput && quotaDateInput.value) ? quotaDateInput.value : todayISO();
    const isToday = selectedDate === todayISO();

    // Update label kolom header
    const quotaColHeader = $("#quotaColHeader");
    if (quotaColHeader) {
      quotaColHeader.textContent = isToday ? "Sisa Kuota Hari Ini" : `Sisa Kuota — ${formatDateID(selectedDate)}`;
    }

    // Hitung total semua hotel untuk tanggal terpilih
    let grandTotal = 0;

    quotasTableBody.innerHTML = viewableHotels
      .map((h) => {
        // Hitung total kuota base dari room types (sumber kebenaran utama)
        const baseQuotaTotal = h.roomTypes
          ? h.roomTypes.reduce((sum, rt) => sum + parseInt(rt.quota || 0, 10), 0)
          : (quotas[h.id] !== undefined ? parseInt(quotas[h.id], 10) : 0);

        // Kuota tersedia pada tanggal terpilih
        const currentQOnDate = getAvailableHotelQuotaToday(h.id, selectedDate);
        const bookedOnDate = baseQuotaTotal - currentQOnDate;
        grandTotal += currentQOnDate;

        const statusText = currentQOnDate <= 0 
          ? `<span class="badge badge--cancelled">Sold Out</span>` 
          : `<span class="badge badge--checkedin">Aktif (${currentQOnDate} Kamar)</span>`;

        const nameCell = isAdmin
          ? `<input type="text" class="edit-input" id="edit-name-${h.id}" value="${h.name}" style="width: 120px;">`
          : `<strong>${h.name}</strong>`;

        const areaCell = isAdmin
          ? `<input type="text" class="edit-input" id="edit-area-${h.id}" value="${h.area}" style="width: 110px;">`
          : `${h.area}`;

        const priceCell = isAdmin
          ? `<div style="display: flex; flex-direction: column; gap: 6px;">
               <div style="display: flex; align-items: center; gap: 4px;">
                 <span style="font-size: 10px; color: var(--dash-text-muted); width: 66px;">Harga Jual:</span>
                 <input type="number" class="edit-input" id="edit-price-${h.id}" value="${h.price}" style="width: 76px; padding: 4px 6px;">
               </div>
               <div style="display: flex; align-items: center; gap: 4px;">
                 <span style="font-size: 10px; color: var(--dash-text-muted); width: 66px;">Harga Coret:</span>
                 <input type="number" class="edit-input" id="edit-orig-${h.id}" value="${h.originalPrice !== undefined ? h.originalPrice : Math.round(h.price * 1.15)}" style="width: 76px; padding: 4px 6px;">
               </div>
             </div>`
          : `<div>${formatRupiah(h.price)}</div>
             <div style="font-size: 11px; color: var(--dash-text-muted); text-decoration: line-through;">${formatRupiah(h.originalPrice !== undefined ? h.originalPrice : h.price * 1.15)}</div>`;

        const currentDest = h.destination || "none";
        
        function getDestLabel(val) {
          switch(val) {
            case "losari": return "Pantai Losari";
            case "mall": return "Pusat Belanja";
            case "kuliner": return "Pusat Kuliner & Cafe";
            case "losari-kuliner": return "Losari & Kuliner";
            case "losari-mall": return "Losari & Belanja";
            case "mall-kuliner": return "Belanja & Kuliner";
            case "all": return "Semua Destinasi";
            default: return "Tidak Ada / Lainnya";
          }
        }

        const destCell = isAdmin
          ? `<select class="edit-input" id="edit-dest-${h.id}" style="width: 115px; background: rgba(255, 255, 255, 0.03); color: var(--dash-text);">
               <option value="none" ${currentDest === 'none' ? 'selected' : ''}>Tidak Ada / Lainnya</option>
               <option value="losari" ${currentDest === 'losari' ? 'selected' : ''}>Dekat Pantai Losari</option>
               <option value="mall" ${currentDest === 'mall' ? 'selected' : ''}>Dekat Pusat Belanja</option>
               <option value="kuliner" ${currentDest === 'kuliner' ? 'selected' : ''}>Dekat Pusat Kuliner</option>
               <option value="losari-kuliner" ${currentDest === 'losari-kuliner' ? 'selected' : ''}>Dekat Losari & Kuliner</option>
               <option value="losari-mall" ${currentDest === 'losari-mall' ? 'selected' : ''}>Dekat Losari & Belanja</option>
               <option value="mall-kuliner" ${currentDest === 'mall-kuliner' ? 'selected' : ''}>Dekat Belanja & Kuliner</option>
               <option value="all" ${currentDest === 'all' ? 'selected' : ''}>Semua Destinasi</option>
             </select>`
          : `<strong>${getDestLabel(currentDest)}</strong>`;

        const roomsButton = isAdmin
          ? `<button class="action-btn action-btn--gold toggle-rooms-btn" data-toggle-rooms="${h.id}" style="font-size: 11px; padding: 6px 10px;">⚙️ Tipe Kamar</button>`
          : "";

        return `
          <tr>
            <td>${nameCell}</td>
            <td>${areaCell}</td>
            <td>${priceCell}</td>
            <td>${destCell}</td>
            <td>${statusText}</td>
            <td>
              ${isAdmin
                ? `<div style="display: flex; flex-direction: column; gap: 3px;">
                    <div style="display: flex; align-items: baseline; gap: 5px;">
                      <span style="font-size: 18px; font-weight: 800; color: ${currentQOnDate <= 0 ? '#ef4444' : 'var(--dash-gold)'}">${currentQOnDate}</span>
                      <span style="font-size: 12px; color: var(--dash-text-muted);">/ ${baseQuotaTotal} kamar</span>
                    </div>
                    <div style="font-size: 10px; color: var(--dash-text-muted);">${bookedOnDate > 0 ? `<span style="color:#f59e0b;">${bookedOnDate} terpakai</span>` : 'Semua tersedia'}</div>
                  </div>`
                : `<div class="quota-input-wrapper">
                    <input type="number" class="quota-input" id="quota-${h.id}" value="${baseQuotaTotal}" min="0" max="999">
                    <span style="font-size: 12px; color: var(--dash-text-muted);">kamar</span>
                  </div>`
              }
            </td>
            <td>
              <div style="display: flex; gap: 6px; align-items: center;">
                ${roomsButton}
              </div>
            </td>
          </tr>
          ${isAdmin ? `
          <tr id="room-panel-${h.id}" class="room-panel-row" style="display: none;">
            <td colspan="7" class="room-panel-cell">
              <div class="room-panel-content">
                <div class="room-panel-title">
                  <span>⚙️ Kelola Tipe Kamar — ${h.name}</span>
                  <button class="action-btn action-btn--success save-rooms-btn" data-hotel-id="${h.id}" style="font-size: 12px; padding: 6px 12px;">Simpan Semua Kamar</button>
                </div>
                <div class="room-cards-grid" id="room-types-container-${h.id}">
                  <!-- Dinamis -->
                </div>
                <div class="add-room-form">
                  <h4 style="margin: 0 0 12px; font-size: 12px; color: var(--dash-gold);">➕ Tambah Tipe Kamar Baru</h4>
                  <div class="form-grid-3">
                    <div>
                      <label style="font-size: 10px; color: var(--dash-text-muted); display: block; margin-bottom: 4px;">Nama Tipe Kamar</label>
                      <input type="text" class="edit-input" id="new-room-name-${h.id}" placeholder="Contoh: Thematic Room" style="width: 100%;">
                    </div>
                    <div>
                      <label style="font-size: 10px; color: var(--dash-text-muted); display: block; margin-bottom: 4px;">Harga Jual (Rp)</label>
                      <input type="number" class="edit-input" id="new-room-price-${h.id}" placeholder="Contoh: 280000" style="width: 100%;">
                    </div>
                    <div>
                      <label style="font-size: 10px; color: var(--dash-text-muted); display: block; margin-bottom: 4px;">Harga Coret (Rp)</label>
                      <input type="number" class="edit-input" id="new-room-orig-${h.id}" placeholder="Contoh: 320000" style="width: 100%;">
                    </div>
                  </div>
                  <div class="form-grid-3" style="margin-top: 12px;">
                    <div>
                      <label style="font-size: 10px; color: var(--dash-text-muted); display: block; margin-bottom: 4px;">Path/URL Gambar</label>
                      <input type="text" class="edit-input" id="new-room-image-${h.id}" placeholder="Contoh: img/favor-thematic.jpg" style="width: 100%;">
                    </div>
                    <div>
                      <label style="font-size: 10px; color: var(--dash-text-muted); display: block; margin-bottom: 4px;">Kuota Kamar</label>
                      <input type="number" class="edit-input" id="new-room-quota-${h.id}" placeholder="Contoh: 5" style="width: 100%;">
                    </div>
                    <div style="display: flex; align-items: flex-end;">
                      <button class="action-btn action-btn--success add-room-btn" data-hotel-id="${h.id}" style="width: 100%; padding: 8px 0; border: none; font-weight: bold; border-radius: 6px; font-size: 12px;">Tambah Kamar</button>
                    </div>
                  </div>
                  <div class="form-grid-2" style="margin-top: 12px; grid-template-columns: 1fr;">
                    <div>
                      <label style="font-size: 10px; color: var(--dash-text-muted); display: block; margin-bottom: 4px;">Deskripsi Singkat</label>
                      <input type="text" class="edit-input" id="new-room-desc-${h.id}" placeholder="Kamar dengan tema unik, jacuzzi pribadi..." style="width: 100%;">
                    </div>
                  </div>
                </div>
              </div>
            </td>
          </tr>` : ""}
        `;
      })
      .join("");

    // Update grand total di date bar
    const quotaDateTotal = $("#quotaDateTotal");
    if (quotaDateTotal) quotaDateTotal.textContent = grandTotal;

    // Update label tanggal di bar
    const quotaDateLabelEl = $("#quotaDateLabel");
    if (quotaDateLabelEl) {
      quotaDateLabelEl.textContent = isToday ? "(hari ini)" : `(${formatDateID(selectedDate)})`;
    }
  }

  // Handle room management clicks (toggle, save, add, delete room types)
  quotasTableBody.addEventListener("click", (e) => {
    // 1. Toggle rooms panel
    const toggleBtn = e.target.closest("[data-toggle-rooms]");
    if (toggleBtn) {
      const hotelId = toggleBtn.dataset.toggleRooms;
      toggleRoomTypesPanel(hotelId);
      return;
    }

    // 2. Save room types
    const saveRoomsBtn = e.target.closest(".save-rooms-btn");
    if (saveRoomsBtn) {
      const hotelId = saveRoomsBtn.dataset.hotelId;
      handleSaveRoomTypes(hotelId);
      return;
    }

    // 3. Add room type
    const addRoomBtn = e.target.closest(".add-room-btn");
    if (addRoomBtn) {
      const hotelId = addRoomBtn.dataset.hotelId;
      handleAddRoomType(hotelId);
      return;
    }

    // 4. Delete room type
    const deleteRoomBtn = e.target.closest(".delete-room-btn");
    if (deleteRoomBtn) {
      const hotelId = deleteRoomBtn.dataset.hotelId;
      const index = parseInt(deleteRoomBtn.dataset.index, 10);
      handleDeleteRoomType(hotelId, index);
      return;
    }
  });

  // Global bulk save for all hotels
  const saveAllHotelsBtn = $("#saveAllHotelsBtn");
  if (saveAllHotelsBtn) {
    saveAllHotelsBtn.addEventListener("click", () => {
      const overrides = JSON.parse(localStorage.getItem("life_hospitality_hotels_overrides") || "{}");
      const quotas = JSON.parse(localStorage.getItem("life_hospitality_quotas") || "{}");
      const hotelsList = getHotels();
      
      const viewableHotels = currentUser.hotelId === "all"
        ? hotelsList
        : hotelsList.filter((h) => h.id === currentUser.hotelId);

      const isAdmin = currentUser.hotelId === "all";
      let hasError = false;

      for (const h of viewableHotels) {
        if (isAdmin) {
          const nameInput = $(`#edit-name-${h.id}`);
          const areaInput = $(`#edit-area-${h.id}`);
          const priceInput = $(`#edit-price-${h.id}`);
          const origInput = $(`#edit-orig-${h.id}`);
          const destInput = $(`#edit-dest-${h.id}`);

          if (nameInput && areaInput && priceInput && origInput && destInput) {
            const newName = nameInput.value.trim();
            const newArea = areaInput.value.trim();
            const newPrice = parseInt(priceInput.value, 10);
            const newOrigPrice = parseInt(origInput.value, 10);
            const newDest = destInput.value;

            if (!newName || !newArea || isNaN(newPrice) || newPrice < 0 || isNaN(newOrigPrice) || newOrigPrice < 0) {
              alert(`Harap masukkan nama, wilayah, dan harga yang valid untuk hotel: ${h.name || newName}!`);
              hasError = true;
              break;
            }

            if (!overrides[h.id]) overrides[h.id] = {};
            overrides[h.id].name = newName;
            overrides[h.id].area = newArea;
            overrides[h.id].price = newPrice;
            overrides[h.id].originalPrice = newOrigPrice;
            overrides[h.id].destination = newDest;
          }
        } else {
          // Staff saves their specific quota input
          const quotaInput = $(`#quota-${h.id}`);
          if (quotaInput) {
            const inputVal = parseInt(quotaInput.value, 10);
            if (isNaN(inputVal) || inputVal < 0) {
              alert("Masukkan nilai kuota yang valid (angka >= 0)!");
              hasError = true;
              break;
            }
            quotas[h.id] = inputVal;
          }
        }
      }

      if (hasError) return;

      // Save transactions
      localStorage.setItem("life_hospitality_hotels_overrides", JSON.stringify(overrides));
      localStorage.setItem("life_hospitality_quotas", JSON.stringify(quotas));

      // Flash border highlight for visual success feedback on all rows
      const rows = document.querySelectorAll("#quotasTableBody tr");
      rows.forEach((row) => {
        if (!row.classList.contains("room-panel-row")) {
          row.style.background = "rgba(16, 185, 129, 0.15)";
          setTimeout(() => {
            row.style.background = "";
          }, 600);
        }
      });

      alert("✓ Semua perubahan data hotel berhasil disimpan!");
      renderStats();
      renderQuotas();
      renderBookings(); // In case status displays update
    });
  }

  function renderReports() {
    const bookings = JSON.parse(localStorage.getItem("life_hospitality_bookings") || "[]");
    const checkedInBookings = bookings.filter((b) => b.status === "Checked-in" && b.checkinTimestamp);

    // 1. Monthly Revenue Report
    const monthlyData = {};
    bookings.forEach((b) => {
      if (b.status === "Cancelled") return;
      const dateParts = b.checkin.split("-");
      const yearMonth = `${dateParts[0]}-${dateParts[1]}`;
      
      if (!monthlyData[yearMonth]) {
        monthlyData[yearMonth] = { count: 0, revenue: 0 };
      }
      monthlyData[yearMonth].count += 1;
      monthlyData[yearMonth].revenue += b.totalPrice;
    });

    const monthNames = {
      "01": "Januari", "02": "Februari", "03": "Maret", "04": "April",
      "05": "Mei", "06": "Juni", "07": "Juli", "08": "Agustus",
      "09": "September", "10": "Oktober", "11": "November", "12": "Desember"
    };

    const sortedMonths = Object.keys(monthlyData).sort().reverse();
    if (sortedMonths.length === 0) {
      monthlyReportBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--dash-text-muted);">Belum ada data bulanan.</td></tr>`;
    } else {
      monthlyReportBody.innerHTML = sortedMonths
        .map((ym) => {
          const parts = ym.split("-");
          const monthLabel = `${monthNames[parts[1]]} ${parts[0]}`;
          const data = monthlyData[ym];
          return `
            <tr>
              <td><strong>${monthLabel}</strong></td>
              <td>${data.count} bookings</td>
              <td><strong>${formatRupiah(data.revenue)}</strong></td>
            </tr>
          `;
        })
        .join("");
    }

    // 2. Busy Days Chart
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    
    checkedInBookings.forEach((b) => {
      const day = new Date(b.checkinTimestamp).getDay();
      dayCounts[day] += 1;
    });

    const maxDayCount = Math.max(...dayCounts, 1);

    busyDaysChart.innerHTML = dayCounts
      .map((count, dayIdx) => {
        const percentage = (count / maxDayCount) * 100;
        const dayName = dayNames[dayIdx];
        const isWeekend = dayIdx === 0 || dayIdx === 6;
        const barClass = isWeekend ? "chart-bar-fill" : "chart-bar-fill--blue";
        
        return `
          <div class="chart-bar-row">
            <span class="chart-bar-label">${dayName}</span>
            <div class="chart-bar-container">
              <div class="chart-bar-fill ${barClass}" style="width: ${percentage}%;"></div>
            </div>
            <span class="chart-bar-value">${count} check-in</span>
          </div>
        `;
      })
      .join("");

    // 3. Busy Hours Chart
    const hourIntervals = [
      { label: "Pagi (08:00 - 12:00)", count: 0, class: "chart-bar-fill--blue" },
      { label: "Siang (12:00 - 15:00)", count: 0, class: "chart-bar-fill" },
      { label: "Sore (15:00 - 18:00)", count: 0, class: "chart-bar-fill" },
      { label: "Malam (18:00 - 22:00)", count: 0, class: "chart-bar-fill--success" },
      { label: "Larut (22:00 - 08:00)", count: 0, class: "chart-bar-fill--blue" }
    ];

    checkedInBookings.forEach((b) => {
      const hr = new Date(b.checkinTimestamp).getHours();
      if (hr >= 8 && hr < 12) hourIntervals[0].count += 1;
      else if (hr >= 12 && hr < 15) hourIntervals[1].count += 1;
      else if (hr >= 15 && hr < 18) hourIntervals[2].count += 1;
      else if (hr >= 18 && hr < 22) hourIntervals[3].count += 1;
      else hourIntervals[4].count += 1;
    });

    const maxHourCount = Math.max(...hourIntervals.map((i) => i.count), 1);

    busyHoursChart.innerHTML = hourIntervals
      .map((item) => {
        const percentage = (item.count / maxHourCount) * 100;
        return `
          <div class="chart-bar-row">
            <span class="chart-bar-label" style="width: 140px;">${item.label}</span>
            <div class="chart-bar-container">
              <div class="chart-bar-fill ${item.class}" style="width: ${percentage}%;"></div>
            </div>
            <span class="chart-bar-value">${item.count} check-in</span>
          </div>
        `;
      })
      .join("");
  }

  // ---------- Export to Excel (CSV with BOM & Delimiter) ----------
  const exportBookingsBtn = $("#exportBookingsBtn");
  const exportMonthlyBtn = $("#exportMonthlyBtn");

  if (exportBookingsBtn) {
    exportBookingsBtn.addEventListener("click", () => {
      const bookings = JSON.parse(localStorage.getItem("life_hospitality_bookings") || "[]");
      const selectedHotel = hotelFilter.value;
      const searchVal = searchFilter.value.toLowerCase().trim();
      const selectedDate = dateFilter.value;

      const filtered = bookings.filter((b) => {
        if (currentUser.hotelId !== "all" && b.hotelId !== currentUser.hotelId) return false;
        if (currentUser.hotelId === "all" && selectedHotel !== "all" && b.hotelId !== selectedHotel) return false;

        if (searchVal) {
          const matchCode = b.bookingCode.toLowerCase().includes(searchVal);
          const matchName = b.guestName.toLowerCase().includes(searchVal);
          return matchCode || matchName;
        }

        if (selectedDate && b.checkin !== selectedDate) return false;

        return true;
      });

      if (filtered.length === 0) {
        alert("Tidak ada data booking untuk diexport!");
        return;
      }

      let csvContent = "\uFEFFsep=;\n";
      csvContent += "Kode Booking;Nama Tamu;Telepon;Email;Hotel;Tipe Kamar;Jumlah Kamar;Tanggal Check-In;Malam;Total Harga;Metode Pembayaran;Status\n";

      filtered.forEach((b) => {
        const row = [
          b.bookingCode,
          b.guestName,
          `="${b.phone}"`, // Excel formula to keep leading zero
          b.email,
          b.hotelName,
          b.roomType,
          b.rooms || 1,
          b.checkin,
          b.nights,
          b.totalPrice,
          b.paymentMethod === "qris" ? "QRIS" : "Bayar di Hotel",
          b.status
        ];
        const escapedRow = row.map(v => {
          if (typeof v === "string") {
            return `"${v.replace(/"/g, '""')}"`;
          }
          return v;
        }).join(";");
        csvContent += escapedRow + "\n";
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateLabel = selectedDate ? `-${selectedDate}` : "-semua";
      link.setAttribute("href", url);
      link.setAttribute("download", `laporan-booking-harian${dateLabel}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  if (exportMonthlyBtn) {
    // We bind the click delegate so it handles dynamic rendering on tab swap
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("#exportMonthlyBtn");
      if (!btn) return;

      const bookings = JSON.parse(localStorage.getItem("life_hospitality_bookings") || "[]");
      
      const grouped = {};
      bookings.forEach((b) => {
        if (b.status === "Cancelled") return;
        const dateParts = b.checkin.split("-");
        const yearMonth = `${dateParts[0]}-${dateParts[1]}`;
        const hotelName = b.hotelName;
        const payment = b.paymentMethod === "qris" ? "QRIS" : "Bayar di Hotel";
        
        const key = `${yearMonth}|${hotelName}|${payment}`;
        if (!grouped[key]) {
          grouped[key] = {
            yearMonth,
            hotelName,
            payment,
            count: 0,
            revenue: 0
          };
        }
        grouped[key].count += 1;
        grouped[key].revenue += b.totalPrice;
      });

      const monthNames = {
        "01": "Januari", "02": "Februari", "03": "Maret", "04": "April",
        "05": "Mei", "06": "Juni", "07": "Juli", "08": "Agustus",
        "09": "September", "10": "Oktober", "11": "November", "12": "Desember"
      };

      const sortedKeys = Object.keys(grouped).sort((a, b) => {
        const partsA = a.split("|");
        const partsB = b.split("|");
        if (partsA[0] !== partsB[0]) return partsB[0].localeCompare(partsA[0]);
        if (partsA[1] !== partsB[1]) return partsA[1].localeCompare(partsB[1]);
        return partsA[2].localeCompare(partsB[2]);
      });

      if (sortedKeys.length === 0) {
        alert("Tidak ada data bulanan untuk diexport!");
        return;
      }

      let csvContent = "\uFEFFsep=;\n";
      csvContent += "Bulan;Jumlah Booking;Hotel;Total Pendapatan;Pembayaran\n";

      sortedKeys.forEach((key) => {
        const item = grouped[key];
        const ymParts = item.yearMonth.split("-");
        const monthLabel = `${monthNames[ymParts[1]]} ${ymParts[0]}`;
        
        const row = [
          monthLabel,
          item.count,
          item.hotelName,
          item.revenue,
          item.payment
        ];
        
        const escapedRow = row.map(v => {
          if (typeof v === "string") {
            return `"${v.replace(/"/g, '""')}"`;
          }
          return v;
        }).join(";");
        csvContent += escapedRow + "\n";
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `laporan-pendapatan-bulanan.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // ---------- Add New Hotel ----------
  if (addHotelBtn) {
    addHotelBtn.addEventListener("click", () => {
      addHotelForm.reset();
      addHotelModal.style.display = "flex";
    });
  }

  if (cancelAddHotelBtn) {
    cancelAddHotelBtn.addEventListener("click", () => {
      addHotelModal.style.display = "none";
    });
  }

  if (addHotelForm) {
    addHotelForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = newHotelName.value.trim();
      const area = newHotelArea.value.trim();
      const price = parseInt(newHotelPrice.value, 10);
      const origPrice = parseInt(newHotelOrigPrice.value, 10);
      const dest = document.getElementById("newHotelDest").value;
      const desc = newHotelDesc.value.trim();

      if (!name || !area || isNaN(price) || price <= 0 || isNaN(origPrice) || origPrice <= 0 || !desc) {
        alert("Mohon isi semua data dengan benar!");
        return;
      }

      // Generate unique hotel ID
      const hotelId = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

      // Check if ID already exists
      const existingHotels = getHotels();
      if (existingHotels.some(h => h.id === hotelId)) {
        alert("Nama hotel ini sudah terdaftar!");
        return;
      }

      // Construct new hotel object
      const newHotelObj = {
        id: hotelId,
        name: name,
        area: area,
        price: price,
        originalPrice: origPrice,
        destination: dest,
        rating: 4.5,
        desc: desc,
        image: "img/empress-exterior.jpg", // default exterior image
        thumbs: [
          "img/empress-room1.jpg",
          "img/empress-room2.jpg"
        ],
        available: true
      };

      // Save to life_hospitality_new_hotels
      const newHotelsList = JSON.parse(localStorage.getItem("life_hospitality_new_hotels") || "[]");
      newHotelsList.push(newHotelObj);
      localStorage.setItem("life_hospitality_new_hotels", JSON.stringify(newHotelsList));

      // Quota is 0 by default, let's write to quotas explicitly
      const quotas = JSON.parse(localStorage.getItem("life_hospitality_quotas") || "{}");
      quotas[hotelId] = 0;
      localStorage.setItem("life_hospitality_quotas", JSON.stringify(quotas));

      alert(`Sukses! Hotel "${name}" berhasil ditambahkan dengan kuota awal 0.`);
      addHotelModal.style.display = "none";
      
      // Refresh views
      renderStats();
      renderQuotas();
      initFilters(); // Re-populate filters to include the new hotel!
    });
  }

  // ---------- Boot ----------
  checkSession();
})();
