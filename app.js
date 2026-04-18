/**
 * Dashboard Pemenangan PAN Kab. Bandung
 * Updated Fix: Filter Desa & Akurasi Perhitungan
 */

const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!A2:E500'; // Range diperluas untuk antisipasi data bertambah

let allData = [];
let myChart = null;
let map = null;
let geojsonLayer = null;

// Pastikan indeks ini sesuai dengan kolom di Google Sheets Anda:
// A=0, B=1 (Desa), C=2 (Kec), D=3 (DPRT), E=4 (Kader)
const idx = { desa: 1, kec: 2, dprt: 3, kader: 4 };

const cleanName = (str) => (str || "").toString().toUpperCase().replace(/[^A-Z0-9]/g, '').trim();

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

async function initDashboard() {
    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`);
        const data = await response.json();
        
        if (!data.values) {
            console.error("Data kosong!");
            return;
        }

        // Mapping Data dengan pembersihan ekstra
        allData = data.values
            .filter(row => row[idx.kec]) // Pastikan baris memiliki nama kecamatan
            .map(row => {
                // Konversi string ke angka, hapus titik/koma jika ada (format ribuan)
                const parseNum = (val) => {
                    if (!val) return 0;
                    let num = val.toString().replace(/\./g, '').replace(/,/g, '');
                    return parseInt(num) || 0;
                };

                return {
                    desa: (row[idx.desa] || "").trim().toUpperCase(),
                    kec: (row[idx.kec] || "").trim().toUpperCase(),
                    kecClean: cleanName(row[idx.kec]), 
                    dprt: parseNum(row[idx.dprt]),
                    kader: parseNum(row[idx.kader])
                };
            });

        console.log("Data Berhasil Dimuat:", allData); // Debugging

        populateDropdown();
        initMap();
        applyFilter(); // Panggil pertama kali untuk angka awal

    } catch (e) { 
        console.error("Gagal inisialisasi:", e); 
    }
}

function populateDropdown() {
    const select = document.getElementById('filterKecamatan');
    const kecamatanList = [...new Set(allData.map(d => d.kec))].sort();
    
    select.innerHTML = '<option value="ALL">KABUPATEN BANDUNG (SEMUA)</option>';
    kecamatanList.forEach(kec => {
        if(kec) {
            const opt = document.createElement('option');
            opt.value = kec;
            opt.textContent = kec;
            select.appendChild(opt);
        }
    });

    select.addEventListener('change', applyFilter);
}

function applyFilter() {
    const filterValue = document.getElementById('filterKecamatan').value;
    
    // Logika Filter
    const filtered = filterValue === "ALL" 
        ? allData 
        : allData.filter(d => d.kec === filterValue);

    console.log("Data Terfilter (" + filterValue + "):", filtered);

    // Update Counter (PENTING: Pastikan ID ini ada di HTML Anda)
    const totalDprt = filtered.reduce((acc, d) => acc + d.dprt, 0);
    const totalKader = filtered.reduce((acc, d) => acc + d.kader, 0);

    document.getElementById('stat-dprt').innerText = totalDprt.toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = totalKader.toLocaleString('id-ID');

    // Update Peta
    if (geojsonLayer) {
        updateMapHighlight(filterValue);
    }

    // Update Grafik
    updateChartUI(filterValue, filtered);
}

function updateChartUI(filterValue, filteredData) {
    const ctx = document.getElementById('panChart').getContext('2d');
    if (myChart) myChart.destroy();

    let labels = [];
    let dprtVals = [];
    let kaderVals = [];

    if (filterValue === "ALL") {
        // Tampilkan agregat per Kecamatan
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
        // TAMPILKAN PER DESA (Ini bagian yang sebelumnya tidak muncul)
        // Sortir desa berdasarkan kader terbanyak
        const sortedDesa = [...filteredData].sort((a, b) => b.kader - a.kader);
        labels = sortedDesa.map(d => d.desa);
        dprtVals = sortedDesa.map(d => d.dprt);
        kaderVals = sortedDesa.map(d => d.kader);
    }

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Kader', data: kaderVals, backgroundColor: '#f97316' },
                { label: 'DPRT Aktif', data: dprtVals, backgroundColor: '#0054a6' }
            ]
        },
        options: {
            indexAxis: 'y',
            maintainAspectRatio: false,
            scales: {
                x: { beginAtZero: true, ticks: { color: '#94a3b8' } },
                y: { ticks: { color: '#94a3b8', font: { size: 10 } } }
            },
            plugins: {
                legend: { labels: { color: '#fff' } }
            }
        }
    });
}

// Fungsi tambahan untuk inisialisasi peta (Pastikan file kab-bandung.json tersedia)
function initMap() {
    map = L.map('map').setView([-7.0252, 107.5197], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    // ... (sisanya sama dengan kode sebelumnya)
}
