/**
 * Dashboard Pemenangan PAN Kab. Bandung
 * Logic Engine - app.js
 */

const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!A2:E281'; 

let allData = [];
let myChart = null;
let map = null;
let geojsonLayer = null;

// Indeks kolom berdasarkan Google Sheets Anda (A=0, B=1, dst)
const idx = { desa: 1, kec: 2, dprt: 3, kader: 4 };

// Fungsi pembantu untuk membersihkan nama agar pencocokan akurat (Case-Insensitive & No-Space)
const cleanName = (str) => (str || "").toString().toUpperCase().replace(/[^A-Z0-9]/g, '').trim();

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

async function initDashboard() {
    try {
        // 1. Fetch Data dari Google Sheets
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`);
        const data = await response.json();
        
        if (!data.values) {
            console.error("Data Google Sheets kosong atau tidak ditemukan.");
            return;
        }
        
        allData = data.values.filter(row => row.length >= 3).map(row => ({
            desa: (row[idx.desa] || "").trim().toUpperCase(),
            kec: (row[idx.kec] || "").trim().toUpperCase(),
            kecClean: cleanName(row[idx.kec]), 
            dprt: parseInt(row[idx.dprt]) || 0,
            kader: parseInt(row[idx.kader]) || 0
        }));

        // 2. Isi Dropdown Kecamatan secara Otomatis
        const select = document.getElementById('filterKecamatan');
        const kecamatanList = [...new Set(allData.map(d => d.kec))].filter(val => val && isNaN(val)).sort();
        
        select.innerHTML = '<option value="ALL">KABUPATEN BANDUNG (SEMUA)</option>';
        kecamatanList.forEach(kec => {
            let opt = document.createElement('option');
            opt.value = kec;
            opt.textContent = kec;
            select.appendChild(opt);
        });

        // 3. Inisialisasi Peta
        initMap();

        // Tambahkan Event Listener ke Dropdown
        select.addEventListener('change', applyFilter);

    } catch (e) { 
        console.error("Gagal menginisialisasi Dashboard:", e); 
    }
}

function initMap() {
    if (map) return;
    // Koordinat Soreang, Kab. Bandung
    map = L.map('map').setView([-7.0252, 107.5197], 11);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // 4. Fetch GeoJSON Lokal
    fetch('kab-bandung.json')
        .then(res => res.json())
        .then(geoData => {
            geojsonLayer = L.geoJson(geoData, {
                style: styleMap,
                onEachFeature: (feature, layer) => {
                    const props = feature.properties;
                    // Deteksi properti nama kecamatan di JSON (mendukung NAME_3 atau KECAMATAN)
                    const rawName = props.NAME_3 || props.KECAMATAN || props.NAMOBJ || "";
                    const jsonKecClean = cleanName(rawName);
                    
                    const dataKec = allData.filter(d => d.kecClean === jsonKecClean);
                    const totalD = dataKec.reduce((acc, d) => acc + d.dprt, 0);
                    const totalK = dataKec.reduce((acc, d) => acc + d.kader, 0);

                    layer.bindPopup(`
                        <div style="font-family:'Plus Jakarta Sans',sans-serif; min-width:160px">
                            <b style="color:#0054a6; font-size:14px">KEC. ${rawName.toUpperCase()}</b>
                            <hr style="margin:8px 0; border:0; border-top:1px solid #eee">
                            <div style="display:flex; justify-content:space-between; margin-bottom:4px">
                                <span>DPRT Aktif:</span> <b>${totalD}</b>
                            </div>
                            <div style="display:flex; justify-content:space-between">
                                <span>Total Kader:</span> <b>${totalK}</b>
                            </div>
                        </div>
                    `);
                    
                    layer.on('click', () => {
                        const originalKecName = dataKec.length > 0 ? dataKec[0].kec : "ALL";
                        document.getElementById('filterKecamatan').value = originalKecName;
                        applyFilter();
                    });

                    // Efek Hover
                    layer.on('mouseover', () => {
                        layer.setStyle({ weight: 3, color: '#f97316', fillOpacity: 0.9 });
                    });
                    layer.on('mouseout', () => {
                        geojsonLayer.resetStyle(layer);
                    });
                }
            }).addTo(map);
            applyFilter();
        });
}

function applyFilter() {
    const filterValue = document.getElementById('filterKecamatan').value;
    const filtered = filterValue === "ALL" ? allData : allData.filter(d => d.kec === filterValue);

    // Update Counter di UI
    document.getElementById('stat-dprt').innerText = filtered.reduce((acc, d) => acc + d.dprt, 0).toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = filtered.reduce((acc, d) => acc + d.kader, 0).toLocaleString('id-ID');

    // Update Highlight di Peta
    if (geojsonLayer) {
        const filterClean = cleanName(filterValue);
        geojsonLayer.eachLayer(layer => {
            const props = layer.feature.properties;
            const nameClean = cleanName(props.NAME_3 || props.KECAMATAN || props.NAMOBJ);
            
            if (filterValue === "ALL") {
                geojsonLayer.resetStyle(layer);
            } else if (nameClean === filterClean) {
                layer.setStyle({ fillColor: '#0054a6', fillOpacity: 0.9, weight: 3, color: 'white' });
                layer.bringToFront();
                map.fitBounds(layer.getBounds(), { padding: [50, 50] });
            } else {
                layer.setStyle({ fillOpacity: 0.1, weight: 1, color: '#cbd5e1' });
            }
        });
    }

    updateChartUI(filterValue, filtered);
}

function updateChartUI(filterValue, filteredData) {
    const ctx = document.getElementById('panChart').getContext('2d');
    if (myChart) myChart.destroy();

    let labels, dprtVals, kaderVals;

    if (filterValue === "ALL") {
        // Tampilkan agregat per Kecamatan
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
        // Tampilkan detail per Desa di kecamatan tersebut
        labels = filteredData.map(d => d.desa);
        dprtVals = filteredData.map(d => d.dprt);
        kaderVals = filteredData.map(d => d.kader);
    }

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Kader', data: kaderVals, backgroundColor: '#f97316', borderRadius: 4 },
                { label: 'DPRT', data: dprtVals, backgroundColor: '#0054a6', borderRadius: 4 }
            ]
        },
        options: {
            indexAxis: 'y',
            maintainAspectRatio: false,
            responsive: true,
            plugins: { 
                legend: { position: 'top', labels: { color: '#fff', font: { family: 'Plus Jakarta Sans' } } } 
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
    const nameClean = cleanName(props.NAME_3 || props.KECAMATAN || props.NAMOBJ);
    const dataKec = allData.filter(d => d.kecClean === nameClean);
    const total = dataKec.reduce((acc, d) => acc + d.kader, 0); // Warna berdasarkan jumlah kader
    return { 
        fillColor: getColor(total), 
        weight: 1.5, 
        color: 'white', 
        fillOpacity: 0.7 
    };
}

function getColor(d) {
    return d > 1000 ? '#1e3a8a' : 
           d > 500  ? '#1d4ed8' : 
           d > 100  ? '#3b82f6' : 
           d > 0    ? '#93c5fd' : '#334155';
}
