const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!A2:E281'; 

let allData = [];
let myChart = null;
let map = null;
let geojsonLayer = null;

// Indeks kolom sesuai data Anda
const idx = { desa: 1, kec: 2, dprt: 3, kader: 4 };

// Pastikan skrip berjalan setelah seluruh HTML (DOM) siap
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

async function initDashboard() {
    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`);
        const data = await response.json();
        
        if (!data.values) {
            console.error("Data Google Sheets tidak ditemukan.");
            return;
        }
        
        // Bersihkan dan format data
        allData = data.values.filter(row => row.length >= 3).map(row => ({
            desa: (row[idx.desa] || "").trim().toUpperCase(),
            kec: (row[idx.kec] || "").trim().toUpperCase(),
            dprt: parseInt(row[idx.dprt]) || 0,
            kader: parseInt(row[idx.kader]) || 0
        }));

        // Isi Dropdown Kecamatan
        const select = document.getElementById('filterKecamatan');
        const kecamatanList = [...new Set(allData.map(d => d.kec))].filter(val => val && isNaN(val)).sort();
        
        select.innerHTML = '<option value="ALL">KABUPATEN BANDUNG (SEMUA)</option>';
        kecamatanList.forEach(kec => {
            let opt = document.createElement('option');
            opt.value = kec;
            opt.textContent = kec;
            select.appendChild(opt);
        });

        // 1. Inisialisasi Peta Dahulu
        initMap();

    } catch (e) { 
        console.error("Error Dashboard Init:", e); 
    }
}

function initMap() {
    // Hindari inisialisasi ganda
    if (map) return;
    
    map = L.map('map', { zoomControl: true }).setView([-7.0252, 107.5197], 10);
    
    // Basemap terang agar poligon biru terlihat kontras
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    fetch('kab-bandung.json')
        .then(res => res.json())
        .then(geoData => {
            geojsonLayer = L.geoJson(geoData, {
                style: styleMap,
                onEachFeature: (feature, layer) => {
                    const props = feature.properties;
                    // Cek berbagai kemungkinan nama atribut di GeoJSON
                    const name = (props.KECAMATAN || props.name || props.NAMOBJ || "").toUpperCase().trim();
                    
                    const dataKec = allData.filter(d => d.kec === name);
                    const totalD = dataKec.reduce((acc, d) => acc + d.dprt, 0);
                    const totalK = dataKec.reduce((acc, d) => acc + d.kader, 0);

                    layer.bindPopup(`
                        <div style="color:#003366; font-family:sans-serif;">
                            <b style="font-size:14px;">KEC. ${name}</b><hr style="margin:5px 0">
                            DPRT: <b>${totalD}</b><br>
                            Kader: <b>${totalK}</b>
                        </div>
                    `);
                    
                    layer.on('click', () => {
                        document.getElementById('filterKecamatan').value = name;
                        applyFilter();
                    });
                }
            }).addTo(map);

            // 2. Jalankan applyFilter SETELAH GeoJSON berhasil dimuat
            applyFilter();
        })
        .catch(err => {
            console.error("File kab-bandung.json tidak ditemukan.");
            // Tetap jalankan filter agar chart dan angka muncul meski peta gagal
            applyFilter();
        });
}

function applyFilter() {
    const filterValue = document.getElementById('filterKecamatan').value;
    const filtered = filterValue === "ALL" ? allData : allData.filter(d => d.kec === filterValue);

    // Update Angka di Card
    document.getElementById('stat-dprt').innerText = filtered.reduce((acc, d) => acc + d.dprt, 0).toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = filtered.reduce((acc, d) => acc + d.kader, 0).toLocaleString('id-ID');

    // Update Visual Peta
    if (geojsonLayer) {
        geojsonLayer.eachLayer(layer => {
            const props = layer.feature.properties;
            const name = (props.KECAMATAN || props.name || props.NAMOBJ || "").toUpperCase().trim();
            
            if (filterValue === "ALL") {
                geojsonLayer.resetStyle(layer);
            } else if (name === filterValue) {
                layer.setStyle({ fillColor: '#0054a6', fillOpacity: 0.9, weight: 3, color: 'white' });
                layer.bringToFront();
                map.fitBounds(layer.getBounds(), { padding: [30, 30] });
            } else {
                layer.setStyle({ fillOpacity: 0.1, weight: 1, color: '#cbd5e1' });
            }
        });
    }

    // Update Chart
    updateChartUI(filterValue, filtered);
}

function updateChartUI(filterValue, filteredData) {
    const ctx = document.getElementById('panChart').getContext('2d');
    if (myChart) myChart.destroy();

    let labels, dprtVals, kaderVals;

    if (filterValue === "ALL") {
        const summary = {};
        allData.forEach(d => {
            if(!summary[d.kec]) summary[d.kec] = { d: 0, k: 0 };
            summary[d.kec].d += d.dprt;
            summary[d.kec].k += d.kader;
        });
        labels = Object.keys(summary);
        dprtVals = labels.map(l => summary[l].d);
        kaderVals = labels.map(l => summary[l].k);
    } else {
        labels = filteredData.map(d => d.desa);
        dprtVals = filteredData.map(d => d.dprt);
        kaderVals = filteredData.map(d => d.kader);
    }

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Kader', data: kaderVals, backgroundColor: '#f97316', borderRadius: 4, barThickness: 8 },
                { label: 'DPRT Aktif', data: dprtVals, backgroundColor: '#3b82f6', borderRadius: 4, barThickness: 8 }
            ]
        },
        options: {
            indexAxis: 'y',
            maintainAspectRatio: false,
            responsive: true,
            plugins: { 
                legend: { labels: { color: '#f1f5f9', font: { weight: 'bold' } } } 
            },
            scales: {
                y: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { display: false } },
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.1)' } }
            }
        }
    });
}

function styleMap(feature) {
    const props = feature.properties;
    const name = (props.KECAMATAN || props.name || props.NAMOBJ || "").toUpperCase().trim();
    const dataKec = allData.filter(d => d.kec === name);
    const total = dataKec.reduce((acc, d) => acc + d.dprt, 0);
    return { fillColor: getColor(total), weight: 1.5, color: 'white', fillOpacity: 0.7 };
}

function getColor(d) {
    return d > 1000 ? '#1e3a8a' : 
           d > 500  ? '#1d4ed8' : 
           d > 100  ? '#3b82f6' : 
           d > 0    ? '#93c5fd' : 
                      '#334155'; 
}
