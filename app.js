/**
 * Dashboard Pemenangan PAN Kab. Bandung
 * Ultra-Fix: Auto-Matching GeoJSON & Zoom
 */

const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!A2:E500'; 

let allData = [];
let myChart = null;
let map = null;
let geojsonLayer = null;

const idx = { desa: 1, kec: 2, dprt: 3, kader: 4 };

const cleanName = (str) => (str || "").toString().toUpperCase().replace(/[^A-Z0-9]/g, '').trim();

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

async function initDashboard() {
    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`);
        const data = await response.json();
        
        if (!data.values) return;

        allData = data.values.map(row => {
            const parseNum = (val) => {
                if (!val) return 0;
                return parseInt(val.toString().replace(/\./g, '').replace(/,/g, '')) || 0;
            };
            return {
                desa: (row[idx.desa] || "").trim().toUpperCase(),
                kec: (row[idx.kec] || "").trim().toUpperCase(),
                dprt: parseNum(row[idx.dprt]),
                kader: parseNum(row[idx.kader])
            };
        }).filter(item => item.kec !== "");

        initMap(); 
        populateDropdown();
    } catch (e) { console.error("Gagal Load Data:", e); }
}

function initMap() {
    if (map) return;
    map = L.map('map').setView([-7.0252, 107.5197], 10);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    fetch('kab-bandung.json')
        .then(res => res.json())
        .then(geoData => {
            geojsonLayer = L.geoJson(geoData, {
                style: { color: "#2563eb", weight: 1.5, fillOpacity: 0.1, fillColor: "#3b82f6" },
                onEachFeature: (feature, layer) => {
                    layer.on('click', () => {
                        // Cek semua kemungkinan label nama kecamatan di file JSON
                        const p = feature.properties;
                        const rawName = p.NAME_3 || p.KECAMATAN || p.NAMOBJ || p.name;
                        if(rawName) {
                            document.getElementById('filterKecamatan').value = rawName.toUpperCase();
                            applyFilter();
                        }
                    });
                }
            }).addTo(map);
            applyFilter();
        }).catch(err => console.error("File kab-bandung.json tidak ditemukan atau rusak!"));
}

function populateDropdown() {
    const select = document.getElementById('filterKecamatan');
    const kecamatanList = [...new Set(allData.map(d => d.kec))].sort();
    select.innerHTML = '<option value="ALL">SEMUA KECAMATAN</option>';
    kecamatanList.forEach(kec => {
        const opt = document.createElement('option');
        opt.value = kec; opt.textContent = kec;
        select.appendChild(opt);
    });
    select.addEventListener('change', applyFilter);
}

function applyFilter() {
    const filterValue = document.getElementById('filterKecamatan').value;
    const filtered = filterValue === "ALL" ? allData : allData.filter(d => d.kec === filterValue);

    // Update Angka
    document.getElementById('stat-dprt').innerText = filtered.reduce((acc, d) => acc + d.dprt, 0).toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = filtered.reduce((acc, d) => acc + d.kader, 0).toLocaleString('id-ID');

    if (geojsonLayer) {
        let targetLayer = null;
        const filterClean = cleanName(filterValue);

        geojsonLayer.eachLayer(layer => {
            const p = layer.feature.properties;
            // Deteksi otomatis label nama di JSON
            const nameFromGeojson = cleanName(p.NAME_3 || p.KECAMATAN || p.NAMOBJ || p.name);

            if (filterValue === "ALL") {
                geojsonLayer.resetStyle(layer);
            } else if (nameFromGeojson === filterClean) {
                targetLayer = layer;
                layer.setStyle({ fillColor: '#f97316', fillOpacity: 0.7, weight: 3, color: 'white' });
                layer.bringToFront();
            } else {
                layer.setStyle({ fillOpacity: 0.05, weight: 1, color: '#94a3b8' });
            }
        });

        if (targetLayer) {
            map.fitBounds(targetLayer.getBounds(), { padding: [50, 50], animate: true });
        } else if (filterValue === "ALL") {
            map.setView([-7.0252, 107.5197], 10);
        }
    }
    updateChartUI(filterValue, filtered);
}

function updateChartUI(filterValue, filteredData) {
    const ctx = document.getElementById('panChart').getContext('2d');
    if (myChart) myChart.destroy();

    let labels = [], dprtVals = [], kaderVals = [];

    if (filterValue === "ALL") {
        const summary = {};
        allData.forEach(d => {
            if(!summary[d.kec]) summary[d.kec] = { d: 0, k: 0 };
            summary[d.kec].d += d.dprt;
            summary[d.kec].k += d.kader;
        });
        labels = Object.keys(summary).sort();
        dprtVals = labels.map(l => summary[l].d);
        kaderVals = labels.map(l => summary[l].k);
    } else {
        const sorted = [...filteredData].sort((a, b) => b.kader - a.kader);
        labels = sorted.map(d => d.desa);
        dprtVals = sorted.map(d => d.dprt);
        kaderVals = sorted.map(d => d.kader);
    }

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'DPRT Aktif', data: dprtVals, backgroundColor: '#0054a6' },
                { label: 'Total Kader', data: kaderVals, backgroundColor: '#f97316' }
            ]
        },
        options: {
            indexAxis: 'y',
            maintainAspectRatio: false,
            scales: {
                y: { ticks: { color: '#fff', font: { size: 10 } } },
                x: { ticks: { color: '#94a3b8' } }
            },
            plugins: { legend: { labels: { color: '#fff' } } }
        }
    });
}
