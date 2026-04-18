/**
 * Dashboard Pemenangan PAN Kab. Bandung
 * Fix: Mapping Kolom GSheet & Filter Detail Desa
 */

const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!A2:E500'; 

let allData = [];
let myChart = null;

/**
 * PENYESUAIAN INDEKS KOLOM (PENTING!)
 * Berdasarkan info Anda: ID(0), Nama Desa(1), Kecamatan(2), DPRT Aktif(3), Kader(4)
 */
const idx = { 
    desa: 1, 
    kec: 2, 
    dprt: 3, 
    kader: 4 
};

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
                // Menghapus titik ribuan agar bisa dijumlahkan sebagai angka
                return parseInt(val.toString().replace(/\./g, '')) || 0;
            };

            return {
                desa: (row[idx.desa] || "").trim().toUpperCase(),
                kec: (row[idx.kec] || "").trim().toUpperCase(),
                kecClean: cleanName(row[idx.kec]),
                dprt: parseNum(row[idx.dprt]),
                kader: parseNum(row[idx.kader])
            };
        }).filter(item => item.kec !== ""); // Buang baris kosong

        populateDropdown();
        applyFilter(); 

    } catch (e) { console.error("Error:", e); }
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
    
    // Logika Filter Data
    const filtered = filterValue === "ALL" 
        ? allData 
        : allData.filter(d => d.kec === filterValue);

    // 1. UPDATE ANGKA COUNTER
    // Menghitung TOTAL DPRT dari kolom "Jumlah dprt aktif"
    const totalDprt = filtered.reduce((acc, d) => acc + d.dprt, 0);
    const totalKader = filtered.reduce((acc, d) => acc + d.kader, 0);

    // Pastikan ID 'stat-dprt' dan 'stat-kader' ada di HTML
    document.getElementById('stat-dprt').innerText = totalDprt.toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = totalKader.toLocaleString('id-ID');

    // 2. UPDATE GRAFIK
    updateChartUI(filterValue, filtered);
}

function updateChartUI(filterValue, filteredData) {
    const ctx = document.getElementById('panChart').getContext('2d');
    if (myChart) myChart.destroy();

    let labels = [];
    let dprtVals = [];
    let kaderVals = [];

    if (filterValue === "ALL") {
        // Mode Kabupaten: Agregasi per Kecamatan
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
        // Mode Kecamatan: DETAIL PER DESA
        // Sortir desa berdasarkan jumlah kader terbanyak
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
                { 
                    label: 'DPRT Aktif', 
                    data: dprtVals, 
                    backgroundColor: '#0054a6', // Biru PAN
                    borderRadius: 4
                },
                { 
                    label: 'Total Kader', 
                    data: kaderVals, 
                    backgroundColor: '#f97316', // Orange
                    borderRadius: 4
                }
            ]
        },
        options: {
            indexAxis: 'y',
            maintainAspectRatio: false,
            responsive: true,
            scales: {
                x: { stacked: false, ticks: { color: '#94a3b8' } },
                y: { stacked: false, ticks: { color: '#f1f5f9', font: { size: 10 } } }
            },
            plugins: {
                legend: { position: 'top', labels: { color: '#fff' } }
            }
        }
    });
}
