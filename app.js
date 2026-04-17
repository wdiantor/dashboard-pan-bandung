// 1. KONFIGURASI
const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!A2:E281'; 

// Variabel Global
let allData = [];
let myChart = null;
let map = null;
let geojsonLayer = null;

// 2. INISIALISASI DATA (Fungsi Utama)
async function initDashboard() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.values) {
            console.error("Data tidak ditemukan di Spreadsheet.");
            return;
        }

        allData = data.values;

        // ISI DROPDOWN KECAMATAN (Kolom index 2)
        const kecamatanList = [...new Set(allData.map(row => row[2]))].filter(Boolean).sort();
        const select = document.getElementById('filterKecamatan');
        kecamatanList.forEach(kec => {
            let opt = document.createElement('option');
            opt.value = kec;
            opt.innerHTML = kec;
            select.appendChild(opt);
        });

        // TAMPILKAN GRAFIK & STATISTIK PERTAMA KALI
        applyFilter();

        // TAMPILKAN PETA (Peta dipanggil setelah data siap agar pewarnaan muncul)
        initMap();

    } catch (e) { 
        console.error("Gagal inisialisasi dashboard:", e); 
    }
}

// 3. LOGIKA FILTER & GRAFIK
function applyFilter() {
    const filterValue = document.getElementById('filterKecamatan').value;
    
    const filtered = filterValue === "ALL" 
        ? allData 
        : allData.filter(row => row[2] && row[2].trim() === filterValue);

    let labels, dprtData;

    if (filterValue === "ALL") {
        const summary = {};
        filtered.forEach(row => {
            const kec = row[2];
            if(kec) summary[kec] = (summary[kec] || 0) + (parseInt(row[3]) || 0);
        });
        labels = Object.keys(summary);
        dprtData = Object.values(summary);
    } else {
        labels = filtered.map(row => row[1]); // Nama Desa (Kolom B)
        dprtData = filtered.map(row => parseInt(row[3]) || 0); // DPRT (Kolom D)
    }

    // UPDATE STATISTIK (DPRT di kolom 3, Kader di kolom 4)
    const totalDPRT = filtered.reduce((acc, row) => acc + (parseInt(row[3]) || 0), 0);
    const totalKader = filtered.reduce((acc, row) => acc + (parseInt(row[4]) || 0), 0);
    
    document.getElementById('stat-dprt').innerText = totalDPRT.toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = totalKader.toLocaleString('id-ID');

    renderChart(labels, dprtData, filterValue === "ALL" ? "Total DPRT per Kecamatan" : `Detail Desa di ${filterValue}`);
}

function renderChart(labels, dataValues, title) {
    const ctx = document.getElementById('panChart').getContext('2d');
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: title,
                data: dataValues,
                backgroundColor: '#3b82f6',
                borderRadius: 5
            }]
        },
        options: {
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                y: { ticks: { color: '#94a3b8' } }
            }
        }
    });
}

// 4. LOGIKA PETA (LEAFLET)
function initMap() {
    // Jika peta sudah ada, tidak perlu buat ulang
    if (map !== null) return;

    map = L.map('map').setView([-7.0252, 107.5197], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    fetch('kab-bandung.json')
        .then(res => {
            if (!res.ok) throw new Error("File kab-bandung.json tidak ditemukan.");
            return res.json();
        })
        .then(geoData => {
            geojsonLayer = L.geoJson(geoData, {
                style: styleMap,
                onEachFeature: onEachFeature
            }).addTo(map);
        })
        .catch(err => console.error("Peta Error:", err));
}

function styleMap(feature) {
    const kecMap = feature.properties.KECAMATAN || feature.properties.name || feature.properties.NAMOBJ;
    
    // Cari data di Google Sheets untuk kecamatan ini
    const dataKec = allData.filter(row => row[2] && row[2].trim().toUpperCase() === kecMap.toUpperCase());
    const totalDPRT = dataKec.reduce((acc, row) => acc + (parseInt(row[3]) || 0), 0);

    return {
        fillColor: getColor(totalDPRT),
        weight: 1.5,
        opacity: 1,
        color: 'white',
        fillOpacity: 0.7
    };
}

function getColor(d) {
    return d > 1000 ? '#1e3a8a' : 
           d > 500  ? '#1d4ed8' : 
           d > 100  ? '#3b82f6' : 
           d > 0    ? '#93c5fd' : 
                      '#334155';
}

function onEachFeature(feature, layer) {
    const name = feature.properties.KECAMATAN || feature.properties.name || feature.properties.NAMOBJ;
    layer.bindPopup(`<b>Kecamatan: ${name}</b>`);
    
    layer.on('click', (e) => {
        const select = document.getElementById('filterKecamatan');
        // Set dropdown ke kecamatan yang diklik
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].text.toUpperCase() === name.toUpperCase()) {
                select.selectedIndex = i;
                break;
            }
        }
        applyFilter();
    });
}

// Jalankan Dashboard saat halaman dimuat
window.onload = initDashboard;
