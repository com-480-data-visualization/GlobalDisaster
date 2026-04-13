import * as XLSX from 'xlsx'

export async function loadData() {
  const res = await fetch('/public_emdat.xlsx')
  const buffer = await res.arrayBuffer()

  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet =
    workbook.Sheets['EM-DAT Data'] ||
    workbook.Sheets[workbook.SheetNames[0]]

  const raw = XLSX.utils.sheet_to_json(sheet)
  return raw.map(cleanColumns)
}

function cleanColumns(row) {
  const cleaned = {}

  for (const key in row) {
    const newKey = key
      .trim()
      .replace(/\s+/g, '_')
      .replace(/\./g, '')
      .replace(/\//g, '_')

    cleaned[newKey] = row[key]
  }

  return cleaned
}
