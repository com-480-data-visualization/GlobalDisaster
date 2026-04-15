let DATA = [];
let WORST_BY_COUNTRY = [];

async function loadData() {
    console.log(DATA[0])
    const res = await fetch("emdat_data.xlsx");
    const buffer = await res.arrayBuffer();

    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets["EM-DAT Data"];
    const raw = XLSX.utils.sheet_to_json(sheet);

    DATA = raw.map(cleanColumns);
    computeWorstByCountry();

    console.log("DATA LOADED:", DATA.length);
    console.log(DATA[0]); 

    return DATA;
}

function computeWorstByCountry() {
    const byCountry = {};
    DATA.filter(d => d.Total_Deaths > 0).forEach(d => {
        if (!d.ISO) return;
        if (!byCountry[d.ISO] || d.Total_Deaths > byCountry[d.ISO].Total_Deaths)
            byCountry[d.ISO] = d;
    });
    WORST_BY_COUNTRY = Object.values(byCountry);
    return WORST_BY_COUNTRY;
}

function cleanColumns(row) {
    const r = {};
    for (let k in row) {
        const nk = k.trim()
            .replace(/\s+/g, "_")
            .replace(/\./g, "")
            .replace(/\//g, "_");
        r[nk] = row[k];
    }
    return r;
}