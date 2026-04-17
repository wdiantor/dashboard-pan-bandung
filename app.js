const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!A2:E281'; // Kolom A:ID, B:Desa, C:Kecamatan, D:DPRT, E:Kader

let allData = [];
let myChart = null;
let map = null;
let geojsonLayer = null;

async function initDashboard() {
    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`);
        const data = await response.json();
        
        if (!data.values) {
            console.error("Data tidak ditemukan! Cek API Key atau ID Spreadsheet.");
            return;
        }

        // Simpan data mentah
        allData = data.values;

        // 1. ISI DROPDOWN KECAMATAN
        // Kita ambil index [2] karena Kecamatan ada di Kolom C
        const kecamatanList = [...new Set(allData.map(row => row[2]))]
                                .filter(val => val && isNaN(val)) // Hanya ambil Teks, bukan Angka
                                .sort();
        
        const select = document.getElementById('filterKecamatan');
        select.innerHTML = '<option value="ALL">SEMUA KECAMATAN</option>';
        
        kecamatanList.forEach(kec => {
            let opt = document.createElement('option');
            opt.value = kec;
            opt.innerHTML = kec;
            select.appendChild(opt);
        });

        // 2. Jalankan Tampilan Data
        applyFilter();

        // 3. Jalankan Peta
        initMap();

    } catch (e) {
        console.error("Gagal memuat dashboard:", e);
    }
}

function applyFilter() {
    const filterValue = document.getElementById('filterKecamatan').value;
    
    // Filter berdasarkan Kolom C (Index 2)
    const filtered = filterValue === "ALL" 
        ? allData 
        : allData.filter(row => row[2] && row[2].trim() === filterValue);

    // Update Statistik (DPRT: Kolom D [3], Kader: Kolom E [4])
    const dprt = filtered.reduce((acc, row) => acc + (parseInt(row[3]) || 0), 0);
    const kader = filtered.reduce((acc, row) => acc + (parseInt(row[4]) || 0), 0);
    
    document.getElementById('stat-dprt').innerText = dprt.toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = kader.toLocaleString('id-ID');

    let labels, vals;
    if (filterValue === "ALL") {
        // Tampilkan Total per Kecamatan di Grafik
        const sum = {};
        filtered.forEach(row => { 
            const namaKec = row[2];
            if(namaKec) sum[namaKec] = (sum[namaKec] || 0) + (parseInt(row[3]) || 0); 
        });
        labels = Object.keys(sum);
        vals = Object.values(sum);
    } else {
        // Tampilkan Detail per Desa di Grafik
        labels = filtered.map(row => row[1]); // Kolom B (Index 1)
        vals = filtered.map(row => parseInt(row[3]) || 0);
    }

    renderChart(labels, vals, filterValue === "ALL" ? "DPRT per Kecamatan" : `Detail Desa di ${filterValue}`);
    
    // Reset warna peta jika filter berubah
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
                label: title, 
                data: v, 
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: { 
            indexAxis: 'y', 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { ticks: { color: '#94a3b8', font: { size: 10 } } },
                x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
            }
        }
    });
}

function initMap() {
    if (map) return;
    // Pastikan di HTML ada <div id="map" style="height: 500px"></div>
    map = L.map('map').setView([-7.0252, 107.5197], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    fetch('kab-bandung.json')
        .then(res => res.json())
        .then(geoData => {
            geojsonLayer = L.geoJson(geoData, {
                style: styleMap,
                onEachFeature: (feature, layer) => {
                    const name = feature.properties.KECAMATAN || feature.properties.name;
                    layer.bindPopup(`<b>Kecamatan: ${name}</b>`);
                    layer.on('click', () => {
                        document.getElementById('filterKecamatan').value = name;
                        applyFilter();
                    });
                }
            }).addTo(map);
        })
        .catch(err => console.warn("File kab-bandung.json tidak ditemukan."));
}

function styleMap(feature) {
    const kecMap = feature.properties.KECAMATAN || feature.properties.name;
    const dataKec = allData.filter(row => row[2] && row[2].trim().toUpperCase() === kecMap.toUpperCase());
    const total = dataKec.reduce((acc, row) => acc + (parseInt(row[3]) || 0), 0);
    return {
        fillColor: total > 500 ? '#1e3a8a' : total > 0 ? '#3b82f6' : '#334155',
        weight: 1, color: 'white', fillOpacity: 0.7
    };
}

// Jalankan Dashboard
initDashboard();
