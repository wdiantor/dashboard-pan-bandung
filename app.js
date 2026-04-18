/**
 * Dashboard Pemenangan PAN Kab. Bandung
 * Feature: Dapil Filter, Heatmap, & Leaderboard
 */

const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!A2:F500'; // Rentang diperluas ke kolom F (Dapil)

let allData = [];
let myChart = null;
let map = null;
let geojsonLayer = null;

// Kolom: ID(0), Desa(1), Kec(2), DPRT(3), Kader(4), Dapil(5)
const idx = { desa: 1, kec: 2, dprt: 3, kader: 4, dapil: 5 };

const cleanName = (str) => {
    return (str || "").toString()
        .toUpperCase()
        .replace(/KECAMATAN|KEC\./g, '')
        .replace(/[^A-Z0-9]/g, '')
        .trim();
};

// Fungsi warna Heatmap (Sesuaikan angka targetnya di sini)
function getHeatmapColor(kader) {
    return kader > 500 ? '#22c55e' : // Hijau (>500)
           kader > 200 ? '#eab308' : // Kuning (201-500)
                         '#ef4444';   // Merah (0-200)
}

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initDashboard();
});

function initMap() {
    if (map) return;
    map = L.map('map').setView([-7.0252, 107.5197], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    fetch('kab-bandung.json')
        .then(res => res.json())
        .then(geoData => {
            geojsonLayer = L.geoJson(geoData, {
                style: { color: "#2563eb", weight: 1.5, fillOpacity: 0.2, fillColor: "#3b82f6" },
                onEachFeature: (feature, layer) => {
                    layer.on('click', () => {
                        const p = feature.properties;
                        const name = p.NAME_3 || p.KECAMATAN || p.NAMOBJ;
                        if(name) {
                            document.getElementById('filterKecamatan').value = name.toUpperCase();
                            applyFilter();
                        }
                    });
                }
            }).addTo(map);
        }).catch(err => console.error("GeoJSON Load Error"));
}

async function initDashboard() {
    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`);
        const data = await response.json();
        
        if (!data.values) return;

        allData = data.values.map(row => {
            const parseNum = (val) => {
                if (!val) return 0;
                let clean = val.toString().replace(/[^0-9]/g, '');
                return parseInt(clean) || 0;
            };

            return {
                desa: (row[idx.desa] || "TANPA NAMA").toString().trim().toUpperCase(),
                kec: (row[idx.kec] || "").toString().trim().toUpperCase(),
                dapil: (row[idx.dapil] || "TIDAK ADA").toString().trim().toUpperCase(),
                dprt: parseNum(row[idx.dprt]),
                kader: parseNum(row[idx.kader])
            };
        }).filter(item => item.kec !== "");

        populateDapilDropdown();
        populateDropdown();
        applyFilter();
    } catch (e) { console.error("Sheets Data Error:", e); }
}

function populateDapilDropdown() {
    const select = document.getElementById('filterDapil');
    if (!select) return;
    const dapilList = [...new Set(allData.map(d => d.dapil))].sort();
    select.innerHTML = '<option value="ALL">SEMUA DAPIL</option>';
    dapilList.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d; opt.textContent = d;
        select.appendChild(opt);
    });
    select.addEventListener('change', () => {
        document.getElementById('filterKecamatan').value = 'ALL';
        applyFilter();
    });
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
    const dapilValue = document.getElementById('filterDapil').value;
    const kecValue = document.getElementById('filterKecamatan').value;

    let filtered = allData;
    if (dapilValue !== "ALL") filtered = filtered.filter(d => d.dapil === dapilValue);
    if (kecValue !== "ALL") filtered = filtered.filter(d => d.kec === kecValue);

    // Update Counter
    document.getElementById('stat-dprt').innerText = filtered.reduce((acc, d) => acc + d.dprt, 0).toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = filtered.reduce((acc, d) => acc + d.kader, 0).toLocaleString('id-ID');

    // Logic Heatmap & Zoom
    if (geojsonLayer) {
        let targetLayer = null;
        const kecClean = cleanName(kecValue);

        geojsonLayer.eachLayer(layer => {
            const p = layer.feature.properties;
            const geoName = cleanName(p.NAME_3 || p.KECAMATAN || p.NAMOBJ);
            
            // Hitung kekuatan per kecamatan untuk Heatmap
            const kecStats = allData.filter(d => cleanName(d.kec) === geoName);
            const totalKaderKec = kecStats.reduce((acc, d) => acc + d.kader, 0);

            if (kecValue === "ALL") {
                layer.setStyle({
                    fillColor: getHeatmapColor(totalKaderKec),
                    fillOpacity: 0.5,
                    weight: 1,
                    color: '#fff'
                });
            } else if (geoName === kecClean) {
                targetLayer = layer;
                layer.setStyle({ fillColor: '#f97316', fillOpacity: 0.8, weight: 3, color: 'white' });
                layer.bringToFront();
            } else {
                layer.setStyle({ fillOpacity: 0.05, weight: 1, color: '#94a3b8' });
            }
        });

        if (targetLayer) {
            map.fitBounds(targetLayer.getBounds(), { padding: [50, 50] });
        } else if (kecValue === "ALL") {
            map.setView([-7.0252, 107.5197], 10);
        }
    }

    updateLeaderboard(filtered);
    updateChartUI(kecValue, filtered);
}

function updateLeaderboard(data) {
    const sorted = [...data].sort((a, b) => b.kader - a.kader);
    const top5 = sorted.slice(0, 5);
    const bottom5 = sorted.slice(-5).reverse();

    const render = (list, containerId, colorClass) => {
        const container = document.getElementById(containerId);
        if(!container) return;
        container.innerHTML = list.map((d, i) => `
            <div class="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/10">
                <span class="text-sm"><b class="${colorClass}">#${i+1}</b> ${d.desa}</span>
                <span class="font-bold">${d.kader.toLocaleString()}</span>
            </div>
        `).join('');
    };

    render(top5, 'top-leaderboard', 'text-emerald-400');
    render(bottom5, 'bottom-leaderboard', 'text-rose-400');
}

function updateChartUI(filterValue, filteredData) {
    const canvas = document.getElementById('panChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (myChart) myChart.destroy();

    let labels = [], dprtVals = [], kaderVals = [];

    if (filterValue === "ALL") {
        const summary = {};
        filteredData.forEach(d => {
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
