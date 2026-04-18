/**
 * Dashboard Pemenangan PAN Kab. Bandung
 * Logic Engine - app.js (Optimized)
 */

const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!A2:E281'; 

let allData = [];
let myChart = null;
let map = null;
let geojsonLayer = null;

// Indeks kolom (A=0, B=1, dst)
const idx = { desa: 1, kec: 2, dprt: 3, kader: 4 };

// Helper: Membersihkan string untuk pencocokan (Normalize)
const cleanName = (str) => (str || "").toString().toUpperCase().replace(/[^A-Z0-9]/g, '').trim();

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

async function initDashboard() {
    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`);
        const data = await response.json();
        
        if (!data.values) {
            console.error("Data tidak ditemukan di Google Sheets.");
            return;
        }
        
        // Map data & parsing angka
        allData = data.values.filter(row => row.length >= 3).map(row => ({
            desa: (row[idx.desa] || "").trim().toUpperCase(),
            kec: (row[idx.kec] || "").trim().toUpperCase(),
            kecClean: cleanName(row[idx.kec]), 
            dprt: parseInt(row[idx.dprt]) || 0,
            kader: parseInt(row[idx.kader]) || 0
        }));

        // Inisialisasi Dropdown
        populateDropdown();
        
        // Inisialisasi Peta & Chart
        initMap();

    } catch (e) { 
        console.error("Gagal inisialisasi:", e); 
    }
}

function populateDropdown() {
    const select = document.getElementById('filterKecamatan');
    const kecamatanList = [...new Set(allData.map(d => d.kec))]
                            .filter(val => val && isNaN(val))
                            .sort();
    
    select.innerHTML = '<option value="ALL">KABUPATEN BANDUNG (SEMUA)</option>';
    kecamatanList.forEach(kec => {
        const opt = document.createElement('option');
        opt.value = kec;
        opt.textContent = kec;
        select.appendChild(opt);
    });

    select.addEventListener('change', applyFilter);
}

function initMap() {
    if (map) return;
    
    // Titik pusat Kab. Bandung
    map = L.map('map').setView([-7.0252, 107.5197], 10);
    
    L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OSM'
    }).addTo(map);

    fetch('kab-bandung.json')
        .then(res => res.json())
        .then(geoData => {
            geojsonLayer = L.geoJson(geoData, {
                style: styleMap,
                onEachFeature: (feature, layer) => {
                    const props = feature.properties;
                    const rawName = props.NAME_3 || props.KECAMATAN || props.NAMOBJ || "Unknown";
                    const jsonKecClean = cleanName(rawName);
                    
                    const dataKec = allData.filter(d => d.kecClean === jsonKecClean);
                    const totalD = dataKec.reduce((acc, d) => acc + d.dprt, 0);
                    const totalK = dataKec.reduce((acc, d) => acc + d.kader, 0);

                    layer.bindPopup(`
                        <div style="font-family:'Plus Jakarta Sans',sans-serif; min-width:150px">
                            <b style="color:#0054a6">KEC. ${rawName.toUpperCase()}</b>
                            <hr style="margin:5px 0; border:0; border-top:1px solid #eee">
                            DPRT: <b>${totalD}</b><br>
                            Kader: <b>${totalK}</b>
                        </div>
                    `);
                    
                    layer.on('click', () => {
                        const match = allData.find(d => d.kecClean === jsonKecClean);
                        document.getElementById('filterKecamatan').value = match ? match.kec : "ALL";
                        applyFilter();
                    });

                    layer.on('mouseover', () => {
                        layer.setStyle({ weight: 3, color: '#f97316', fillOpacity: 0.8 });
                    });
                    layer.on('mouseout', () => {
                        geojsonLayer.resetStyle(layer);
                    });
                }
            }).addTo(map);
            
            // Jalankan filter pertama kali untuk sinkronisasi UI
            applyFilter();
        })
        .catch(err => console.warn("GeoJSON tidak ditemukan, peta tetap tampil polos.", err));
}

function applyFilter() {
    const filterValue = document.getElementById('filterKecamatan').value;
    const filtered = filterValue === "ALL" ? allData : allData.filter(d => d.kec === filterValue);

    // 1. Update Stat Cards
    document.getElementById('stat-dprt').innerText = filtered.reduce((acc, d) => acc + d.dprt, 0).toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = filtered.reduce((acc, d) => acc + d.kader, 0).toLocaleString('id-ID');

    // 2. Update Map Style & View
    if (geojsonLayer) {
        const filterClean = cleanName(filterValue);
        geojsonLayer.eachLayer(layer => {
            const nameClean = cleanName(layer.feature.properties.NAME_3 || layer.feature.properties.KECAMATAN || layer.feature.properties.NAMOBJ);
            
            if (filterValue === "ALL") {
                geojsonLayer.resetStyle(layer);
            } else if (nameClean === filterClean) {
                layer.setStyle({ fillColor: '#0054a6', fillOpacity: 0.8, weight: 3, color: '#fff' });
                layer.bringToFront();
                map.fitBounds(layer.getBounds(), { padding: [30, 30] });
            } else {
                layer.setStyle({ fillOpacity: 0.05, weight: 1, color: '#ccc' });
            }
        });
    }

    // 3. Update Chart
    updateChartUI(filterValue, filtered);
}

function updateChartUI(filterValue, filteredData) {
    const canvas = document.getElementById('panChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (myChart) myChart.destroy();

    let chartData = [];

    if (filterValue === "ALL") {
        // Agregat per Kecamatan
        const summary = {};
        allData.forEach(d => {
            if(!summary[d.kec]) summary[d.kec] = { d: 0, k: 0 };
            summary[d.kec].d += d.dprt;
            summary[d.kec].k += d.kader;
        });
        chartData = Object.keys(summary).map(k => ({
            label: k,
            dprt: summary[k].d,
            kader: summary[k].k
        }));
    } else {
        // Detail per Desa
        chartData = filteredData.map(d => ({
            label: d.desa,
            dprt: d.dprt,
            kader: d.kader
        }));
    }

    // Sortir: Kader terbanyak di atas
    chartData.sort((a, b) => b.kader - a.kader);

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.map(i => i.label),
            datasets: [
                { label: 'Kader', data: chartData.map(i => i.kader), backgroundColor: '#f97316' },
                { label: 'DPRT', data: chartData.map(i => i.dprt), backgroundColor: '#0054a6' }
            ]
        },
        options: {
            indexAxis: 'y',
            maintainAspectRatio: false,
            responsive: true,
            plugins: { 
                legend: { labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } } } 
            },
            scales: {
                y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

function styleMap(feature) {
    const nameClean = cleanName(feature.properties.NAME_3 || feature.properties.KECAMATAN || feature.properties.NAMOBJ);
    const dataKec = allData.filter(d => d.kecClean === nameClean);
    const total = dataKec.reduce((acc, d) => acc + d.kader, 0);
    
    return { 
        fillColor: getColor(total), 
        weight: 1, 
        color: 'white', 
        fillOpacity: 0.7 
    };
}

function getColor(d) {
    return d > 1000 ? '#1e3a8a' : 
           d > 500  ? '#2563eb' : 
           d > 100  ? '#60a5fa' : 
           d > 0    ? '#bfdbfe' : '#334155';
}
