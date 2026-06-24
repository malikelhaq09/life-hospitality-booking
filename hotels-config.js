/* ============================================================
   KONFIGURASI — LIFE Hospitality Direct Booking
   ============================================================
   Edit file ini saja untuk mengubah data hotel, nomor WhatsApp
   admin, dan teks pesan. Tidak perlu sentuh file lain.

   Setiap hotel memiliki roomTypes dengan kuota (kapasitas kamar).
   Kuota ini adalah BATAS PERMANEN dan dapat diubah melalui:
   Dashboard → Database & Konfigurasi Hotel → ⚙️ Tipe Kamar
   ============================================================ */

// Nomor WhatsApp admin pusat (format: 62 tanpa "+" atau "0" di depan)
const ADMIN_WHATSAPP = "6281234567890"; // GANTI dengan nomor WA admin asli

// Nama brand induk
const BRAND_NAME = "LIFE Hospitality Group";

// Daftar 14 hotel dengan kapasitas kamar masing-masing.
// roomTypes.quota = kapasitas permanen (dapat diubah via Dashboard).
// Setiap booking akan mengurangi kuota secara dinamis sesuai tanggal.
const HOTELS = [
  {
    id: "favor-hotel",
    name: "Favor Hotel",
    area: "Makassar",
    lat: -5.1438,
    lng: 119.4140,
    price: 185000,
    originalPrice: 215000,
    rating: 4.4,
    desc: "Penginapan nyaman dengan layanan ramah dan fasilitas lengkap.",
    image: "img/favor-exterior.jpg",
    thumbs: [
      "img/favor-room1.jpg",
      "img/favor-room2.jpg",
      "img/favor-room3.jpg",
      "img/favor-room4.jpg",
    ],
    available: true,
    destination: "all",
    roomTypes: [
      {
        id: "superior",
        name: "Superior Room",
        price: 185000,
        originalPrice: 215000,
        quota: 10,
        image: "img/favor-room1.jpg",
        desc: "Kamar standar dengan fasilitas lengkap, AC, TV, dan WiFi gratis."
      },
      {
        id: "deluxe",
        name: "Deluxe Room",
        price: 220000,
        originalPrice: 255000,
        quota: 5,
        image: "img/favor-room2.jpg",
        desc: "Kamar lebih luas dengan amenitas premium dan pemandangan kota."
      }
    ]
  },
  {
    id: "tree-hotel",
    name: "Tree Hotel",
    area: "Panakkukang, Makassar",
    lat: -5.1528,
    lng: 119.4442,
    price: 175000,
    originalPrice: 205000,
    rating: 4.3,
    desc: "Suasana asri dan tenang di tengah kota Makassar.",
    image: "img/tree-exterior.jpg",
    thumbs: [
      "img/tree-room1.jpg",
      "img/tree-room2.jpg",
      "img/tree-lobby.jpg",
      "img/tree-bathroom.jpg",
    ],
    available: true,
    destination: "mall",
    roomTypes: [
      {
        id: "superior",
        name: "Superior Room",
        price: 175000,
        originalPrice: 205000,
        quota: 8,
        image: "img/tree-room1.jpg",
        desc: "Kamar standar dengan nuansa alam, AC, TV 32 inci, dan WiFi."
      },
      {
        id: "deluxe",
        name: "Deluxe Room",
        price: 210000,
        originalPrice: 245000,
        quota: 4,
        image: "img/tree-room2.jpg",
        desc: "Kamar luas dengan dekorasi unik dan bathtub eksklusif."
      }
    ]
  },
  {
    id: "life-soekarno-hatta",
    name: "Life Soekarno Hatta",
    area: "Pelabuhan Soekarno-Hatta, Makassar",
    lat: -5.1221,
    lng: 119.4115,
    price: 165000,
    originalPrice: 192000,
    rating: 4.2,
    desc: "Akses cepat ke pelabuhan dan kawasan niaga.",
    image: "img/soekarno-exterior.jpg",
    thumbs: [
      "img/soekarno-room1.jpg",
      "img/soekarno-room2.jpg",
      "img/soekarno-bathroom.jpg",
    ],
    available: true,
    destination: "losari-kuliner",
    roomTypes: [
      {
        id: "superior",
        name: "Superior Room",
        price: 165000,
        originalPrice: 192000,
        quota: 12,
        image: "img/soekarno-room1.jpg",
        desc: "Kamar nyaman dekat pelabuhan, cocok untuk transit dan bisnis."
      },
      {
        id: "deluxe",
        name: "Deluxe Room",
        price: 198000,
        originalPrice: 230000,
        quota: 6,
        image: "img/soekarno-room2.jpg",
        desc: "Kamar lebih luas dengan fasilitas kerja dan pemandangan laut."
      }
    ]
  },
  {
    id: "my-studio-hotel",
    name: "My Studio Hotel",
    area: "Makassar",
    lat: -5.1402,
    lng: 119.4132,
    price: 155000,
    originalPrice: 182000,
    rating: 4.1,
    desc: "Konsep studio modern yang minimalis dan hemat bagi traveler.",
    image: "img/mystudio-exterior.jpg",
    thumbs: [
      "img/mystudio-room1.jpg",
      "img/mystudio-room2.jpg",
    ],
    available: true,
    destination: "losari",
    roomTypes: [
      {
        id: "superior",
        name: "Studio Standard",
        price: 155000,
        originalPrice: 182000,
        quota: 14,
        image: "img/mystudio-room1.jpg",
        desc: "Studio minimalis dengan dapur kecil, ideal untuk long-stay."
      },
      {
        id: "deluxe",
        name: "Studio Deluxe",
        price: 185000,
        originalPrice: 215000,
        quota: 6,
        image: "img/mystudio-room2.jpg",
        desc: "Studio lebih luas dengan ruang kerja dan fasilitas premium."
      }
    ]
  },
  {
    id: "empress-hotel",
    name: "Empress Hotel",
    area: "Makassar",
    lat: -5.1420,
    lng: 119.4109,
    price: 220000,
    originalPrice: 258000,
    rating: 4.6,
    desc: "Kenyamanan premium dengan layanan penuh keramahan.",
    image: "img/empress-exterior.jpg",
    thumbs: [
      "img/empress-room1.jpg",
      "img/empress-room2.jpg",
      "img/empress-lobby.jpg",
      "img/empress-room3.jpg",
    ],
    available: true,
    destination: "losari-kuliner",
    roomTypes: [
      {
        id: "superior",
        name: "Superior Room",
        price: 220000,
        originalPrice: 258000,
        quota: 8,
        image: "img/empress-room1.jpg",
        desc: "Kamar elegan dengan sentuhan dekorasi mewah dan layanan 24 jam."
      },
      {
        id: "deluxe",
        name: "Deluxe Room",
        price: 265000,
        originalPrice: 308000,
        quota: 4,
        image: "img/empress-room2.jpg",
        desc: "Kamar premium dengan jacuzzi, sofa corner, dan city view."
      }
    ]
  },
  {
    id: "grand-citra-hotel",
    name: "Grand Citra Hotel",
    area: "Jl. Botolempangan, Makassar",
    lat: -5.1444,
    lng: 119.4116,
    price: 210000,
    originalPrice: 245000,
    rating: 4.4,
    desc: "Hotel & resto dengan ballroom untuk berbagai acara Anda.",
    image: "img/grandcitra-exterior.jpg",
    thumbs: [
      "img/grandcitra-lobby.jpg",
      "img/grandcitra-room1.jpg",
      "img/grandcitra-room2.jpg",
      "img/grandcitra-room3.jpg",
    ],
    available: true,
    destination: "losari-kuliner",
    roomTypes: [
      {
        id: "superior",
        name: "Superior Room",
        price: 210000,
        originalPrice: 245000,
        quota: 10,
        image: "img/grandcitra-room1.jpg",
        desc: "Kamar luas dengan akses ke fasilitas ballroom dan restoran."
      },
      {
        id: "deluxe",
        name: "Deluxe Room",
        price: 250000,
        originalPrice: 290000,
        quota: 5,
        image: "img/grandcitra-room2.jpg",
        desc: "Kamar premium dengan view taman dan sarapan gratis."
      }
    ]
  },
  {
    id: "sutomo-hotel",
    name: "Sutomo Hotel",
    area: "Jl. DR. Sutomo, Makassar",
    lat: -5.1328,
    lng: 119.4215,
    price: 175000,
    originalPrice: 205000,
    rating: 4.3,
    desc: "Pilihan tepat untuk transit dan perjalanan bisnis dekat pelabuhan.",
    image: "img/sutomo-exterior.jpg",
    thumbs: [
      "img/sutomo-room1.jpg",
      "img/sutomo-room2.jpg",
      "img/sutomo-restaurant.jpg",
      "img/sutomo-bathroom.jpg",
    ],
    available: true,
    destination: "none",
    roomTypes: [
      {
        id: "superior",
        name: "Superior Room",
        price: 175000,
        originalPrice: 205000,
        quota: 10,
        image: "img/sutomo-room1.jpg",
        desc: "Kamar fungsional dekat pusat bisnis, dilengkapi meja kerja."
      },
      {
        id: "deluxe",
        name: "Deluxe Room",
        price: 210000,
        originalPrice: 245000,
        quota: 5,
        image: "img/sutomo-room2.jpg",
        desc: "Kamar luas dengan fasilitas bisnis lengkap dan sarapan gratis."
      }
    ]
  },
  {
    id: "raising-hotel",
    name: "Raising Hotel",
    area: "Karangpuang, Makassar",
    lat: -5.1488,
    lng: 119.4385,
    price: 185000,
    originalPrice: 215000,
    rating: 4.4,
    desc: "Hotel kota strategis dengan fasilitas penunjang bisnis yang lengkap.",
    image: "img/raising-exterior.jpg",
    thumbs: [
      "img/raising-room1.jpg",
      "img/raising-room2.jpg",
      "img/raising-bathroom.jpg",
    ],
    available: true,
    destination: "mall",
    roomTypes: [
      {
        id: "superior",
        name: "Superior Room",
        price: 185000,
        originalPrice: 215000,
        quota: 9,
        image: "img/raising-room1.jpg",
        desc: "Kamar modern dengan desain bersih dan pencahayaan alami."
      },
      {
        id: "deluxe",
        name: "Deluxe Room",
        price: 222000,
        originalPrice: 258000,
        quota: 5,
        image: "img/raising-room2.jpg",
        desc: "Kamar premium dengan shower rain dan fasilitas aromaterapi."
      }
    ]
  },
  {
    id: "max-hotel",
    name: "Max Hotel",
    area: "Panakkukang, Makassar",
    lat: -5.1540,
    lng: 119.4475,
    price: 195000,
    originalPrice: 228000,
    rating: 4.5,
    desc: "Dilengkapi co-working space dan rooftop cafe yang estetik.",
    image: "img/max-exterior.jpg",
    thumbs: [
      "img/max-room1.jpg",
      "img/max-room2.jpg",
      "img/max-bathroom.jpg",
    ],
    available: true,
    destination: "mall",
    roomTypes: [
      {
        id: "superior",
        name: "Superior Room",
        price: 195000,
        originalPrice: 228000,
        quota: 8,
        image: "img/max-room1.jpg",
        desc: "Kamar modern dengan akses co-working space 24 jam gratis."
      },
      {
        id: "deluxe",
        name: "Deluxe Room",
        price: 235000,
        originalPrice: 275000,
        quota: 4,
        image: "img/max-room2.jpg",
        desc: "Kamar rooftop dengan akses eksklusif ke sky lounge dan kafe."
      }
    ]
  },
  {
    id: "jl-star",
    name: "JL Star",
    area: "Makassar",
    lat: -5.1460,
    lng: 119.4250,
    price: 230000,
    originalPrice: 268000,
    rating: 4.5,
    desc: "Desain kontemporer dengan fasilitas modern di pusat kota.",
    image: "img/jlstar-exterior.jpg",
    thumbs: [
      "img/jlstar-room1.jpg",
      "img/jlstar-room2.jpg",
      "img/jlstar-lobby.jpg",
    ],
    available: true,
    destination: "none",
    roomTypes: [
      {
        id: "superior",
        name: "Superior Room",
        price: 230000,
        originalPrice: 268000,
        quota: 6,
        image: "img/jlstar-room1.jpg",
        desc: "Kamar kontemporer dengan furnitur premium dan smart TV."
      },
      {
        id: "deluxe",
        name: "Deluxe Room",
        price: 275000,
        originalPrice: 320000,
        quota: 4,
        image: "img/jlstar-room2.jpg",
        desc: "Kamar suite eksklusif dengan pemandangan panoramik kota."
      }
    ]
  },
  {
    id: "the-one-hotel",
    name: "The One Hotel",
    area: "Makassar",
    lat: -5.1450,
    lng: 119.4180,
    price: 245000,
    originalPrice: 285000,
    rating: 4.7,
    desc: "Kemewahan terbaik dengan pemandangan kota yang menawan.",
    image: "img/theone-exterior.jpg",
    thumbs: [
      "img/theone-room1.jpg",
      "img/theone-room2.jpg",
      "img/theone-bathroom.jpg",
    ],
    available: true,
    destination: "none",
    roomTypes: [
      {
        id: "superior",
        name: "Superior Room",
        price: 245000,
        originalPrice: 285000,
        quota: 6,
        image: "img/theone-room1.jpg",
        desc: "Kamar mewah dengan layanan butler, bathtub soaking, dan city view."
      },
      {
        id: "deluxe",
        name: "Deluxe Suite",
        price: 295000,
        originalPrice: 345000,
        quota: 3,
        image: "img/theone-room2.jpg",
        desc: "Suite premium dengan ruang tamu terpisah dan pemandangan 180 derajat."
      }
    ]
  },
  {
    id: "hotel-prima",
    name: "Hotel Prima",
    area: "Makassar",
    lat: -5.1415,
    lng: 119.4172,
    price: 160000,
    originalPrice: 188000,
    rating: 4.2,
    desc: "Layanan prima dengan harga terjangkau untuk semua kalangan.",
    image: "img/prima-exterior.jpg",
    thumbs: [
      "img/prima-room1.jpg",
      "img/prima-room2.jpg",
      "img/prima-room3.jpg",
    ],
    available: true,
    destination: "none",
    roomTypes: [
      {
        id: "superior",
        name: "Superior Room",
        price: 160000,
        originalPrice: 188000,
        quota: 12,
        image: "img/prima-room1.jpg",
        desc: "Kamar bersih dan nyaman dengan harga terjangkau, AC, dan WiFi."
      },
      {
        id: "deluxe",
        name: "Deluxe Room",
        price: 192000,
        originalPrice: 225000,
        quota: 6,
        image: "img/prima-room2.jpg",
        desc: "Kamar lebih luas dengan tempat tidur king-size dan mini bar."
      }
    ]
  },
  {
    id: "hotel-denpasar",
    name: "Hotel Denpasar",
    area: "Rappocini, Makassar",
    lat: -5.1585,
    lng: 119.4320,
    price: 168000,
    originalPrice: 196000,
    rating: 4.3,
    desc: "Suasana nyaman bernuansa khas yang homey dan tenang.",
    image: "img/denpasar-exterior.jpg",
    thumbs: [
      "img/denpasar-room1.jpg",
      "img/denpasar-room2.jpg",
      "img/denpasar-bathroom.jpg",
    ],
    available: true,
    destination: "none",
    roomTypes: [
      {
        id: "superior",
        name: "Superior Room",
        price: 168000,
        originalPrice: 196000,
        quota: 10,
        image: "img/denpasar-room1.jpg",
        desc: "Kamar bernuansa Bali yang homey, tenang, dan nyaman."
      },
      {
        id: "deluxe",
        name: "Deluxe Room",
        price: 200000,
        originalPrice: 235000,
        quota: 5,
        image: "img/denpasar-room2.jpg",
        desc: "Kamar luas dengan dekorasi etnik dan fasilitas spa mini."
      }
    ]
  },
  {
    id: "hotel-d-holiday",
    name: "Hotel D Holiday",
    area: "Mariso, Makassar",
    lat: -5.1530,
    lng: 119.4090,
    price: 178000,
    originalPrice: 208000,
    rating: 4.3,
    desc: "Dekat kawasan wisata kuliner malam populer Makassar.",
    image: "img/dholiday-exterior.jpg",
    thumbs: [
      "img/dholiday-room1.jpg",
      "img/dholiday-room2.jpg",
      "img/dholiday-room3.jpg",
    ],
    available: true,
    destination: "none",
    roomTypes: [
      {
        id: "superior",
        name: "Superior Room",
        price: 178000,
        originalPrice: 208000,
        quota: 10,
        image: "img/dholiday-room1.jpg",
        desc: "Kamar nyaman dekat pusat kuliner malam Makassar, AC, dan WiFi."
      },
      {
        id: "deluxe",
        name: "Deluxe Room",
        price: 215000,
        originalPrice: 250000,
        quota: 5,
        image: "img/dholiday-room2.jpg",
        desc: "Kamar luas dengan balkon pemandangan kota dan kuliner malam."
      }
    ]
  },
];
