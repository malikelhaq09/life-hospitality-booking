/* ============================================================
   LIFE Hospitality — Direct Booking
   Logika utama (tidak perlu diedit kecuali untuk menambah fitur)
   ============================================================ */

(function () {
  "use strict";

  // ---------- Helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const todayISO = () => new Date().toISOString().slice(0, 10);

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

  function formatRupiah(n) {
    return "Rp " + Math.round(n).toLocaleString("id-ID");
  }

  function formatDateID(isoStr) {
    if (!isoStr) return "—";
    const d = new Date(isoStr + "T00:00:00");
    return d.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function nightsBetween(checkinISO, checkoutISO) {
    const a = new Date(checkinISO + "T00:00:00");
    const b = new Date(checkoutISO + "T00:00:00");
    return Math.round((b - a) / 86400000);
  }

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const dist = R * c;
    if (dist < 1) {
      return `${Math.round(dist * 1000)} m`;
    }
    return `${dist.toFixed(1)} km`;
  }

  function getAvailableRoomQuota(hotelId, roomTypeId, searchCheckin, searchCheckout) {
    const hotelsList = getHotels();
    const hotel = hotelsList.find((h) => h.id === hotelId);
    if (!hotel) return 0;

    const roomType = hotel.roomTypes.find((rt) => rt.id === roomTypeId || rt.name.toLowerCase() === roomTypeId.toLowerCase());
    if (!roomType) return 0;

    const baseQuota = parseInt(roomType.quota || 0, 10);

    const bookings = JSON.parse(localStorage.getItem("life_hospitality_bookings") || "[]");
    const overlappingBookings = bookings.filter((b) => {
      if (b.hotelId !== hotelId) return false;
      if (b.status === "Cancelled") return false;
      
      const isSameRoom = b.roomType.toLowerCase() === roomType.name.toLowerCase() || b.roomType.toLowerCase() === roomType.id.toLowerCase();
      if (!isSameRoom) return false;

      return b.checkin < searchCheckout && b.checkout > searchCheckin;
    });

    // Sum rooms consumed (support multi-room bookings)
    const roomsConsumed = overlappingBookings.reduce((sum, b) => sum + (parseInt(b.rooms, 10) || 1), 0);
    return Math.max(0, baseQuota - roomsConsumed);
  }

  function getAvailableHotelQuota(hotelId, searchCheckin, searchCheckout) {
    const hotel = getHotels().find((h) => h.id === hotelId);
    if (!hotel || !hotel.roomTypes) return 0;

    return hotel.roomTypes.reduce((sum, rt) => {
      return sum + getAvailableRoomQuota(hotelId, rt.id, searchCheckin, searchCheckout);
    }, 0);
  }

  function generateBookingCode(hotelId) {
    const initials = hotelId
      .split("-")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 3);
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const datePart = new Date().toISOString().slice(5, 10).replace("-", ""); // MMDD
    return `LH-${initials}${datePart}-${rand}`;
  }

  // ---------- State ----------
  let currentSearch = { checkin: "", checkout: "", nights: 0, rooms: 1 };
  let currentHotel = null;
  let currentBookingCode = "";
  let userLocation = null;

  // Custom Guests Selector State
  let roomsCount = 1;
  let adultsCount = 2;
  let kidsCount = 0;

  // Custom Traveloka Datepicker State
  let selectedCheckin = ""; // ISO string (YYYY-MM-DD)
  let selectedCheckout = ""; // ISO string (YYYY-MM-DD)
  let pickerCurrentDate = new Date(); // Month view controller

  // ---------- DOM refs ----------
  const checkinInput = $("#checkin");
  const checkoutInput = $("#checkout");
  const searchForm = $("#searchForm");
  const nightsInfo = $("#nightsInfo");
  const hotelGrid = $("#hotelGrid");
  const resultsCount = $("#resultsCount");

  const modal = $("#bookingModal");
  const modalOverlay = $("#modalOverlay");
  const modalClose = $("#modalClose");
  const modalHotelName = $("#modalHotelName");
  const modalHotelArea = $("#modalHotelArea");
  const ticketCheckin = $("#ticketCheckin");
  const ticketCheckout = $("#ticketCheckout");
  const ticketNights = $("#ticketNights");
  const modalTotal = $("#modalTotal");
  const guestForm = $("#guestForm");
  const stepForm = $("#stepForm");
  const stepConfirm = $("#stepConfirm");
  const bookingCodeDisplay = $("#bookingCodeDisplay");
  const goToWhatsappBtn = $("#goToWhatsapp");

  // ---------- Custom Datepicker Helper ----------
  function formatDateTraveloka(isoStr) {
    if (!isoStr) return "Pilih Tanggal";
    const d = new Date(isoStr + "T00:00:00");
    const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const dayName = days[d.getDay()];
    const dateNum = d.getDate();
    const monthName = monthNamesShort[d.getMonth()];
    const yearNum = d.getFullYear();
    return `${dayName}, ${dateNum} ${monthName} ${yearNum}`;
  }

  // ---------- DOM refs for Custom Datepicker ----------
  const datePickerTrigger = $("#datePickerTrigger");
  const travelokaDatePicker = $("#travelokaDatePicker");
  const pickerCloseBtn = $("#pickerCloseBtn");
  const pickerCheckinVal = $("#pickerCheckinVal");
  const pickerCheckoutVal = $("#pickerCheckoutVal");
  const monthTitleLeft = $("#monthTitleLeft");
  const monthTitleRight = $("#monthTitleRight");
  const daysContainerLeft = $("#daysContainerLeft");
  const daysContainerRight = $("#daysContainerRight");
  const pickerPrevBtn = $("#pickerPrevBtn");
  const pickerNextBtn = $("#pickerNextBtn");
  const checkinDisplay = $("#checkinDisplay");
  const checkoutDisplay = $("#checkoutDisplay");

  // ---------- Init dates ----------
  function initDates() {
    const t = new Date();
    const tomorrow = new Date(t.getTime() + 86400000);
    const dayAfter = new Date(t.getTime() + 2 * 86400000);
    
    selectedCheckin = tomorrow.toISOString().slice(0, 10);
    selectedCheckout = dayAfter.toISOString().slice(0, 10);

    checkinInput.value = selectedCheckin;
    checkoutInput.value = selectedCheckout;

    if (checkinDisplay) checkinDisplay.textContent = formatDateTraveloka(selectedCheckin);
    if (checkoutDisplay) checkoutDisplay.textContent = formatDateTraveloka(selectedCheckout);

    if (pickerCheckinVal) pickerCheckinVal.textContent = formatDateTraveloka(selectedCheckin);
    if (pickerCheckoutVal) pickerCheckoutVal.textContent = formatDateTraveloka(selectedCheckout);
  }

  // ---------- Calendar Rendering Engine ----------
  const monthNamesID = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  function renderCalendar() {
    const leftYear = pickerCurrentDate.getFullYear();
    const leftMonth = pickerCurrentDate.getMonth();

    // Right month is next month
    let rightYear = leftYear;
    let rightMonth = leftMonth + 1;
    if (rightMonth > 11) {
      rightMonth = 0;
      rightYear += 1;
    }

    if (monthTitleLeft) monthTitleLeft.textContent = `${monthNamesID[leftMonth]} ${leftYear}`;
    if (monthTitleRight) monthTitleRight.textContent = `${monthNamesID[rightMonth]} ${rightYear}`;

    if (daysContainerLeft) renderMonthDays(leftYear, leftMonth, daysContainerLeft);
    if (daysContainerRight) renderMonthDays(rightYear, rightMonth, daysContainerRight);
  }

  function renderMonthDays(year, month, container) {
    container.innerHTML = "";

    // Day 1 of month
    const firstDay = new Date(year, month, 1);
    // Mon-start index: Mon = 0, Tue = 1, ..., Sat = 5, Sun = 6
    let startDayIdx = firstDay.getDay() - 1;
    if (startDayIdx < 0) startDayIdx = 6; // Sunday becomes 6

    const totalDays = new Date(year, month + 1, 0).getDate();

    // Empty spaces before first day
    for (let i = 0; i < startDayIdx; i++) {
      const el = document.createElement("div");
      el.className = "datepicker-day empty";
      container.appendChild(el);
    }

    const todayStr = todayISO();

    for (let day = 1; day <= totalDays; day++) {
      const el = document.createElement("div");
      el.className = "datepicker-day";
      el.textContent = day;

      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      el.dataset.date = dateStr;

      // Check if past day
      if (dateStr < todayStr) {
        el.classList.add("disabled");
      }

      // Check if today
      if (dateStr === todayStr) {
        el.classList.add("today");
      }

      // Check if selected checkin
      if (selectedCheckin && dateStr === selectedCheckin) {
        el.classList.add("selected-start");
      }

      // Check if selected checkout
      if (selectedCheckout && dateStr === selectedCheckout) {
        el.classList.add("selected-end");
      }

      // Check if in range
      if (selectedCheckin && selectedCheckout && dateStr > selectedCheckin && dateStr < selectedCheckout) {
        el.classList.add("in-range");
      }

      // Add click handler
      if (dateStr >= todayStr) {
        el.addEventListener("click", () => handleDayClick(dateStr));
      }

      container.appendChild(el);
    }
  }

  function handleDayClick(dateStr) {
    if (!selectedCheckin || (selectedCheckin && selectedCheckout)) {
      // First click or reset
      selectedCheckin = dateStr;
      selectedCheckout = "";
    } else {
      // Second click (select end)
      if (dateStr <= selectedCheckin) {
        // If clicked date is before or equal to check-in, reset check-in
        selectedCheckin = dateStr;
      } else {
        selectedCheckout = dateStr;
        
        // Save values to inputs
        checkinInput.value = selectedCheckin;
        checkoutInput.value = selectedCheckout;

        // Update display text
        if (checkinDisplay) checkinDisplay.textContent = formatDateTraveloka(selectedCheckin);
        if (checkoutDisplay) checkoutDisplay.textContent = formatDateTraveloka(selectedCheckout);

        // Update search info
        const nights = nightsBetween(selectedCheckin, selectedCheckout);
        nightsInfo.textContent = `${nights} malam · ${formatDateTraveloka(selectedCheckin)} → ${formatDateTraveloka(selectedCheckout)}`;

        // Trigger change events manually for compatibility
        checkinInput.dispatchEvent(new Event("change"));
        checkoutInput.dispatchEvent(new Event("change"));

        // Close picker
        if (travelokaDatePicker) travelokaDatePicker.style.display = "none";
      }
    }

    // Update picker header preview
    if (pickerCheckinVal) pickerCheckinVal.textContent = formatDateTraveloka(selectedCheckin);
    if (pickerCheckoutVal) pickerCheckoutVal.textContent = formatDateTraveloka(selectedCheckout);

    renderCalendar();
  }

  // ---------- Datepicker Event Listeners ----------
  if (datePickerTrigger && travelokaDatePicker) {
    datePickerTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = travelokaDatePicker.style.display === "none";
      if (isHidden) {
        travelokaDatePicker.style.display = "flex";
        renderCalendar();
      } else {
        travelokaDatePicker.style.display = "none";
      }
    });

    travelokaDatePicker.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevents auto-closing on clicking inside
    });

    document.addEventListener("click", () => {
      travelokaDatePicker.style.display = "none";
    });
  }

  if (pickerCloseBtn && travelokaDatePicker) {
    pickerCloseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      travelokaDatePicker.style.display = "none";
    });
  }

  // ---------- Guests Picker Event Listeners ----------
  const guestsInput = $("#guests");
  const guestsPickerTrigger = $("#guestsPickerTrigger");
  const guestsPicker = $("#guestsPicker");
  const btnDecRooms = $("#btnDecRooms");
  const btnIncRooms = $("#btnIncRooms");
  const valRooms = $("#valRooms");
  const btnDecAdults = $("#btnDecAdults");
  const btnIncAdults = $("#btnIncAdults");
  const valAdults = $("#valAdults");
  const btnDecKids = $("#btnDecKids");
  const btnIncKids = $("#btnIncKids");
  const valKids = $("#valKids");
  const btnGuestsDone = $("#btnGuestsDone");

  function updateGuestsDisplay() {
    if (valRooms) valRooms.textContent = roomsCount;
    if (valAdults) valAdults.textContent = adultsCount;
    if (valKids) valKids.textContent = kidsCount;

    if (btnDecRooms) btnDecRooms.disabled = roomsCount <= 1;
    if (btnIncRooms) btnIncRooms.disabled = roomsCount >= 8;

    if (btnDecAdults) btnDecAdults.disabled = adultsCount <= 1;
    if (btnIncAdults) btnIncAdults.disabled = adultsCount >= 16;

    if (btnDecKids) btnDecKids.disabled = kidsCount <= 0;
    if (btnIncKids) btnIncKids.disabled = kidsCount >= 8;

    if (guestsInput) {
      guestsInput.value = `${adultsCount} Dewasa, ${kidsCount} Anak, ${roomsCount} Kamar`;
    }
  }

  if (guestsPickerTrigger && guestsPicker) {
    guestsPickerTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = guestsPicker.style.display === "none";
      if (isHidden) {
        if (travelokaDatePicker) travelokaDatePicker.style.display = "none";
        guestsPicker.style.display = "flex";
      } else {
        guestsPicker.style.display = "none";
      }
    });

    guestsPicker.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    document.addEventListener("click", () => {
      guestsPicker.style.display = "none";
    });
  }

  if (btnDecRooms) btnDecRooms.addEventListener("click", () => { roomsCount = Math.max(1, roomsCount - 1); updateGuestsDisplay(); });
  if (btnIncRooms) btnIncRooms.addEventListener("click", () => { roomsCount = Math.min(8, roomsCount + 1); updateGuestsDisplay(); });

  if (btnDecAdults) btnDecAdults.addEventListener("click", () => { adultsCount = Math.max(1, adultsCount - 1); updateGuestsDisplay(); });
  if (btnIncAdults) btnIncAdults.addEventListener("click", () => { adultsCount = Math.min(16, adultsCount + 1); updateGuestsDisplay(); });

  if (btnDecKids) btnDecKids.addEventListener("click", () => { kidsCount = Math.max(0, kidsCount - 1); updateGuestsDisplay(); });
  if (btnIncKids) btnIncKids.addEventListener("click", () => { kidsCount = Math.min(8, kidsCount + 1); updateGuestsDisplay(); });

  if (btnGuestsDone) {
    btnGuestsDone.addEventListener("click", (e) => {
      e.stopPropagation();
      if (guestsPicker) guestsPicker.style.display = "none";
    });
  }

  // Initialize display
  updateGuestsDisplay();

  const handlePrevClick = (e) => {
    e.stopPropagation();
    pickerCurrentDate.setMonth(pickerCurrentDate.getMonth() - 1);
    renderCalendar();
  };

  const handleNextClick = (e) => {
    e.stopPropagation();
    pickerCurrentDate.setMonth(pickerCurrentDate.getMonth() + 1);
    renderCalendar();
  };

  if (pickerPrevBtn) {
    pickerPrevBtn.addEventListener("click", handlePrevClick);
  }
  const pickerPrevBtnMobile = $("#pickerPrevBtnMobile");
  if (pickerPrevBtnMobile) {
    pickerPrevBtnMobile.addEventListener("click", handlePrevClick);
  }

  if (pickerNextBtn) {
    pickerNextBtn.addEventListener("click", handleNextClick);
  }
  const pickerNextBtnMobile = $("#pickerNextBtnMobile");
  if (pickerNextBtnMobile) {
    pickerNextBtnMobile.addEventListener("click", handleNextClick);
  }

  // ---------- Render hotel cards ----------
  function renderHotels() {
    const { checkin, checkout, nights } = currentSearch;
    const hotelsList = getHotels();
    const available = hotelsList.filter((h) => h.available);

    resultsCount.textContent = `${available.length} dari ${hotelsList.length} properti tersedia`;

    if (available.length === 0) {
      hotelGrid.innerHTML = `<p class="empty-state">Belum ada hotel tersedia untuk tanggal ini. Coba tanggal lain.</p>`;
      return;
    }

    // Read quotas from localStorage
    const savedQuotas = JSON.parse(localStorage.getItem("life_hospitality_quotas") || "{}");

    hotelGrid.innerHTML = available
      .map((h) => {
        const rooms = currentSearch.rooms || 1;
        const total = h.price * nights * rooms;
        const scoreVal = h.rating * 2;
        const score = scoreVal.toFixed(1);
        let ratingText = "Cukup";
        if (scoreVal >= 9.2) ratingText = "Luar Biasa";
        else if (scoreVal >= 8.6) ratingText = "Mengesankan";
        else if (scoreVal >= 8.0) ratingText = "Sangat Baik";
        else if (scoreVal >= 7.5) ratingText = "Baik";

        let stars = "⭐⭐⭐";
        if (h.price >= 220000) stars = "⭐⭐⭐⭐⭐";
        else if (h.price >= 180000) stars = "⭐⭐⭐⭐";

        const reviewsCount = Math.round((h.rating * h.rating * 350)).toLocaleString('id-ID');
        const distanceText = userLocation && h.lat && h.lng
          ? `${calculateDistance(userLocation.lat, userLocation.lng, h.lat, h.lng)} dari Lokasi Anda`
          : `${(h.price % 700 + 150)} m dari Lokasi Sekarang`;
        const originalPrice = h.originalPrice !== undefined ? h.originalPrice : h.price * 1.15;

        const thumb1 = h.image;
        const thumb2 = h.thumbs && h.thumbs[0] ? h.thumbs[0] : `https://picsum.photos/seed/${h.id}room/120/80`;
        const thumb3 = h.thumbs && h.thumbs[1] ? h.thumbs[1] : `https://picsum.photos/seed/${h.id}pool/120/80`;

        // Quota calculations dynamically based on selected date range
        const currentQuota = getAvailableHotelQuota(h.id, checkin, checkout);
        const isSoldOut = currentQuota < rooms;

        // Quota warnings/badges HTML
        const roomsLabel = rooms > 1 ? ` untuk ${rooms} kamar` : ``;
        let quotaHTML = "";
        if (isSoldOut) {
          quotaHTML = `<span class="hotel-card__quota-warning">❌ Penuh (Fully Booked${roomsLabel})</span>`;
        } else if (currentQuota <= 3) {
          quotaHTML = `<span class="hotel-card__quota-warning">⚠️ Sisa ${currentQuota} kamar tersedia!</span>`;
        }

        // Render dynamic room types list for this hotel
        const roomsHTML = (h.roomTypes || []).map((rt) => {
          const roomQuota = getAvailableRoomQuota(h.id, rt.id, checkin, checkout);
          const isRoomSoldOut = roomQuota < rooms;
          const roomOriginalPrice = rt.originalPrice !== undefined ? rt.originalPrice : Math.round(rt.price * 1.15);
          const roomTotal = rt.price * nights * rooms;

          let roomQuotaHTML = "";
          if (isRoomSoldOut) {
            roomQuotaHTML = `<span style="color: #ef4444; font-size: 11px; font-weight: 700; display: block; margin-top: 2px;">❌ ${rooms > 1 ? `Kuota tidak cukup untuk ${rooms} kamar` : 'Habis'}</span>`;
          } else if (roomQuota <= 3) {
            roomQuotaHTML = `<span style="color: #f59e0b; font-size: 11px; font-weight: 700; display: block; margin-top: 2px;">⚠️ Sisa ${roomQuota} kamar!</span>`;
          } else {
            roomQuotaHTML = `<span style="color: #10b981; font-size: 11px; font-weight: 600; display: block; margin-top: 2px;">✓ Tersedia (${roomQuota} kamar)</span>`;
          }

          return `
            <div class="hotel-card__room-row" data-room-img="${rt.image}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; gap: 16px; transition: background 0.2s;">
              <div style="display: flex; gap: 16px; align-items: center; flex: 1;">
                <img src="${rt.image}" alt="${rt.name}" style="width: 80px; height: 55px; object-fit: cover; border-radius: 6px; background: #e2e8f0; cursor: pointer;" class="room-row-img-click">
                <div style="flex: 1;">
                  <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: var(--text-dark);">${rt.name}</h4>
                  <p style="margin: 3px 0 0; font-size: 12px; color: var(--text-muted); line-height: 1.4;">${rt.desc || 'Fasilitas kamar lengkap dan nyaman untuk istirahat Anda.'}</p>
                </div>
              </div>
              
              <div style="display: flex; align-items: center; gap: 20px; justify-content: flex-end; flex-wrap: wrap;">
                <div style="text-align: right; min-width: 120px;">
                  <span style="font-size: 11px; color: var(--text-muted); text-decoration: line-through; display: block; line-height: 1.1;">${formatRupiah(roomOriginalPrice)}${rooms > 1 ? ` × ${rooms}` : ''}</span>
                  <span style="font-size: 16px; font-weight: 800; color: var(--traveloka-orange); display: block; line-height: 1.2;">${formatRupiah(rt.price)}</span>
                  <span style="font-size: 11px; color: var(--text-muted); display: block; margin-top: 1px;">/malam${rooms > 1 ? ` × ${rooms} kamar` : ''} · total ${formatRupiah(roomTotal)}</span>
                  ${roomQuotaHTML}
                </div>
                <button class="hotel-card__cta room-book-btn" data-hotel-id="${h.id}" data-room-id="${rt.id}" ${isRoomSoldOut ? 'disabled' : ''} style="width: auto; padding: 8px 16px; font-size: 13px;">
                  ${isRoomSoldOut ? 'Habis' : 'Pesan'}
                </button>
              </div>
            </div>
          `;
        }).join("");

        return `
        <article class="hotel-card" data-id="${h.id}">
          <!-- Left Column: Gallery & Thumbnails -->
          <div class="hotel-card__gallery">
            <div class="hotel-card__media">
              <img src="${h.image}" alt="${h.name}" loading="lazy">
              <span class="hotel-card__badge">${isSoldOut ? 'Penuh' : 'Bisa Bayar di Hotel'}</span>
            </div>
            <div class="hotel-card__thumbs">
              <div class="hotel-card__thumb active"><img src="${thumb1}" alt="thumb"></div>
              <div class="hotel-card__thumb"><img src="${thumb2}" alt="thumb"></div>
              <div class="hotel-card__thumb">
                <img src="${thumb3}" alt="thumb">
                <div class="hotel-card__thumb--more">Lihat<br>Foto</div>
              </div>
            </div>
          </div>

          <!-- Middle Column: Details -->
          <div class="hotel-card__body">
            <div class="hotel-card__header">
              <div class="hotel-card__title-row">
                <span class="hotel-card__shield">🛡️</span>
                <h3 class="hotel-card__name">${h.name}</h3>
              </div>
              <div class="hotel-card__rating-block">
                <span class="hotel-card__score">${score}/10</span>
                <span class="hotel-card__rating-desc">${ratingText}</span>
                <span class="hotel-card__reviews">(${reviewsCount} ulasan)</span>
              </div>
            </div>

            <div class="hotel-card__meta">
              <span class="hotel-card__type-badge">Hotel</span>
              <span class="hotel-card__stars">${stars}</span>
            </div>

            <div class="hotel-card__location">
              <span class="hotel-card__location-pin">📍</span>
              <span>${h.area}</span>
              <span class="hotel-card__location-sep">|</span>
              <span>${distanceText}</span>
            </div>

            <div class="hotel-card__tags">
              <div class="hotel-card__tag-best">
                <span class="hotel-card__tag-thumb">👍</span>
                <span>Harga terbaik di kelasnya</span>
              </div>
              <span class="hotel-card__tag-facility">WiFi Gratis</span>
              <span class="hotel-card__tag-facility">AC</span>
              <span class="hotel-card__tag-facility">Parkir</span>
              <span class="hotel-card__tag-facility">Resepsionis 24 Jam</span>
            </div>
            
            ${quotaHTML}
          </div>

          <!-- Right Column: Pricing & CTA -->
          <div class="hotel-card__action-panel">
            ${isSoldOut ? `
              <span class="hotel-card__price-promo" style="color: #ef4444; font-size: 16px;">Fully Booked</span>
              <span class="hotel-card__price-suffix" style="margin-bottom: auto; margin-top: 4px;">Kuota habis${rooms > 1 ? ` untuk ${rooms} kamar` : ''}</span>
              <button class="hotel-card__cta" disabled>Habis</button>
            ` : `
              <div class="hotel-card__promo-login">
                <span class="hotel-card__promo-icon">🏷️</span>
                <span>Jaminan harga termurah</span>
              </div>
              <span class="hotel-card__price-suffix" style="margin-bottom: 2px;">Harga mulai dari</span>
              <span class="hotel-card__price-original">${formatRupiah(originalPrice)}${rooms > 1 ? ` × ${rooms}` : ''}</span>
              <span class="hotel-card__price-promo">${formatRupiah(h.price)}</span>
              <span class="hotel-card__price-suffix">/malam${rooms > 1 ? ` × ${rooms} kamar` : ''} · total ${formatRupiah(total)}</span>
              ${rooms > 1 ? `<span class="hotel-card__price-alert" style="color: var(--traveloka-blue-dark);">Total untuk ${rooms} kamar, ${nights} malam</span>` : `<span class="hotel-card__price-alert">Harga lebih rendah dari biasanya!</span>`}
              <button class="hotel-card__cta scroll-to-rooms-btn">Pilih Kamar</button>
            `}
          </div>

          <!-- Collapsible Rooms List Row -->
          <div class="hotel-card__rooms" style="grid-column: 1 / -1; border-top: 1px solid var(--border-color); background: rgba(197, 160, 89, 0.02); display: none; flex-direction: column;">
            <div style="background: rgba(197, 160, 89, 0.05); padding: 8px 16px; font-size: 12px; font-weight: 700; color: var(--traveloka-blue-dark); border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 6px;">
              <span>🛏️ Pilihan Kamar Tersedia</span>
            </div>
            ${roomsHTML}
          </div>
        </article>`;
      })
      .join("");
  }

  // ---------- Search submit ----------
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const checkin = checkinInput.value;
    const checkout = checkoutInput.value;

    if (!checkin || !checkout) return;
    const nights = nightsBetween(checkin, checkout);
    if (nights <= 0) {
      nightsInfo.textContent = "Tanggal check-out harus setelah check-in.";
      return;
    }

    const rooms = roomsCount || 1;
    currentSearch = { checkin, checkout, nights, rooms };
    const roomsLabel = rooms > 1 ? ` · ${rooms} kamar` : ``;
    nightsInfo.textContent = `${nights} malam${roomsLabel} · ${formatDateID(checkin)} → ${formatDateID(checkout)}`;
    renderHotels();
    $("#resultsSection").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ---------- Hotel grid click handler (modal opening + gallery switching) ----------
  hotelGrid.addEventListener("click", (e) => {
    // Gallery thumbnail click
    const thumb = e.target.closest(".hotel-card__thumb");
    if (thumb) {
      const card = thumb.closest(".hotel-card");
      const mainImg = card.querySelector(".hotel-card__media img");
      const clickedImg = thumb.querySelector("img");
      if (mainImg && clickedImg) {
        mainImg.src = clickedImg.src;
        // Update active class
        card.querySelectorAll(".hotel-card__thumb").forEach((t) => t.classList.remove("active"));
        thumb.classList.add("active");
      }
      return;
    }

    // Toggle rooms list panel visibility
    const scrollBtn = e.target.closest(".scroll-to-rooms-btn");
    if (scrollBtn) {
      const card = scrollBtn.closest(".hotel-card");
      const roomsEl = card.querySelector(".hotel-card__rooms");
      if (roomsEl) {
        const isHidden = window.getComputedStyle(roomsEl).display === "none";
        
        // Hide all other hotel room panels to keep the page clean
        document.querySelectorAll(".hotel-card__rooms").forEach((panel) => {
          if (panel !== roomsEl) {
            panel.style.display = "none";
            const otherCard = panel.closest(".hotel-card");
            const otherBtn = otherCard.querySelector(".scroll-to-rooms-btn");
            if (otherBtn) otherBtn.textContent = "Pilih Kamar";
          }
        });

        if (isHidden) {
          roomsEl.style.display = "flex";
          scrollBtn.textContent = "Tutup Pilihan";
          setTimeout(() => {
            roomsEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }, 50);
        } else {
          roomsEl.style.display = "none";
          scrollBtn.textContent = "Pilih Kamar";
        }
      }
      return;
    }

    // Book button inside room row click
    const roomBookBtn = e.target.closest(".room-book-btn");
    if (roomBookBtn) {
      const hotelId = roomBookBtn.dataset.hotelId;
      const roomId = roomBookBtn.dataset.roomId;
      const hotel = getHotels().find((h) => h.id === hotelId);
      if (hotel) openModal(hotel, roomId);
      return;
    }

    // Click room row to switch main gallery image and highlight it
    const roomRow = e.target.closest(".hotel-card__room-row");
    if (roomRow && !e.target.closest(".room-book-btn")) {
      const imgPath = roomRow.dataset.roomImg;
      const card = roomRow.closest(".hotel-card");
      const mainImg = card.querySelector(".hotel-card__media img");
      if (mainImg && imgPath) {
        mainImg.src = imgPath;
        card.querySelectorAll(".hotel-card__thumb").forEach(t => t.classList.remove("active"));
      }
      card.querySelectorAll(".hotel-card__room-row").forEach(r => r.style.background = "");
      roomRow.style.background = "rgba(197, 160, 89, 0.08)";
      return;
    }

    // Standard fallback book button click (if any)
    const btn = e.target.closest("[data-book]");
    if (btn) {
      const hotel = getHotels().find((h) => h.id === btn.dataset.book);
      if (hotel) openModal(hotel);
      return;
    }
  });

  function updateModalPrice() {
    const { nights, rooms } = currentSearch;
    const roomsCount = rooms || 1;
    const container = $("#roomOptionsContainer");
    if (!container) return;

    const selectedRadio = container.querySelector("input[name='roomtype']:checked");
    if (selectedRadio) {
      const pricePerRoom = parseInt(selectedRadio.dataset.price, 10);
      const total = pricePerRoom * nights * roomsCount;
      if (modalTotal) {
        modalTotal.textContent = formatRupiah(total);
      }
      // Update rooms info label if present
      const roomsInfoEl = $("#modalRoomsInfo");
      if (roomsInfoEl) {
        if (roomsCount > 1) {
          roomsInfoEl.textContent = `${formatRupiah(pricePerRoom)} × ${roomsCount} kamar × ${nights} malam`;
          roomsInfoEl.style.display = "block";
        } else {
          roomsInfoEl.textContent = `${formatRupiah(pricePerRoom)} × ${nights} malam`;
          roomsInfoEl.style.display = "block";
        }
      }
    }
  }

  function openModal(hotel, preselectedRoomId) {
    currentHotel = hotel;
    const { checkin, checkout, nights } = currentSearch;

    modalHotelName.textContent = hotel.name;
    modalHotelArea.textContent = hotel.area;
    ticketCheckin.textContent = formatDateID(checkin).replace(/^\w+,\s*/, "");
    ticketCheckout.textContent = formatDateID(checkout).replace(/^\w+,\s*/, "");
    ticketNights.textContent = `${nights} malam`;

    // Render dynamic room types options inside modal
    const container = $("#roomOptionsContainer");
    if (container && hotel.roomTypes) {
      container.innerHTML = hotel.roomTypes.map((rt, idx) => {
        const isSelected = preselectedRoomId ? rt.id === preselectedRoomId : idx === 0;
        const isRoomSoldOut = rt.quota <= 0;
        
        return `
          <label class="payment-option ${isRoomSoldOut ? 'disabled' : ''}" style="${isRoomSoldOut ? 'opacity: 0.5; cursor: not-allowed; pointer-events: none;' : 'cursor: pointer;'} display: flex; flex-direction: column; gap: 4px; padding: 12px; border: 1.5px solid var(--border-color); border-radius: 8px; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="radio" name="roomtype" value="${rt.name}" data-price="${rt.price}" ${isSelected ? 'checked' : ''} ${isRoomSoldOut ? 'disabled' : ''} required style="accent-color: var(--traveloka-blue);">
              <span class="payment-option__title" style="font-weight: 700; color: var(--text-dark);">${rt.name}</span>
            </div>
            <span class="payment-option__desc" style="font-size: 12px; color: var(--text-muted); padding-left: 22px;">
              ${rt.desc || 'Fasilitas kamar lengkap & nyaman'} 
              <strong style="color: var(--traveloka-orange); display: block; margin-top: 4px; font-size: 13.5px;">${formatRupiah(rt.price)} /malam</strong>
            </span>
          </label>
        `;
      }).join("");

      // Bind change handler
      container.querySelectorAll("input[name='roomtype']").forEach(radio => {
        radio.addEventListener("change", updateModalPrice);
      });
    }

    updateModalPrice();

    guestForm.reset();
    
    // Explicitly check target radio if preselectedRoomId is provided
    if (container && preselectedRoomId && hotel.roomTypes) {
      const selectedObj = hotel.roomTypes.find(r => r.id === preselectedRoomId);
      if (selectedObj) {
        const targetRadio = container.querySelector(`input[value="${selectedObj.name}"]`);
        if (targetRadio) {
          targetRadio.checked = true;
          updateModalPrice();
        }
      }
    }

    stepForm.hidden = false;
    stepConfirm.hidden = true;

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  modalClose.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });

  // ---------- Build WhatsApp message ----------
  function buildWhatsappMessage({ name, phone, email, payment, roomtype, bookingCode }) {
    const { checkin, checkout, nights, rooms } = currentSearch;
    const roomsCount = rooms || 1;
    const selectedRoom = currentHotel.roomTypes.find(rt => rt.name.toLowerCase() === roomtype.toLowerCase());
    const pricePerNight = selectedRoom ? selectedRoom.price : currentHotel.price;
    const total = pricePerNight * nights * roomsCount;

    const lines = [
      `Halo Admin *${BRAND_NAME}*, saya ingin melakukan pemesanan kamar:`,
      ``,
      `Nama: ${name}`,
      `No. HP: ${phone}`,
      `Email: ${email}`,
      `Hotel: ${currentHotel.name}`,
      `Check-in: ${formatDateID(checkin)}`,
      `Check-out: ${formatDateID(checkout)}`,
      `Jumlah malam: ${nights}`,
      `Tipe kamar: ${roomtype}`,
      `Jumlah kamar: ${roomsCount}`,
      `Estimasi total: ${formatRupiah(total)}${roomsCount > 1 ? ` (${roomsCount} kamar × ${nights} malam × ${formatRupiah(pricePerNight)})` : ''}`,
      `Metode pembayaran: ${payment === "qris" ? "QRIS" : "Bayar langsung di hotel"}`,
    ];

    if (payment === "qris") {
      lines.push(``, `Mohon kirimkan kode QRIS untuk pembayaran. Terima kasih!`);
    } else {
      lines.push(`Kode booking: ${bookingCode}`, ``, `Mohon konfirmasi pemesanan saya. Terima kasih!`);
    }

    return lines.join("\n");
  }

  function redirectToWhatsapp(message) {
    const url = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  function saveBookingAndDecrementQuota({ name, phone, email, payment, roomtype, bookingCode }) {
    const { checkin, checkout, nights, rooms } = currentSearch;
    const roomsCount = rooms || 1;
    const selectedRoom = currentHotel.roomTypes.find(rt => rt.name.toLowerCase() === roomtype.toLowerCase());
    const pricePerNight = selectedRoom ? selectedRoom.price : currentHotel.price;
    const total = pricePerNight * nights * roomsCount;
    const code = bookingCode || generateBookingCode(currentHotel.id);

    const newBooking = {
      bookingCode: code,
      hotelId: currentHotel.id,
      hotelName: currentHotel.name,
      guestName: name,
      phone: phone,
      email: email,
      checkin: checkin,
      checkout: checkout,
      nights: nights,
      rooms: roomsCount,
      roomType: roomtype,
      paymentMethod: payment,
      totalPrice: total,
      timestamp: Date.now(),
      status: "Confirmed"
    };

    const savedBookings = JSON.parse(localStorage.getItem("life_hospitality_bookings") || "[]");
    savedBookings.unshift(newBooking);
    localStorage.setItem("life_hospitality_bookings", JSON.stringify(savedBookings));

    renderHotels();
    return code;
  }

  // ---------- Guest form submit ----------
  guestForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(guestForm);
    const name = fd.get("name").trim();
    const phone = fd.get("phone").trim();
    const email = fd.get("email").trim();
    const roomtype = fd.get("roomtype");
    const payment = fd.get("payment");

    if (!name || !phone || !email || !roomtype || !payment) return;

    if (payment === "hotel") {
      currentBookingCode = generateBookingCode(currentHotel.id);
      saveBookingAndDecrementQuota({ name, phone, email, payment, roomtype, bookingCode: currentBookingCode });
      
      bookingCodeDisplay.textContent = currentBookingCode;
      stepForm.hidden = true;
      stepConfirm.hidden = false;

      goToWhatsappBtn.onclick = () => {
        const msg = buildWhatsappMessage({ name, phone, email, payment, roomtype, bookingCode: currentBookingCode });
        redirectToWhatsapp(msg);
        closeModal();
      };
    } else {
      const generatedCode = saveBookingAndDecrementQuota({ name, phone, email, payment, roomtype });
      const msg = buildWhatsappMessage({ name, phone, email, payment, roomtype, bookingCode: generatedCode });
      redirectToWhatsapp(msg);
      closeModal();
    }
  });

  // ---------- Virtual Assistant Chatbot ----------
  function initChatbot() {
    const chatToggle = document.getElementById("chatToggle");
    const chatWindow = document.getElementById("chatWindow");
    const chatClose = document.getElementById("chatClose");
    const chatBody = document.getElementById("chatBody");
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    const chatQuickReplies = document.getElementById("chatQuickReplies");

    if (!chatToggle || !chatWindow || !chatClose || !chatBody || !chatForm || !chatInput || !chatQuickReplies) return;

    function formatWhatsappDisplay(num) {
      if (num.startsWith("62")) {
        return `+62 ${num.slice(2, 5)}-${num.slice(5, 9)}-${num.slice(9)}`;
      }
      return "+" + num;
    }

    const waDisplay = formatWhatsappDisplay(ADMIN_WHATSAPP);

    const faqDatabase = {
      harga: {
        keywords: ["harga", "ota", "lebih murah", "murah", "traveloka", "agoda", "tiket.com", "bebas biaya", "admin", "promo", "potongan", "diskon"],
        answer: "Ya, kami memberikan jaminan harga terbaik (Best Rate Guarantee) jika memesan langsung melalui website resmi kami. Harga di website kami lebih hemat/bebas biaya layanan admin."
      },
      wa: {
        keywords: ["wa", "whatsapp", "hubungi", "nomor", "kontak", "admin", "reservasi", "no hp", "nomor hp", "telepon", "telfon", "telpon", "hp"],
        answer: `Tim reservasi kami dapat dihubungi melalui WhatsApp di nomor <strong>${waDisplay}</strong> pada jam operasional <strong>08.00 - 22.00 WITA</strong>.`,
        action: { text: "Hubungi via WhatsApp", link: `https://wa.me/${ADMIN_WHATSAPP}` }
      },
      kamar: {
        keywords: ["kamar", "tipe", "superior", "deluxe", "fasilitas", "wifi", "tv", "ac", "pilihan", "bed", "kasur"],
        answer: "Tipe kamar yang tersedia di hotel kami adalah <strong>Superior</strong> dan <strong>Deluxe</strong>. Semua kamar sudah dilengkapi dengan fasilitas <strong>gratis WiFi, TV, AC, dan parkir gratis</strong>."
      },
      pesan: {
        keywords: ["pesan", "booking", "cara", "order", "book now", "reservasi", "pilih kamar", "gimana", "langkah"],
        answer: "Pemesanan dapat dilakukan secara langsung dengan mengeklik tombol <strong>'Pilih Kamar'</strong> di website ini, pilih tanggal check-in & check-out, pilih tipe kamar, lalu ikuti instruksi pembayaran. Anda juga bisa melakukan pembayaran langsung di hotel kami dengan menggunakan kode booking dari website resmi."
      },
      bayar: {
        keywords: ["bayar", "pembayaran", "pay at hotel", "check-in", "qris", "tunai", "cash", "kartu", "debit", "kredit", "transfer", "tiba", "datang", "resepsionis"],
        answer: "Kami menerima metode pembayaran via <strong>QRIS</strong> dan <strong>Pay at Hotel</strong>. Ya, kami menyediakan opsi 'Pay at Hotel' untuk pemesanan langsung melalui website resmi (bayar saat tiba di hotel)."
      }
    };

    const quickRepliesList = [
      { text: "🏷️ Jaminan Harga", key: "harga" },
      { text: "📞 Kontak WhatsApp", key: "wa" },
      { text: "🛏️ Tipe & Fasilitas Kamar", key: "kamar" },
      { text: "📝 Cara Pemesanan", key: "pesan" },
      { text: "💳 Metode Pembayaran", key: "bayar" }
    ];

    let hasOpened = false;

    chatToggle.addEventListener("click", () => {
      const isHidden = chatWindow.hasAttribute("hidden");
      if (isHidden) {
        chatWindow.removeAttribute("hidden");
        chatToggle.style.transform = "scale(0)";
        chatInput.focus();
        if (!hasOpened) {
          showWelcomeMessage();
          hasOpened = true;
        }
      }
    });

    chatClose.addEventListener("click", () => {
      chatWindow.setAttribute("hidden", "true");
      chatToggle.style.transform = "scale(1)";
    });

    function addMessage(sender, htmlContent) {
      const msg = document.createElement("div");
      msg.className = `chat-msg chat-msg--${sender}`;
      msg.innerHTML = htmlContent;
      chatBody.appendChild(msg);
      chatBody.scrollTop = chatBody.scrollHeight;
    }

    function renderQuickReplies() {
      chatQuickReplies.innerHTML = "";
      quickRepliesList.forEach((q) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chat-reply-btn";
        btn.textContent = q.text;
        btn.addEventListener("click", () => {
          addMessage("user", q.text);
          chatQuickReplies.innerHTML = "";
          
          setTimeout(() => {
            handleAnswer(q.key);
          }, 400);
        });
        chatQuickReplies.appendChild(btn);
      });
    }

    function showWelcomeMessage() {
      addMessage(
        "bot",
        "Halo! Selamat datang di <strong>LIFE Hospitality Group</strong>. 🛎️ Saya adalah asisten virtual resmi Anda."
      );
      setTimeout(() => {
        addMessage(
          "bot",
          "Ada yang bisa saya bantu hari ini? Silakan pilih menu cepat di bawah ini atau ketik langsung pertanyaan Anda."
        );
        renderQuickReplies();
      }, 500);
    }

    function handleAnswer(key) {
      const item = faqDatabase[key];
      if (item) {
        addMessage("bot", item.answer);
        if (item.action) {
          addMessage(
            "bot",
            `<a href="${item.action.link}" target="_blank" class="chat-action-btn">${item.action.text}</a>`
          );
        }
      }
      
      setTimeout(() => {
        addMessage("bot", "Ada hal lain yang ingin Anda ketahui? Silakan pilih opsi di bawah:");
        renderQuickReplies();
      }, 1000);
    }

    function handleUserText(text) {
      const lower = text.toLowerCase().trim();
      let matchedKey = null;

      for (const [key, val] of Object.entries(faqDatabase)) {
        if (val.keywords.some((kw) => lower.includes(kw))) {
          matchedKey = key;
          break;
        }
      }

      if (matchedKey) {
        handleAnswer(matchedKey);
      } else {
        addMessage(
          "bot",
          "Maaf, saya tidak memiliki informasi mengenai hal tersebut. Silakan hubungi tim layanan pelanggan/reservasi kami via WhatsApp untuk mendapatkan bantuan detail lebih lanjut."
        );
        addMessage(
          "bot",
          `<a href="https://wa.me/${ADMIN_WHATSAPP}" target="_blank" class="chat-action-btn">Hubungi WhatsApp Resmi</a>`
        );
        
        setTimeout(() => {
          addMessage("bot", "Atau pilih salah satu topik bantuan di bawah:");
          renderQuickReplies();
        }, 1200);
      }
    }

    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = chatInput.value.trim();
      if (!val) return;

      addMessage("user", val);
      chatInput.value = "";
      chatQuickReplies.innerHTML = "";

      setTimeout(() => {
        handleUserText(val);
      }, 400);
    });

    // Listen for clicks on footer FAQ triggers
    document.addEventListener("click", (e) => {
      const trigger = e.target.closest(".chat-trigger-faq");
      if (!trigger) return;
      e.preventDefault();
      
      const faqKey = trigger.dataset.faq;
      
      // Open chatbot window
      chatWindow.removeAttribute("hidden");
      chatToggle.style.transform = "scale(0)";
      chatInput.focus();
      if (!hasOpened) {
        showWelcomeMessage();
        hasOpened = true;
      }
      
      // Show user message and handle bot answer
      if (faqKey && faqDatabase[faqKey]) {
        // Strip emoji prefixes for chat bubble
        const userText = trigger.textContent.trim().replace(/^[^\s]+\s+/, "");
        addMessage("user", userText);
        setTimeout(() => {
          handleAnswer(faqKey);
        }, 300);
      }
    });
  }

  // ---------- Favorite Destinations & SEO Routing ----------
  const DESTINATIONS = {
    losari: {
      id: "losari",
      title: "Dekat Pantai Losari",
      headerTitle: "Hotel Dekat Pantai Losari Makassar",
      desc: "Menampilkan hotel pilihan terbaik dekat Pantai Losari dengan jaminan harga langsung.",
      seoTitle: "Hotel Dekat Pantai Losari Makassar | Life Hospitality Group",
      seoDesc: "Temukan hotel terbaik dekat Pantai Losari dengan harga terbaik dan booking langsung tanpa perantara."
    },
    mall: {
      id: "mall",
      title: "Dekat Pusat Perbelanjaan",
      headerTitle: "Hotel Dekat Pusat Belanja",
      desc: "Menampilkan hotel pilihan terbaik dekat Mall Panakkukang, Nipah Mall, dan pusat belanja lainnya.",
      seoTitle: "Hotel Dekat Pusat Belanja & Nipah Mall Makassar | Life Hospitality Group",
      seoDesc: "Temukan hotel terbaik dekat pusat perbelanjaan dan mall di Makassar dengan harga terbaik dan booking langsung."
    },
    kuliner: {
      id: "kuliner",
      title: "Dekat Pusat Kuliner & Cafe",
      headerTitle: "Hotel Dekat Pusat Kuliner & Cafe",
      desc: "Menampilkan hotel pilihan terbaik dekat pusat kuliner tradisional khas Makassar dan cafe populer.",
      seoTitle: "Hotel Dekat Pusat Kuliner & Cafe Makassar | Life Hospitality Group",
      seoDesc: "Temukan hotel terbaik dekat pusat kuliner tradisional Makassar dengan harga terbaik dan booking langsung tanpa perantara."
    }
  };

  const defaultMeta = {
    title: "LIFE Hospitality — Direct Booking",
    desc: "14 Hotel Pilihan dalam Satu Platform Reservasi Resmi Life Hospitality Group. Harga terbaik, konfirmasi cepat, dan kemudahan booking langsung ke hotel."
  };

  function updateMeta(title, desc) {
    document.title = title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", desc);
    } else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = desc;
      document.head.appendChild(meta);
    }
  }

  function handleRouting() {
    const path = window.location.pathname;
    if (path.startsWith("/hotel-dekat-")) {
      const destId = path.replace("/hotel-dekat-", "");
      if (DESTINATIONS[destId]) {
        showDestinationPage(destId, false);
      } else {
        showHomePage(false);
      }
    } else {
      showHomePage(false);
    }
  }

  function showDestinationPage(destId, pushState = true) {
    const dest = DESTINATIONS[destId];
    if (!dest) return;

    if (pushState) {
      history.pushState({ destId }, "", `/hotel-dekat-${destId}`);
    }

    // Update SEO Meta
    updateMeta(dest.seoTitle, dest.seoDesc);

    // Hide home views, show detail view
    const heroSection = $(".hero");
    const destinasiSection = $("#destinasiSection");
    const resultsSection = $("#resultsSection");
    const detailSection = $("#destinationDetailSection");

    if (heroSection) heroSection.style.display = "none";
    if (destinasiSection) destinasiSection.style.display = "none";
    if (resultsSection) resultsSection.style.display = "none";
    if (detailSection) detailSection.style.display = "block";

    // Set titles
    const titleEl = document.getElementById("destDetailTitle");
    const descEl = document.getElementById("destDetailDesc");
    if (titleEl) titleEl.textContent = dest.headerTitle;
    if (descEl) descEl.textContent = dest.desc;

    // Render filtered hotels
    renderDestHotels(destId);
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showHomePage(pushState = true) {
    if (pushState) {
      history.pushState({}, "", "/");
    }

    // Restore SEO Meta
    updateMeta(defaultMeta.title, defaultMeta.desc);

    const heroSection = $(".hero");
    const destinasiSection = $("#destinasiSection");
    const resultsSection = $("#resultsSection");
    const detailSection = $("#destinationDetailSection");

    if (heroSection) heroSection.style.display = "block";
    if (destinasiSection) destinasiSection.style.display = "block";
    if (resultsSection) resultsSection.style.display = "block";
    if (detailSection) detailSection.style.display = "none";

    // Render regular hotels
    renderHotels();
  }

  function renderDestHotels(destId) {
    const destHotelGrid = document.getElementById("destHotelGrid");
    if (!destHotelGrid) return;

    const { checkin, checkout, nights } = currentSearch;
    const hotelsList = getHotels();
    
    // Filter by destination tag: split key by '-' to match compound tags like 'losari-kuliner'
    const filtered = hotelsList.filter((h) => {
      if (!h.available) return false;
      const tag = h.destination || "none";
      return tag === "all" || tag.split("-").includes(destId);
    });

    if (filtered.length === 0) {
      destHotelGrid.innerHTML = `<p class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">Belum ada hotel LIFE Hospitality yang diaktifkan untuk wilayah ini.</p>`;
      return;
    }

    const savedQuotas = JSON.parse(localStorage.getItem("life_hospitality_quotas") || "{}");

    destHotelGrid.innerHTML = filtered
      .map((h) => {
        const total = h.price * nights;
        const scoreVal = h.rating * 2;
        const score = scoreVal.toFixed(1);
        let ratingText = "Cukup";
        if (scoreVal >= 9.2) ratingText = "Luar Biasa";
        else if (scoreVal >= 8.6) ratingText = "Mengesankan";
        else if (scoreVal >= 8.0) ratingText = "Sangat Baik";
        else if (scoreVal >= 7.5) ratingText = "Baik";

        let stars = "⭐⭐⭐";
        if (h.price >= 220000) stars = "⭐⭐⭐⭐⭐";
        else if (h.price >= 180000) stars = "⭐⭐⭐⭐";

        const reviewsCount = Math.round((h.rating * h.rating * 350)).toLocaleString('id-ID');
        const distanceText = userLocation && h.lat && h.lng
          ? `${calculateDistance(userLocation.lat, userLocation.lng, h.lat, h.lng)} dari Lokasi Anda`
          : `${(h.price % 700 + 150)} m dari Lokasi Sekarang`;
        const originalPrice = h.originalPrice !== undefined ? h.originalPrice : h.price * 1.15;

        const thumb1 = h.image;
        const thumb2 = h.thumbs && h.thumbs[0] ? h.thumbs[0] : `https://picsum.photos/seed/${h.id}room/120/80`;
        const thumb3 = h.thumbs && h.thumbs[1] ? h.thumbs[1] : `https://picsum.photos/seed/${h.id}pool/120/80`;

        // Quota calculations
        const currentQuota = savedQuotas[h.id] !== undefined ? parseInt(savedQuotas[h.id], 10) : 0;
        const isSoldOut = currentQuota <= 0;

        let quotaHTML = "";
        if (isSoldOut) {
          quotaHTML = `<span class="hotel-card__quota-warning">❌ Penuh (Fully Booked)</span>`;
        } else if (currentQuota <= 3) {
          quotaHTML = `<span class="hotel-card__quota-warning">⚠️ Sisa ${currentQuota} kamar!</span>`;
        }

        // Destination specific metadata
        let destMetaHTML = "";
        let distanceVal = "350 m"; // fallback
        if (destId === "losari") {
          const custom = {
            "favor-hotel": "450 m",
            "life-soekarno-hatta": "800 m",
            "empress-hotel": "300 m",
            "grand-citra-hotel": "500 m",
            "my-studio-hotel": "600 m"
          };
          distanceVal = custom[h.id] || (Math.floor(Math.random() * 600) + 150) + " m";
          destMetaHTML = `
            <div style="font-size: 13px; color: var(--traveloka-blue-dark); font-weight: 600; display: flex; align-items: center; gap: 4px; margin-top: 4px;">
              <span>📍 Jarak ke Pantai Losari: <strong>${distanceVal}</strong></span>
              <span style="color: var(--border-color); margin: 0 4px;">|</span>
              <span>⭐ Rating: <strong>${h.rating} / 5</strong></span>
            </div>
          `;
        } else if (destId === "mall") {
          const custom = {
            "max-hotel": { dist: "250 m", mall: "Mall Panakkukang" },
            "raising-hotel": { dist: "800 m", mall: "Nipah Mall" },
            "tree-hotel": { dist: "500 m", mall: "Mall Panakkukang" },
            "favor-hotel": { dist: "1.2 km", mall: "Mall Ratu Indah" }
          };
          const info = custom[h.id] || { dist: (Math.floor(Math.random() * 500) + 200) + " m", mall: "Pusat Perbelanjaan Terdekat" };
          destMetaHTML = `
            <div style="font-size: 13px; color: var(--traveloka-blue-dark); font-weight: 600; display: flex; align-items: center; gap: 4px; margin-top: 4px;">
              <span>📍 Jarak ke ${info.mall}: <strong>${info.dist}</strong></span>
            </div>
          `;
        } else if (destId === "kuliner") {
          const custom = {
            "grand-citra-hotel": { dist: "150 m", recommendation: "Konro Karebosi & Sop Saudara" },
            "life-soekarno-hatta": { dist: "300 m", recommendation: "Coto Nusantara & Seafood Pelabuhan" },
            "empress-hotel": { dist: "250 m", recommendation: "Mirasari & Pallubasa Serigala" },
            "favor-hotel": { dist: "200 m", recommendation: "Nasi Kuning Riburane & Cafe Terpopuler" }
          };
          const info = custom[h.id] || { dist: (Math.floor(Math.random() * 300) + 100) + " m", recommendation: "Coto Makassar & Cafe Terdekat" };
          destMetaHTML = `
            <div style="font-size: 13px; color: var(--traveloka-blue-dark); font-weight: 600; display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
              <span>📍 Jarak ke Pusat Kuliner: <strong>${info.dist}</strong></span>
              <span style="color: var(--text-muted); font-size: 12.5px; font-weight: 400; margin-top: 2px;">🍽️ Rekomendasi Terdekat: <em>${info.recommendation}</em></span>
            </div>
          `;
        }

        return `
        <article class="hotel-card" data-id="${h.id}">
          <!-- Left Column: Gallery & Thumbnails -->
          <div class="hotel-card__gallery">
            <div class="hotel-card__media">
              <img src="${h.image}" alt="${h.name}" loading="lazy">
              <span class="hotel-card__badge">${isSoldOut ? 'Penuh' : 'Bisa Bayar di Hotel'}</span>
            </div>
            <div class="hotel-card__thumbs">
              <div class="hotel-card__thumb active"><img src="${thumb1}" alt="thumb"></div>
              <div class="hotel-card__thumb"><img src="${thumb2}" alt="thumb"></div>
              <div class="hotel-card__thumb">
                <img src="${thumb3}" alt="thumb">
                <div class="hotel-card__thumb--more">Lihat<br>Foto</div>
              </div>
            </div>
          </div>

          <!-- Middle Column: Details -->
          <div class="hotel-card__body">
            <div class="hotel-card__header">
              <div class="hotel-card__title-row">
                <span class="hotel-card__shield">🛡️</span>
                <h3 class="hotel-card__name">${h.name}</h3>
              </div>
              <div class="hotel-card__rating-block">
                <span class="hotel-card__score">${score}/10</span>
                <span class="hotel-card__rating-desc">${ratingText}</span>
                <span class="hotel-card__reviews">(${reviewsCount} ulasan)</span>
              </div>
            </div>

            <div class="hotel-card__meta">
              <span class="hotel-card__type-badge">Hotel</span>
              <span class="hotel-card__stars">${stars}</span>
              ${quotaHTML}
            </div>

            <div class="hotel-card__location" style="margin-top: 4px;">
              <span class="hotel-card__location-pin">📍</span>
              <span>${h.area}</span>
              <span class="hotel-card__location-sep">|</span>
              <span>${distanceText}</span>
            </div>
            
            <!-- Destination metadata row -->
            ${destMetaHTML}

            <p class="hotel-card__desc" style="margin-top: 8px;">${h.desc}</p>
          </div>

          <!-- Right Column: Pricing & Call to Action -->
          <div class="hotel-card__action-panel">
            ${isSoldOut ? `
              <span class="hotel-card__price-promo" style="color: #ef4444; font-size: 16px;">Fully Booked</span>
              <span class="hotel-card__price-suffix" style="margin-bottom: auto; margin-top: 4px;">Kuota habis untuk hari ini</span>
              <button class="hotel-card__cta" disabled>Habis</button>
            ` : `
              <div class="hotel-card__promo-login">
                <span class="hotel-card__promo-icon">🎁</span>
                <span>Direct Booking Promo</span>
              </div>
              <span class="hotel-card__price-original">${formatRupiah(originalPrice)}</span>
              <span class="hotel-card__price-promo">${formatRupiah(h.price)}</span>
              <span class="hotel-card__price-suffix">/malam · total ${formatRupiah(total)}</span>
              <span class="hotel-card__price-alert">Harga lebih rendah dari biasanya!</span>
              <button class="hotel-card__cta" data-book="${h.id}">Lihat Kamar</button>
            `}
          </div>
        </article>
        `;
      })
      .join("");
  }

  // ---------- Boot ----------
  initDates();
  currentSearch = {
    checkin: checkinInput.value,
    checkout: checkoutInput.value,
    nights: nightsBetween(checkinInput.value, checkoutInput.value),
  };
  nightsInfo.textContent = `${currentSearch.nights} malam · ${formatDateTraveloka(currentSearch.checkin)} → ${formatDateTraveloka(currentSearch.checkout)}`;
  renderHotels();
  initChatbot();

  // Request user Geolocation on startup to calculate real-time distances
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        // Re-render hotels once coordinates are obtained
        renderHotels();
        // Also re-render destination hotels if destination page is active
        const detailSection = document.getElementById("destinationDetailSection");
        if (detailSection && detailSection.style.display === "block" && history.state && history.state.destId) {
          renderDestHotels(history.state.destId);
        }
      },
      (error) => {
        console.log("Izin lokasi tidak diberikan atau gagal diambil:", error.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Set copyright year dynamically
  const yearEl = document.getElementById("copyrightYear");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // Bind new destinations listeners
  const destinasiSection = document.getElementById("destinasiSection");
  const backToHomeBtn = document.getElementById("backToHomeBtn");
  const destHotelGrid = document.getElementById("destHotelGrid");

  if (destinasiSection) {
    destinasiSection.addEventListener("click", (e) => {
      const card = e.target.closest(".destinasi-card");
      if (card) {
        const destId = card.dataset.destination;
        showDestinationPage(destId, true);
      }
    });
  }

  if (backToHomeBtn) {
    backToHomeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      showHomePage(true);
    });
  }

  if (destHotelGrid) {
    destHotelGrid.addEventListener("click", (e) => {
      // Gallery thumbnail click
      const thumb = e.target.closest(".hotel-card__thumb");
      if (thumb) {
        const card = thumb.closest(".hotel-card");
        const mainImg = card.querySelector(".hotel-card__media img");
        const clickedImg = thumb.querySelector("img");
        if (mainImg && clickedImg) {
          mainImg.src = clickedImg.src;
          card.querySelectorAll(".hotel-card__thumb").forEach((t) => t.classList.remove("active"));
          thumb.classList.add("active");
        }
        return;
      }

      // Book button click
      const btn = e.target.closest("[data-book]");
      if (btn) {
        const hotel = getHotels().find((h) => h.id === btn.dataset.book);
        if (hotel) openModal(hotel);
        return;
      }
    });
  }

  window.addEventListener("popstate", (e) => {
    if (e.state && e.state.destId) {
      showDestinationPage(e.state.destId, false);
    } else {
      showHomePage(false);
    }
  });

  // Handle initial page routing
  handleRouting();
})();
