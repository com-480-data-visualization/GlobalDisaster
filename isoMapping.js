/**
 * EM-DAT historical / non-standard ISO-3 codes → modern ISO-3 equivalents.
 * Source: https://doc.emdat.be/docs/data-structure-and-content/spatial-information/
 *
 * Strategy for multi-successor states:
 *   - USSR  → Russia  (dominant successor, retains UNSC seat, capital)
 *   - YUG/SCG → Serbia (capital Belgrade was the federal capital)
 *   - CSK   → Czech Republic (Prague was federal capital)
 *   - DDR + DFR → Germany (reunified)
 *   - YMD + YMN → Yemen (unified 1990)
 *   - ANT   → Curaçao (seat of government of Netherlands Antilles)
 *   - SPI   → Spain (Canary Islands are a Spanish autonomous community)
 *   - AZO   → Portugal (Azores are a Portuguese autonomous region)
 */
const HISTORICAL_ISO_MAP = {
    'SUN': 'RUS',   // Soviet Union → Russia
    'YUG': 'SRB',   // Yugoslavia → Serbia
    'SCG': 'SRB',   // Serbia & Montenegro → Serbia
    'CSK': 'CZE',   // Czechoslovakia → Czech Republic
    'DDR': 'DEU',   // East Germany → Germany
    'DFR': 'DEU',   // West Germany → Germany
    'ANT': 'CUW',   // Netherlands Antilles → Curaçao
    'YMD': 'YEM',   // South Yemen → Yemen
    'YMN': 'YEM',   // North Yemen → Yemen
    'SPI': 'ESP',   // Canary Islands → Spain
    'AZO': 'PRT',   // Azores → Portugal
};

/**
 * Resolve a potentially historical ISO-3 code to its modern equivalent.
 * Returns the original code unchanged if it's already a modern code.
 */
function resolveISO(iso) {
    if (!iso) return iso;
    return HISTORICAL_ISO_MAP[iso] || iso;
}