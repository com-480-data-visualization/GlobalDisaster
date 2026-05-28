// bubbles.js — Proportional circle overlay on the Mapbox globe

(function () {

    const LAYER_ID        = 'bubble-layer';
    const LAYER_ID_HOVER  = 'bubble-layer-hover';   // highlight ring on hover
    const SOURCE_ID       = 'bubble-source';

    let _map = null;
    let _hoveredContinent = null;
    let _lastHoveredIso = null;

    // continent → ISO3[] built when show() is called
    let _continentIndex = {};

    window.BubbleOverlay = {

        init: function (mapInstance) {
            _map = mapInstance;

            _map.addSource(SOURCE_ID, {
                type: 'geojson',
                data: emptyFC(),
                promoteId: '_iso3'   
            });

            // Base fill layer
            _map.addLayer({
                id: LAYER_ID,
                type: 'circle',
                source: SOURCE_ID,
                paint: {
                    'circle-radius':         ['get', '_radius'],
                    'circle-color':          ['get', '_color'],
                    'circle-opacity': ['case',
                        ['boolean', ['feature-state', 'hover'], false], 1.0,
                        ['boolean', ['feature-state', 'continentHover'], false], 0.95,
                        0.75
                    ],
                    'circle-stroke-width': ['case',
                        ['boolean', ['feature-state', 'hover'], false], 3,
                        ['boolean', ['feature-state', 'continentHover'], false], 2.5,
                        1.5
                    ],
                    'circle-stroke-color':   ['get', '_strokeColor'],
                    'circle-stroke-opacity': 0.9
                }
            });

            let _mapTooltip = null;

            function _showMapTooltip(props, mouseEvent) {
                _hideMapTooltip();

                const name = props._name || props._iso3;

                let lines = [
                    `<div style="font-weight:700;margin-bottom:6px">${name}</div>`
                ];

                // Bubble metric
                if (props._value != null) {

                    lines.push(`
                        <div style="opacity:0.9">
                            <span style="color:#f5c97a">●</span>
                            ${props._valueLabel}:
                            <strong>
                                ${Number(props._value).toLocaleString(undefined, {
                                    maximumFractionDigits: 1
                                })}
                            </strong>
                        </div>
                    `);
                }

                // Color metric
                if (props._colorValue != null) {

                    const colorVal =
                        typeof props._colorValue === 'number'
                            ? Number(props._colorValue).toLocaleString(undefined, {
                                maximumFractionDigits: 1
                            })
                            : props._colorValue;

                    lines.push(`
                        <div style="opacity:0.9">
                            <span style="color:#89b4fa">●</span>
                            ${props._colorLabel}:
                            <strong>${colorVal}</strong>
                        </div>
                    `);
                }

                const tt = document.createElement('div');
                tt.id = 'bubble-map-tooltip';
                tt.style.cssText = `
                    position:fixed; z-index:9999;
                    background:rgba(15,25,55,0.93); color:#fff;
                    padding:8px 13px; border-radius:10px;
                    font:13px/1.5 Helvetica,Arial,sans-serif;
                    pointer-events:none; white-space:nowrap;
                    box-shadow:0 4px 16px rgba(0,0,0,0.3);
                `;
                tt.innerHTML = lines.join('');
                document.body.appendChild(tt);
                _mapTooltip = tt;
                _positionMapTooltip(mouseEvent);

                // Follow mouse
                _map.getCanvas().addEventListener('mousemove', _followTooltip);
            }

            function _followTooltip(e) {
                if (_mapTooltip) _positionMapTooltip(e);
            }

            function _positionMapTooltip(e) {
                if (!_mapTooltip) return;
                const x = e.clientX, y = e.clientY;
                const tw = _mapTooltip.offsetWidth, th = _mapTooltip.offsetHeight;
                const vw = window.innerWidth, vh = window.innerHeight;
                let left = x + 14, top = y - th - 10;
                if (left + tw > vw - 10) left = x - tw - 14;
                if (top < 10) top = y + 14;
                _mapTooltip.style.left = left + 'px';
                _mapTooltip.style.top  = top  + 'px';
            }

            function _hideMapTooltip() {
                if (_mapTooltip) { _mapTooltip.remove(); _mapTooltip = null; }
                _map.getCanvas().removeEventListener('mousemove', _followTooltip);
            }
            
            _map.on('mouseenter', LAYER_ID, (e) => {
                _map.getCanvas().style.cursor = 'pointer';
                const props = e.features[0].properties;
                const iso = props._iso3;
                if (iso) {
                    _map.setFeatureState({ source: SOURCE_ID, id: iso }, { hover: true });
                    _lastHoveredIso = iso;
                }
                _showMapTooltip(props, e.originalEvent);
            });
            
            _map.on('mouseleave', LAYER_ID, () => {
                _map.getCanvas().style.cursor = '';
                if (_lastHoveredIso) {
                    _map.setFeatureState({ source: SOURCE_ID, id: _lastHoveredIso }, { hover: false });
                    _lastHoveredIso = null;
                }
                _hideMapTooltip();
            });
            
            _map.on('mousemove', LAYER_ID, (e) => {
                const iso = e.features[0].properties._iso3;
                if (iso !== _lastHoveredIso) {
                    if (_lastHoveredIso) _map.setFeatureState({ source: SOURCE_ID, id: _lastHoveredIso }, { hover: false });
                    _lastHoveredIso = iso;
                    _map.setFeatureState({ source: SOURCE_ID, id: iso }, { hover: true });
                }
                _showMapTooltip(e.features[0].properties, e.originalEvent);
            });
            
        },

        show: function (geoJSON, distortValues, colorMap, continentByISO) {
            if (!_map || !geoJSON) return;

            const positiveVals = Object.values(distortValues).filter(v => v > 0);
            if (positiveVals.length === 0) { this.hide(); return; }

            const logMin = Math.log10(Math.min(...positiveVals));
            const logMax = Math.log10(Math.max(...positiveVals));

            const MIN_R = 4;
            const MAX_R = 36;

            _continentIndex = {};
            const features  = [];

            for (const feature of geoJSON.features) {
                const p = feature.properties;

                const iso3 = [p.ISO_A3, p.ADM0_A3, p.ISO_A3_EH, p.iso_a3]
                    .find(v => v && v !== '-99' && v.length === 3) || '';

                if (!iso3 || iso3 === 'ATA') continue;

                const value = distortValues[iso3];
                if (!value || value <= 0) continue;

                const centroid = geometryCentroid(feature.geometry);
                if (!centroid) continue;

                const t = logMax === logMin
                    ? 1
                    : (Math.log10(value) - logMin) / (logMax - logMin);

                const radius      = MIN_R + t * (MAX_R - MIN_R);
                const baseColor   = colorMap[iso3] || '#e8e8e8';
                const fillColor   = baseColor;
                const strokeColor = darkenColor(baseColor, 0.45);
                const continent   = (continentByISO && continentByISO[iso3]) || '';

                // Build continent index for hover
                if (continent) {
                    if (!_continentIndex[continent]) _continentIndex[continent] = [];
                    _continentIndex[continent].push(iso3);
                }

                const distortF = window.distortFeature;
                const colorF   = window.colorFeature;

                const distortData =
                    distortF &&
                    window.featureComputers &&
                    window.featureComputers[distortF]
                        ? window.featureComputers[distortF]()
                        : null;

                const colorData =
                    colorF &&
                    window.featureComputers &&
                    window.featureComputers[colorF]
                        ? window.featureComputers[colorF]()
                        : null;const iso2 = (p.ISO_A2 || '').toLowerCase();


                const colorMetricValue =
                    colorData && colorData.values
                        ? colorData.values[iso3]
                        : null;

                features.push({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: centroid },

                    properties: {
                        _iso3:        iso3,
                        _iso2:        (p.ISO_A2 || '').toLowerCase(),
                        _name:        p.ADMIN || p.NAME || iso3,

                        _radius:      radius,
                        _color:       fillColor,
                        _strokeColor: strokeColor,

                        // bubble metric
                        _value:       value,
                        _valueLabel:  distortData?.legendTitle || distortF || 'Bubble',

                        // color metric
                        _colorValue:  colorMetricValue,
                        _colorLabel:  colorData?.legendTitle || colorF || 'Color',

                        _continent:   continent,
                    }
                });
            }

            _map.getSource(SOURCE_ID).setData({ type: 'FeatureCollection', features });
            _map.setLayoutProperty(LAYER_ID, 'visibility', 'visible');
        },

        hide: function () {
            if (!_map) return;
            _clearContinentHover();
            const src = _map.getSource(SOURCE_ID);
            if (src) src.setData(emptyFC());
            if (_map.getLayer(LAYER_ID)) {
                _map.setLayoutProperty(LAYER_ID, 'visibility', 'none');
            }
        }
    };

    // ── Continent hover helpers ────────────────────────────────────────────

    function _highlightContinent(continent, on) {
        const isos = _continentIndex[continent] || [];
        isos.forEach(iso3 => {
            _map.setFeatureState(
                { source: SOURCE_ID, id: iso3 },
                { continentHover: on }
            );
        });
    }

    function _clearContinentHover() {
        if (_hoveredContinent) {
            _highlightContinent(_hoveredContinent, false);
            _hoveredContinent = null;
        }
    }

    // ── Color helpers ──────────────────────────────────────────────────────

    function hexToRgb(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        return [
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16)
        ];
    }

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(v => {
            const h = Math.round(Math.max(0, Math.min(255, v))).toString(16);
            return h.length === 1 ? '0' + h : h;
        }).join('');
    }

    function darkenColor(hex, factor) {
        if (!hex || !hex.startsWith('#')) return hex;
        const [r, g, b] = hexToRgb(hex);
        return rgbToHex(r * (1 - factor), g * (1 - factor), b * (1 - factor));
    }

    // ── Geometry helpers ───────────────────────────────────────────────────

    function emptyFC() {
        return { type: 'FeatureCollection', features: [] };
    }

    function ringCentroid(ring) {
        let x = 0, y = 0;
        for (const [lng, lat] of ring) { x += lng; y += lat; }
        return [x / ring.length, y / ring.length];
    }

    function geometryCentroid(geometry) {
        if (!geometry) return null;
        let ring = [];
        if (geometry.type === 'Polygon') {
            ring = geometry.coordinates[0];
        } else if (geometry.type === 'MultiPolygon') {
            for (const poly of geometry.coordinates) {
                if (poly[0].length > ring.length) ring = poly[0];
            }
        }
        if (!ring.length) return null;
        return ringCentroid(ring);
    }

})();