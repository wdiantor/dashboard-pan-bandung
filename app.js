const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!A2:E281'; 

let allData = [];
let myChart = null;
let map = null;
let geojsonLayer = null;

const idx = { desa: 1, kec: 2, dprt: 3, kader: 4 };

// Fungsi pembantu untuk membersihkan nama agar pencocokan akurat
const cleanName = (str) => (str || "").toString().toUpperCase().replace(/[^A-Z0-9]/g, '').trim();

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

async function initDashboard() {
    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`);
        const data = await response.json();
        
        if (!data.values) return;
        
        allData = data.values.filter(row => row.length >= 3).map(row => ({
            desa: (row[idx.desa] || "").trim().toUpperCase(),
            kec: (row[idx.kec] || "").trim().toUpperCase(),
            kecClean: cleanName(row[idx.kec]), // Versi bersih untuk pencocokan
            dprt: parseInt(row[idx.dprt]) || 0,
            kader: parseInt(row[idx.kader]) || 0
        }));

        const select = document.getElementById('filterKecamatan');
        const kecamatanList = [...new Set(allData.map(d => d.kec))].filter(val => val && isNaN(val)).sort();
        
        select.innerHTML = '<option value="ALL">KABUPATEN BANDUNG (SEMUA)</option>';
        kecamatanList.forEach(kec => {
            let opt = document.createElement('option');
            opt.value = kec;
            opt.textContent = kec;
            select.appendChild(opt);
        });

        initMap();

    } catch (e) { console.error("Error:", e); }
}

function initMap() {
    if (map) return;
    map = L.map('map').setView([-7.0252, 107.5197], 10);
    
    // Gunakan basemap standar tanpa filter CSS invert
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    fetch('kab-bandung.json')
        .then(res => res.json())
        .then(geoData => {
            geojsonLayer = L.geoJson(geoData, {
                style: styleMap,
                onEachFeature: (feature, layer) => {
                    const props = feature.properties;
                    // Ambil nama dari JSON dan bersihkan
                    const rawName = props.KECAMATAN || props.NAMOBJ || props.name || "";
                    const jsonKecClean = cleanName(rawName);
                    
                    // Cari data di Sheets yang kecClean-nya cocok
                    const dataKec = allData.filter(d => d.kecClean === jsonKecClean);
                    const totalD = dataKec.reduce((acc, d) => acc + d.dprt, 0);
                    const totalK = dataKec.reduce((acc, d) => acc + d.kader, 0);

                    layer.bindPopup(`
                        <div style="font-family:sans-serif; min-width:150px">
                            <b style="color:#0054a6; font-size:14px">KEC. ${rawName.toUpperCase()}</b><hr style="margin:5px 0">
                            DPRT Aktif: <b>${totalD}</b><br>
                            Total Kader: <b>${totalK}</b>
                        </div>
                    `);
                    
                    layer.on('click', () => {
                        // Cari nama asli di Sheets untuk filter dropdown
                        const originalKecName = dataKec.length > 0 ? dataKec[0].kec : "ALL";
                        document.getElementById('filterKecamatan').value = originalKecName;
                        applyFilter();
                    });
                }
            }).addTo(map);
            applyFilter();
        });
}

function applyFilter() {
    const filterValue = document.getElementById('filterKecamatan').value;
    const filtered = filterValue === "ALL" ? allData : allData.filter(d => d.kec === filterValue);

    document.getElementById('stat-dprt').innerText = filtered.reduce((acc, d) => acc + d.dprt, 0).toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = filtered.reduce((acc, d) => acc + d.kader, 0).toLocaleString('id-ID');

    if (geojsonLayer) {
        const filterClean = cleanName(filterValue);
        geojsonLayer.eachLayer(layer => {
            const props = layer.feature.properties;
            const nameClean = cleanName(props.KECAMATAN || props.NAMOBJ || props.name);
            
            if (filterValue === "ALL") {
                geojsonLayer.resetStyle(layer);
            } else if (nameClean === filterClean) {
                layer.setStyle({ fillColor: '#0054a6', fillOpacity: 0.9, weight: 3, color: 'white' });
                layer.bringToFront();
                map.fitBounds(layer.getBounds(), { padding: [30, 30] });
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
                { label: 'Kader', data: kaderVals, backgroundColor: '#f97316', borderRadius: 4 },
                { label: 'DPRT', data: dprtVals, backgroundColor: '#0054a6', borderRadius: 4 }
            ]
        },
        options: {
            indexAxis: 'y',
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#fff' } } },
            scales: {
                y: { ticks: { color: '#94a3b8', font: { size: 9 } } },
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.1)' } }
            }
        }
    });
}

function styleMap(feature) {
    const props = feature.properties;
    const nameClean = cleanName(props.KECAMATAN || props.NAMOBJ || props.name);
    const dataKec = allData.filter(d => d.kecClean === nameClean);
    const total = dataKec.reduce((acc, d) => acc + d.dprt, 0);
    return { fillColor: getColor(total), weight: 1.5, color: 'white', fillOpacity: 0.7 };
}

function getColor(d) {
    return d > 1000 ? '#1e3a8a' : d > 500 ? '#1d4ed8' : d > 100 ? '#3b82f6' : d > 0 ? '#93c5fd' : '#334155';
}
