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

        applyFilter();
        initMap();

    } catch (e) { 
        console.error("Error load data:", e); 
    }
}

function applyFilter() {
    const filterValue = document.getElementById('filterKecamatan').value;
    
    const filtered = filterValue === "ALL" 
        ? allData 
        : allData.filter(row => row[idx.kec] === filterValue);

    // Hitung Total untuk Stat Cards
    const totalDPRT = filtered.reduce((acc, row) => acc + (parseInt(row[idx.dprt]) || 0), 0);
    const totalKader = filtered.reduce((acc, row) => acc + (parseInt(row[idx.kader]) || 0), 0);
    
    document.getElementById('stat-dprt').innerText = totalDPRT.toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = totalKader.toLocaleString('id-ID');

    let labels = [], dprtVals = [], kaderVals = [];

    if (filterValue === "ALL") {
        const summary = {};
        filtered.forEach(row => {
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
        // Jika filter per kecamatan, tampilkan data per desa
        labels = filtered.map(row => row[idx.desa]);
        dprtVals = filtered.map(row => parseInt(row[idx.dprt]) || 0);
        kaderVals = filtered.map(row => parseInt(row[idx.kader]) || 0);
    }

    renderChart(labels, dprtVals, kaderVals);
    if (geojsonLayer) geojsonLayer.resetStyle();
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
                    backgroundColor: '#f97316', // Orange PAN
                    borderRadius: 4,
                    barThickness: 8
                },
                {
                    label: 'DPRT Aktif',
                    data: dprtData,
                    backgroundColor: '#3b82f6', // Biru PAN
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
                    position: 'top',
                    labels: { color: '#f1f5f9', font: { weight: 'bold' } } 
                },
                tooltip: { backgroundColor: '#1e293b' }
            },
            scales: {
                y: { 
                    ticks: { color: '#94a3b8', autoSkip: false, font: { size: 9, weight: '600' } },
                    grid: { display: false }
                },
                x: { 
                    ticks: { color: '#94a3b8' }, 
                    grid: { color: 'rgba(51, 65, 85, 0.5)' } 
                }
            }
        }
    });
}

function initMap() {
    if (map) return;
    map = L.map('map', { zoomControl: false }).setView([-7.0252, 107.5197], 10);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    fetch('kab-bandung.json')
        .then(res => res.json())
        .then(geoData => {
            geojsonLayer = L.geoJson(geoData, {
                style: styleMap,
                onEachFeature: (feature, layer) => {
                    let name = (feature.properties.KECAMATAN || feature.properties.name || feature.properties.NAMOBJ || "").toUpperCase().trim();
                    if (name === "BANDUNG" && feature.properties.KEC) name = feature.properties.KEC.toUpperCase().trim();

                    const dataKec = allData.filter(row => row[idx.kec] === name);
                    const totalD = dataKec.reduce((acc, row) => acc + (parseInt(row[idx.dprt]) || 0), 0);
                    const totalK = dataKec.reduce((acc, row) => acc + (parseInt(row[idx.kader]) || 0), 0);

                    layer.bindPopup(`
                        <div style="font-family: 'Plus Jakarta Sans', sans-serif; color: #1e293b;">
                            <b style="font-size: 14px; color: #0054a6;">KEC. ${name}</b><br>
                            <hr style="margin: 5px 0;">
                            DPRT Aktif: <b>${totalD.toLocaleString('id-ID')}</b><br>
                            Total Kader: <b>${totalK.toLocaleString('id-ID')}</b>
                        </div>
                    `);
                    
                    layer.on('mouseover', function() { this.setStyle({ fillOpacity: 0.9, weight: 3 }); });
                    layer.on('mouseout', function() { this.setStyle({ fillOpacity: 0.7, weight: 1.5 }); });
                    
                    layer.on('click', () => {
                        const select = document.getElementById('filterKecamatan');
                        for (let i = 0; i < select.options.length; i++) {
                            if (select.options[i].value === name) {
                                select.selectedIndex = i;
                                applyFilter();
                                break;
                            }
                        }
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
        color: '#0f172a', 
        fillOpacity: 0.7 
    };
}

function getColor(d) {
    return d > 2000 ? '#1e3a8a' : 
           d > 1000 ? '#1d4ed8' : 
           d > 500  ? '#3b82f6' : 
           d > 100  ? '#93c5fd' : 
                      '#334155'; 
}

initDashboard();
