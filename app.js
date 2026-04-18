const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!A2:E281'; 

let allData = [];
let myChart = null;
let map = null;
let geojsonLayer = null;

// Indeks Kolom: 1:Desa, 2:Kecamatan, 3:DPRT, 4:Kader
const idx = { desa: 1, kec: 2, dprt: 3, kader: 4 };

async function initDashboard() {
    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`);
        const data = await response.json();
        
        if (!data.values) return;
        
        allData = data.values.filter(row => row.length >= 3).map(row => {
            if(row[idx.kec]) row[idx.kec] = row[idx.kec].trim().toUpperCase();
            if(row[idx.desa]) row[idx.desa] = row[idx.desa].trim().toUpperCase();
            return row;
        });

        const select = document.getElementById('filterKecamatan');
        const kecamatanList = [...new Set(allData.map(row => row[idx.kec]))]
            .filter(val => val && isNaN(val))
            .sort();
        
        select.innerHTML = '<option value="ALL">KABUPATEN BANDUNG (SEMUA)</option>';
        kecamatanList.forEach(kec => {
            let opt = document.createElement('option');
            opt.value = kec;
            opt.textContent = kec;
            select.appendChild(opt);
        });

        initMap(); // Inisialisasi peta dulu agar geojsonLayer siap
        applyFilter();

    } catch (e) { 
        console.error("Error load data:", e); 
    }
}

function applyFilter() {
    const filterValue = document.getElementById('filterKecamatan').value;
    
    const filtered = filterValue === "ALL" 
        ? allData 
        : allData.filter(row => row[idx.kec] === filterValue);

    // 1. Update Statistik Atas
    const totalDPRT = filtered.reduce((acc, row) => acc + (parseInt(row[idx.dprt]) || 0), 0);
    const totalKader = filtered.reduce((acc, row) => acc + (parseInt(row[idx.kader]) || 0), 0);
    
    document.getElementById('stat-dprt').innerText = totalDPRT.toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = totalKader.toLocaleString('id-ID');

    // 2. Logika Update Peta (Zoom & Highlight)
    if (geojsonLayer) {
        geojsonLayer.eachLayer(layer => {
            const name = (layer.feature.properties.KECAMATAN || layer.feature.properties.name || layer.feature.properties.NAMOBJ || "").toUpperCase().trim();
            
            if (filterValue === "ALL") {
                geojsonLayer.resetStyle(layer);
                map.setView([-7.0252, 107.5197], 10);
            } else if (name === filterValue) {
                layer.setStyle({
                    fillColor: '#0054a6', // Biru pekat saat dipilih
                    fillOpacity: 0.9,
                    weight: 3,
                    color: 'white'
                });
                layer.bringToFront();
                map.fitBounds(layer.getBounds(), { padding: [20, 20] });
            } else {
                layer.setStyle({
                    fillOpacity: 0.1,
                    weight: 1,
                    color: '#cbd5e1'
                });
            }
        });
    }

    // 3. Update Grafik
    let labels = [], dprtVals = [], kaderVals = [];
    if (filterValue === "ALL") {
        const summary = {};
        allData.forEach(row => {
            const kec = row[idx.kec];
            if(kec) {
                if(!summary[kec]) summary[kec] = { d: 0, k: 0 };
                summary[kec].d += (parseInt(row[idx.dprt]) || 0);
                summary[kec].k += (parseInt(row[idx.kader]) || 0);
            }
        });
        labels = Object.keys(summary);
        dprtVals = labels.map(l => summary[l].d);
        kaderVals = labels.map(l => summary[l].k);
    } else {
        labels = filtered.map(row => row[idx.desa]);
        dprtVals = filtered.map(row => parseInt(row[idx.dprt]) || 0);
        kaderVals = filtered.map(row => parseInt(row[idx.kader]) || 0);
    }

    renderChart(labels, dprtVals, kaderVals);
}

function renderChart(labels, dprtData, kaderData) {
    const ctx = document.getElementById('panChart').getContext('2d');
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Kader',
                    data: kaderData,
                    backgroundColor: '#f97316',
                    borderRadius: 4,
                    barThickness: 8
                },
                {
                    label: 'DPRT Aktif',
                    data: dprtData,
                    backgroundColor: '#0054a6',
                    borderRadius: 4,
                    barThickness: 8
                }
            ]
        },
        options: {
            indexAxis: 'y',
            maintainAspectRatio: false,
            responsive: true,
            plugins: { 
                legend: { 
                    display: true, 
                    labels: { color: '#1e293b', font: { weight: 'bold' } } 
                }
            },
            scales: {
                y: { ticks: { color: '#1e293b', font: { size: 10, weight: 'bold' } }, grid: { display: false } },
                x: { ticks: { color: '#1e293b' }, grid: { color: 'rgba(0,0,0,0.05)' } }
            }
        }
    });
}

function initMap() {
    if (map) return;
    map = L.map('map', { zoomControl: true }).setView([-7.0252, 107.5197], 10);
    
    // Basemap terang agar poligon biru terlihat jelas
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    fetch('kab-bandung.json')
        .then(res => res.json())
        .then(geoData => {
            geojsonLayer = L.geoJson(geoData, {
                style: styleMap,
                onEachFeature: (feature, layer) => {
                    let name = (feature.properties.KECAMATAN || feature.properties.name || feature.properties.NAMOBJ || "").toUpperCase().trim();
                    
                    // Logika pencarian data agar tidak 0
                    const dataKec = allData.filter(row => row[idx.kec] === name);
                    const totalD = dataKec.reduce((acc, row) => acc + (parseInt(row[idx.dprt]) || 0), 0);
                    const totalK = dataKec.reduce((acc, row) => acc + (parseInt(row[idx.kader]) || 0), 0);

                    layer.bindPopup(`
                        <div style="font-family: sans-serif;">
                            <b style="color: #0054a6;">KEC. ${name}</b><br>
                            DPRT Aktif: ${totalD}<br>
                            Total Kader: ${totalK}
                        </div>
                    `);
                    
                    layer.on('click', () => {
                        const select = document.getElementById('filterKecamatan');
                        select.value = name;
                        applyFilter();
                    });
                }
            }).addTo(map);
        });
}

function styleMap(feature) {
    const name = (feature.properties.KECAMATAN || feature.properties.name || feature.properties.NAMOBJ || "").toUpperCase().trim();
    const dataKec = allData.filter(row => row[idx.kec] === name);
    const total = dataKec.reduce((acc, row) => acc + (parseInt(row[idx.dprt]) || 0), 0);
    
    return { 
        fillColor: getColor(total), 
        weight: 1.5, 
        color: 'white', 
        fillOpacity: 0.7 
    };
}

function getColor(d) {
    return d > 1000 ? '#003366' : 
           d > 500  ? '#0054a6' : 
           d > 100  ? '#3b82f6' : 
           d > 0    ? '#93c5fd' : 
                      '#e2e8f0'; 
}

initDashboard();
