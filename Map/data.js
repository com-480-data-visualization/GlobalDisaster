let DATA = [];

async function loadData() {
    const res = await fetch("emdat_data.xlsx");
    const buffer = await res.arrayBuffer();

    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets["EM-DAT Data"];
    const raw = XLSX.utils.sheet_to_json(sheet);

    DATA = raw.map(cleanColumns);

    console.log("DATA LOADED:", DATA.length);
    console.log(DATA[0]); 

    return DATA;
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