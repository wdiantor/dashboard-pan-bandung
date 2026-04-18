<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DPD PAN KAB BANDUNG - MODERN DASHBOARD</title>
    
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

    <style>
        /* CSS RESET & CORE THEME */
        :root {
            --bg-deep: #0f172a;
            --bg-card: #1e293b;
            --pan-blue: #3b82f6;
            --pan-orange: #f97316;
            --border: #334155;
        }

        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: var(--bg-deep) !important;
            color: #f8fafc;
            margin: 0;
            padding: 24px;
        }

        /* CARD STYLE SAMA DENGAN GAMBAR */
        .card-container {
            background-color: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .stat-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }

        /* CUSTOM SELECT */
        select {
            background-color: #0f172a !important;
            border: 1px solid var(--border) !important;
            color: white !important;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 1rem center;
            background-size: 1em;
        }

        #map {
            height: 450px;
            border-radius: 12px;
            background: #0f172a;
        }

        /* Agar peta terlihat dark mode */
        .leaflet-tile { filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3); }
        .leaflet-container { background: #0f172a !important; }

        .logo-img { height: 50px; width: auto; filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.5)); }
    </style>
</head>
<body>

    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
            <h1 class="text-3xl font-extrabold text-blue-500 tracking-tight uppercase">Dashboard DPD PAN</h1>
            <p class="text-slate-400 font-medium">Monitoring Sebaran DPRT & Kader Kab. Bandung</p>
        </div>
        <div class="flex items-center gap-6">
            <img src="https://upload.wikimedia.org/wikipedia/commons/b/b2/Lambang_Kabupaten_Bandung.png" class="logo-img" alt="Kab Bandung">
            <img src="https://upload.wikimedia.org/wikipedia/id/4/47/Partai_Amanat_Nasional_Logo.svg" class="logo-img" alt="PAN">
            <div class="hidden md:block bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl">
                <p class="text-[10px] text-slate-500 font-bold uppercase">Data Terakhir</p>
                <p class="text-blue-400 text-xs font-bold">Real-time (Google Sheets)</p>
            </div>
        </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="card-container border-t-4 border-t-blue-500">
            <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Filter Wilayah</p>
            <select id="filterKecamatan" class="w-full p-3 rounded-xl outline-none cursor-pointer font-bold text-sm" onchange="applyFilter()">
                <option value="ALL">SEMUA KECAMATAN</option>
            </select>
        </div>

        <div class="card-container flex items-center gap-5">
            <div class="stat-icon bg-blue-500/10 text-blue-500">
                <i class="fa-solid fa-sitemap"></i>
            </div>
            <div>
                <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">DPRT Aktif</p>
                <h2 id="stat-dprt" class="text-3xl font-black">0</h2>
            </div>
        </div>

        <div class="card-container flex items-center gap-5">
            <div class="stat-icon bg-orange-500/10 text-orange-500">
                <i class="fa-solid fa-users"></i>
            </div>
            <div>
                <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Total Kader</p>
                <h2 id="stat-kader" class="text-3xl font-black text-white">0</h2>
            </div>
        </div>

        <div class="card-container flex items-center gap-5 border-r-4 border-r-emerald-500">
            <div class="stat-icon bg-emerald-500/10 text-emerald-500">
                <i class="fa-solid fa-chart-line"></i>
            </div>
            <div>
                <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Target Capaian</p>
                <h2 class="text-3xl font-black text-emerald-400">100%</h2>
            </div>
        </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-5 card-container">
            <div class="flex justify-between items-center mb-6">
                <h3 class="font-bold text-lg tracking-tight">Grafik Sebaran Data</h3>
                <span class="text-[9px] bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2 py-1 rounded-md font-black">BAR CHART</span>
            </div>
            <div class="h-[400px]">
                <canvas id="panChart"></canvas>
            </div>
        </div>

        <div class="lg:col-span-7 card-container">
            <div class="flex justify-between items-center mb-6">
                <h3 class="font-bold text-lg tracking-tight">Peta Wilayah Kerja</h3>
                <span class="text-[9px] bg-slate-700 text-slate-300 px-2 py-1 rounded-md font-black">KAB. BANDUNG</span>
            </div>
            <div id="map"></div>
        </div>
    </div>

    <script>
        // DATA CONFIG
        const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
        const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
        const RANGE = 'Sheet1!A2:E281'; 

        let allData = [];
        let myChart = null;
        let map = null;
        let geojsonLayer = null;

        const idx = { desa: 1, kec: 2, dprt: 3, kader: 4 };

        // INITIALIZE
        async function initDashboard() {
            try {
                const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`);
                const data = await response.json();
                
                if (!data.values) return;
                
                allData = data.values.filter(row => row.length >= 3).map(row => {
                    if(row[idx.kec]) row[idx.kec] = row[idx.kec].trim().toUpperCase();
                    return row;
                });

                // Populate Dropdown
                const select = document.getElementById('filterKecamatan');
                const kecamatanList = [...new Set(allData.map(row => row[idx.kec]))]
                    .filter(val => val && isNaN(val))
                    .sort();
                
                kecamatanList.forEach(kec => {
                    let opt = document.createElement('option');
                    opt.value = kec;
                    opt.textContent = kec;
                    select.appendChild(opt);
                });

                initMap();
                applyFilter();
            } catch (e) {
                console.error("Gagal memuat data:", e);
            }
        }

        // FILTER LOGIC
        function applyFilter() {
            const filterValue = document.getElementById('filterKecamatan').value;
            const filtered = filterValue === "ALL" ? allData : allData.filter(row => row[idx.kec] === filterValue);

            const totalDPRT = filtered.reduce((acc, row) => acc + (parseInt(row[idx.dprt]) || 0), 0);
            const totalKader = filtered.reduce((acc, row) => acc + (parseInt(row[idx.kader]) || 0), 0);
            
            document.getElementById('stat-dprt').innerText = totalDPRT.toLocaleString('id-ID');
            document.getElementById('stat-kader').innerText = totalKader.toLocaleString('id-ID');

            let labels = [], vDPRT = [], vKader = [];

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
                labels = Object.keys(summary).slice(0, 15); // Ambil 15 teratas agar tidak sesak
                vDPRT = labels.map(l => summary[l].d);
                vKader = labels.map(l => summary[l].k);
            } else {
                labels = filtered.map(row => row[idx.desa]);
                vDPRT = filtered.map(row => parseInt(row[idx.dprt]) || 0);
                vKader = filtered.map(row => parseInt(row[idx.kader]) || 0);
            }

            renderChart(labels, vDPRT, vKader);
            if (geojsonLayer) geojsonLayer.resetStyle();
        }

        // CHART RENDERER
        function renderChart(l, vD, vK) {
            const ctx = document.getElementById('panChart').getContext('2d');
            if (myChart) myChart.destroy();

            myChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: l,
                    datasets: [
                        {
                            label: 'Kader',
                            data: vK,
                            backgroundColor: '#3b82f6',
                            borderRadius: 4,
                            barThickness: 10
                        },
                        {
                            label: 'DPRT',
                            data: vD,
                            backgroundColor: '#1d4ed8',
                            borderRadius: 4,
                            barThickness: 10
                        }
                    ]
                },
                options: {
                    indexAxis: 'y',
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: true, labels: { color: '#94a3b8', font: { size: 10 } } }
                    },
                    scales: {
                        y: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { display: false } },
                        x: { ticks: { color: '#64748b' }, grid: { color: '#334155' } }
                    }
                }
            });
        }

        // MAP RENDERER
        function initMap() {
            if (map) return;
            map = L.map('map', { zoomControl: false }).setView([-7.0252, 107.5197], 10);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

            fetch('kab-bandung.json')
                .then(res => res.json())
                .then(geoData => {
                    geojsonLayer = L.geoJson(geoData, {
                        style: {
                            fillColor: '#3b82f6',
                            weight: 1,
                            color: '#0f172a',
                            fillOpacity: 0.2
                        },
                        onEachFeature: (feature, layer) => {
                            let name = (feature.properties.KECAMATAN || feature.properties.name || "").toUpperCase().trim();
                            
                            layer.on('mouseover', function() { this.setStyle({ fillOpacity: 0.5, color: '#3b82f6' }); });
                            layer.on('mouseout', function() { this.setStyle({ fillOpacity: 0.2, color: '#0f172a' }); });
                            
                            layer.on('click', () => {
                                document.getElementById('filterKecamatan').value = name;
                                applyFilter();
                            });
                        }
                    }).addTo(map);
                }).catch(err => console.error("File JSON Peta tidak ditemukan. Pastikan kab-bandung.json tersedia."));
        }

        initDashboard();
    </script>
</body>
</html>
