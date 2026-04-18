/**
 * Dashboard Pemenangan PAN Kab. Bandung
 * Final Fix: Zoom Teritorial & Detail Per-Desa
 */

const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!A2:E500'; 

let allData = [];
let myChart = null;
let map = null;
let geojsonLayer = null;

// Sesuai tabel: ID(0), Desa(1), Kec(2), DPRT(3), Kader(4)
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
                kecClean: cleanName(row[idx.kec]),
                dprt: parseNum(row[idx.dprt]),
                kader: parseNum(row[idx.kader])
            };
        }).filter(item => item.kec !== "");

        initMap(); 
        populateDropdown();
        // applyFilter dipanggil di dalam fetch GeoJSON agar memastikan layer sudah ada
    } catch (e) { console.error("Error Dashboard:", e); }
}

function initMap() {
    if (map) return;
    // Koordinat tengah Kabupaten Bandung
    map = L.map('map').setView([-7.0252, 107.5197], 10);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    fetch('kab-bandung.json')
        .then(res => res.json())
        .then(geoData => {
            geojsonLayer = L.geoJson(geoData, {
                style: { 
                    color: "#2563eb", 
                    weight: 1.5, 
                    fillOpacity: 0.1, 
                    fillColor: "#3b82f6" 
                },
                onEachFeature: (feature, layer) => {
                    layer.on('click', () => {
                        const rawName = feature.properties.NAME_3 || feature.properties.KECAMATAN || feature.properties.NAMOBJ;
                        document.getElementById('filterKecamatan').value = rawName.toUpperCase();
                        applyFilter();
                    });
                }
            }).addTo(map);
            
            // Panggil filter pertama kali setelah peta & GeoJSON siap
            applyFilter();
        });
}

function populateDropdown() {
    const select = document.getElementById('filterKecamatan');
    const kecamatanList = [...new Set(allData.map(d => d.kec))].sort();
    
    select.innerHTML = '<option value="ALL">SEMUA KECAMATAN</option>';
    kecamatanList.forEach(kec => {
        const opt = document.createElement('option');
        opt.value = kec;
        opt.textContent = kec;
        select.appendChild(opt);
    });
    select.addEventListener('change', applyFilter);
}

function applyFilter() {
    const filterValue = document.getElementById('filterKecamatan').value;
    const filtered = filterValue === "ALL" ? allData : allData.filter(d => d.kec === filterValue);

    // 1. Update Counter UI
    document.getElementById('stat-dprt').innerText = filtered.reduce((acc, d) => acc + d.dprt, 0).toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = filtered.reduce((acc, d) => acc + d.kader, 0).toLocaleString('id-ID');

    // 2. Logika Zoom & Visual Teritorial
    if (geojsonLayer) {
        const filterClean = cleanName(filterValue);
        let targetLayer = null;

        geojsonLayer.eachLayer(layer => {
            const props = layer.feature.properties;
            const nameClean = cleanName(props.NAME_3 || props.KECAMATAN || props.NAMOBJ);
            
            if (filterValue === "ALL") {
                geojsonLayer.resetStyle(layer);
            } else if (nameClean === filterClean) {
                targetLayer = layer; 
                // Highlight warna Orange PAN untuk kecamatan terpilih
                layer.setStyle({ 
                    fillColor: '#f97316', 
                    fillOpacity: 0.7, 
                    weight: 3, 
                    color: 'white' 
                });
                layer.bringToFront();
            } else {
                // Pudarkan wilayah lain agar fokus
                layer.setStyle({ 
                    fillOpacity: 0.05, 
                    weight: 1, 
                    color: '#94a3b8' 
                });
            }
        });

        if (targetLayer) {
            map.fitBounds(targetLayer.getBounds(), { padding: [50, 50], animate: true });
        } else if (filterValue === "ALL") {
            map.setView([-7.0252, 107.5197], 10);
        }
    }

    // 3. Update Grafik
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
        // Sortir Desa berdasarkan Kader terbanyak
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
                { 
                    label: 'DPRT Aktif', 
                    data: dprtVals, 
                    backgroundColor: '#0054a6',
                    barThickness: labels.length > 15 ? 10 : 20 
                },
                { 
                    label: 'Total Kader', 
                    data: kaderVals, 
                    backgroundColor: '#f97316',
                    barThickness: labels.length > 15 ? 10 : 20
                }
            ]
        },
        options: {
            indexAxis: 'y',
            maintainAspectRatio: false,
            responsive: true,
            plugins: { 
                legend: { labels: { color: '#fff', font: { size: 12 } } } 
            },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                y: { ticks: { color: '#fff', font: { size: 10 } }, grid: { display: false } }
            }
        }
    });
}
