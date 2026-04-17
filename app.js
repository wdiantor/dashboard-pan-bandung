// 1. KONFIGURASI
const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!B2:E281'; 

// Variabel Global
let allData = [];
let myChart = null;
let map = null;
let geojsonLayer = null;

// 2. INISIALISASI UTAMA
async function initDashboard() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // Simpan data (Struktur: [0]ID, [1]Desa, [2]Kecamatan, [3]DPRT Aktif, [4]Kader)
        allData = data.values;

        // Inisialisasi Peta
        initMap();

        // Isi Dropdown Filter Kecamatan
        const kecamatanList = [...new Set(allData.map(row => row[2]))].sort();
        const select = document.getElementById('filterKecamatan');
        kecamatanList.forEach(kec => {
            if(kec) {
                let opt = document.createElement('option');
                opt.value = kec;
                opt.innerHTML = kec;
                select.appendChild(opt);
            }
        });

        // Tampilkan data awal (All)
        applyFilter();
    } catch (e) { 
        console.error("Error mengambil data Google Sheets:", e); 
    }
}

// 3. LOGIKA FILTER & GRAFIK
function applyFilter() {
    const filterValue = document.getElementById('filterKecamatan').value;
    
    const filtered = filterValue === "ALL" 
        ? allData 
        : allData.filter(row => row[2] === filterValue);

    let labels, chartData;

    if (filterValue === "ALL") {
        // Tampilkan ringkasan per Kecamatan
        const summary = {};
        filtered.forEach(row => {
            const kec = row[2];
            if(kec) summary[kec] = (summary[kec] || 0) + parseInt(row[3] || 0);
        });
        labels = Object.keys(summary);
        chartData = Object.values(summary);
    } else {
        // Tampilkan detail per Desa di Kecamatan yang dipilih
        labels = filtered.map(row => row[1]); // Nama Desa
        chartData = filtered.map(row => parseInt(row[3] || 0));
    }

    // Update Statistik Atas
    const totalDPRT = filtered.reduce((acc, row) => acc + parseInt(row[3] || 0), 0);
    const totalKader = filtered.reduce((acc, row) => acc + parseInt(row[4] || 0), 0);
    
    document.getElementById('stat-dprt').innerText = totalDPRT.toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = totalKader.toLocaleString('id-ID');

    renderChart(labels, chartData, filterValue === "ALL" ? "DPRT per Kec." : "DPRT per Desa");
    
    // Sinkronisasi warna peta jika filter berubah (Opsional)
    if(geojsonLayer) geojsonLayer.resetStyle();
}

function renderChart(labels, dataValues, labelName) {
    const ctx = document.getElementById('panChart').getContext('2d');
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: labelName,
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

// 4. LOGIKA PETA (MAP)
function initMap() {
    // Koordinat pusat Kabupaten Bandung
    map = L.map('map').setView([-7.0252, 107.5197], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // Ambil file JSON yang sudah Anda simpan
    fetch('kab-bandung.json')
        .then(res => res.json())
        .then(geoData => {
            geojsonLayer = L.geoJson(geoData, {
                style: styleMap,
                onEachFeature: onEachFeature
            }).addTo(map);
        })
        .catch(err => console.warn("Peta belum bisa dimuat, pastikan file kab-bandung.json tersedia."));
}

function styleMap(feature) {
    // Sesuaikan kunci properti (biasanya 'name' atau 'KECAMATAN')
    const kecName = feature.properties.KECAMATAN || feature.properties.name || feature.properties.NAMOBJ;
    
    const dataKec = allData.filter(row => row[2] && row[2].toUpperCase() === kecName.toUpperCase());
    const total = dataKec.reduce((acc, row) => acc + parseInt(row[3] || 0), 0);

    return {
        fillColor: getColor(total),
        weight: 1.5,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7
    };
}

function getColor(d) {
    return d > 1000 ? '#1e3a8a' : 
           d > 500  ? '#1d4ed8' : 
           d > 100  ? '#3b82f6' : 
           d > 0    ? '#93c5fd' : 
                      '#334155'; // Abu-abu jika data tidak ada
}

function onEachFeature(feature, layer) {
    const kecName = feature.properties.KECAMATAN || feature.properties.name || feature.properties.NAMOBJ;
    layer.bindPopup(`<strong>Kecamatan: ${kecName}</strong>`);
    
    layer.on({
        mouseover: (e) => {
            var layer = e.target;
            layer.setStyle({ weight: 3, color: '#666', fillOpacity: 0.9 });
        },
        mouseout: (e) => {
            geojsonLayer.resetStyle(e.target);
        },
        click: (e) => {
            // Klik peta otomatis ganti dropdown & grafik
            const select = document.getElementById('filterKecamatan');
            // Cari option yang teksnya cocok
            for (let i = 0; i < select.options.length; i++) {
                if (select.options[i].text.toUpperCase() === kecName.toUpperCase()) {
                    select.selectedIndex = i;
                    break;
                }
            }
            applyFilter();
        }
    });
}

// Jalankan Dashboard
initDashboard();
