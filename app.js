// 1. KONFIGURASI UTAMA
const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!A2:E281'; 

// Variabel Global
let allData = [];
let myChart = null;
let map = null;
let geojsonLayer = null;

// Indeks Kolom (Akan dideteksi otomatis, default ke standar Bapak)
let idx = { id: 0, desa: 1, kec: 2, dprt: 3, kader: 4 };

// 2. FUNGSI INISIALISASI
async function initDashboard() {
    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`);
        const data = await response.json();
        
        if (!data.values || data.values.length === 0) {
            alert("Data Spreadsheet tidak terbaca! Periksa API Key atau Izin Berbagi.");
            return;
        }

        // Simpan data & bersihkan baris kosong
        allData = data.values.filter(row => row.length >= 3);

        // DEBUG: Lihat di Console (F12) untuk memastikan urutan kolom
        console.log("Sampel Data Baris 1:", allData[0]);

        // MENGISI DROPDOWN KECAMATAN
        const select = document.getElementById('filterKecamatan');
        // Ambil data dari kolom index 2 (Kolom C), pastikan hanya teks yang diambil
        const kecamatanList = [...new Set(allData.map(row => row[idx.kec]))]
                                .filter(val => val && isNaN(val)) 
                                .sort();
        
        select.innerHTML = '<option value="ALL">SEMUA KECAMATAN</option>';
        kecamatanList.forEach(kec => {
            let opt = document.createElement('option');
            opt.value = kec;
            opt.textContent = kec;
            select.appendChild(opt);
        });

        // Jalankan Komponen Dashboard
        applyFilter();
        initMap();

    } catch (e) {
        console.error("Gagal Memuat Dashboard:", e);
    }
}

// 3. FUNGSI FILTER & GRAFIK
function applyFilter() {
    const filterValue = document.getElementById('filterKecamatan').value;
    
    const filtered = filterValue === "ALL" 
        ? allData 
        : allData.filter(row => row[idx.kec] && row[idx.kec].trim() === filterValue);

    // Update Statistik (Card)
    const totalDPRT = filtered.reduce((acc, row) => acc + (parseInt(row[idx.dprt]) || 0), 0);
    const totalKader = filtered.reduce((acc, row) => acc + (parseInt(row[idx.kader]) || 0), 0);
    
    document.getElementById('stat-dprt').innerText = totalDPRT.toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = totalKader.toLocaleString('id-ID');

    let labels, vals;
    if (filterValue === "ALL") {
        // Mode Kabupaten: Kelompokkan per Kecamatan
        const summary = {};
        filtered.forEach(row => { 
            const kec = row[idx.kec];
            if(kec && isNaN(kec)) {
                summary[kec] = (summary[kec] || 0) + (parseInt(row[idx.dprt]) || 0);
            }
        });
        labels = Object.keys(summary);
        vals = Object.values(summary);
    } else {
        // Mode Kecamatan: Tampilkan per Desa
        labels = filtered.map(row => row[idx.desa]); 
        vals = filtered.map(row => parseInt(row[idx.dprt]) || 0);
    }

    renderChart(labels, vals, filterValue === "ALL" ? "DPRT per Kecamatan" : `Detail Desa di ${filterValue}`);
    
    // Refresh warna peta jika filter berubah
    if(geojsonLayer) geojsonLayer.resetStyle();
}

function renderChart(l, v, title) {
    const ctx = document.getElementById('panChart').getContext('2d');
    if (myChart) myChart.destroy();
    
    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: l,
            datasets: [{ 
                label: 'Jumlah DPRT', 
                data: v, 
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: { 
            indexAxis: 'y', 
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                title: { display: true, text: title, color: '#94a3b8' }
            },
            scales: { 
                y: { ticks: { color: '#94a3b8', font: { size: 10 } } },
                x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
            }
        }
    });
}

// 4. FUNGSI PETA (LEAFLET)
function initMap() {
    if (map) return; // Jangan buat peta ganda
    
    map = L.map('map').setView([-7.0252, 107.5197], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Memuat File GeoJSON Lokal
    fetch('kab-bandung.json')
        .then(res => res.json())
        .then(geoData => {
            geojsonLayer = L.geoJson(geoData, {
                style: styleMap,
                onEachFeature: (feature, layer) => {
                    const name = feature.properties.KECAMATAN || feature.properties.name || feature.properties.NAMOBJ;
                    layer.bindPopup(`<b>Kecamatan: ${name}</b>`);
                    
                    layer.on('click', () => {
                        document.getElementById('filterKecamatan').value = name;
                        applyFilter();
                    });
                }
            }).addTo(map);
        })
        .catch(err => console.warn("Peta (kab-bandung.json) tidak terbaca. Pastikan file ada di GitHub."));
}

function styleMap(feature) {
    const kecName = feature.properties.KECAMATAN || feature.properties.name || feature.properties.NAMOBJ;
    const dataKec = allData.filter(row => row[idx.kec] && row[idx.kec].trim().toUpperCase() === kecName.toUpperCase());
    const total = dataKec.reduce((acc, row) => acc + (parseInt(row[idx.dprt]) || 0), 0);

    return {
        fillColor: total > 1000 ? '#1e3a8a' : total > 100 ? '#3b82f6' : '#93c5fd',
        weight: 1.5,
        color: 'white',
        fillOpacity: 0.7
    };
}

// JALANKAN DASHBOARD SAAT WINDOW LOAD
window.onload = initDashboard;
