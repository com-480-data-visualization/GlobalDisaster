// continent-panel.js
// Continent fill layer on Mapbox + sliding right panel with D3 packed bubbles.

(function () {

    // ── Continent → ISO3 mapping ───────────────────────────────────────────
    const CONTINENT_BY_ISO3 = {
        DZA:'Africa',EGY:'Africa',LBY:'Africa',MAR:'Africa',SDN:'Africa',TUN:'Africa',
        BDI:'Africa',COM:'Africa',DJI:'Africa',ERI:'Africa',ETH:'Africa',KEN:'Africa',
        MDG:'Africa',MWI:'Africa',MUS:'Africa',MOZ:'Africa',RWA:'Africa',SYC:'Africa',
        SOM:'Africa',SSD:'Africa',TZA:'Africa',UGA:'Africa',ZMB:'Africa',ZWE:'Africa',
        AGO:'Africa',CMR:'Africa',CAF:'Africa',TCD:'Africa',COD:'Africa',COG:'Africa',
        GNQ:'Africa',GAB:'Africa',STP:'Africa',BEN:'Africa',BFA:'Africa',CPV:'Africa',
        GMB:'Africa',GHA:'Africa',GIN:'Africa',GNB:'Africa',CIV:'Africa',LBR:'Africa',
        MLI:'Africa',MRT:'Africa',NER:'Africa',NGA:'Africa',SEN:'Africa',SLE:'Africa',
        TGO:'Africa',BWA:'Africa',LSO:'Africa',NAM:'Africa',ZAF:'Africa',SWZ:'Africa',
        CHN:'Asia',JPN:'Asia',KOR:'Asia',PRK:'Asia',MNG:'Asia',TWN:'Asia',
        BRN:'Asia',KHM:'Asia',IDN:'Asia',LAO:'Asia',MYS:'Asia',MMR:'Asia',
        PHL:'Asia',SGP:'Asia',THA:'Asia',TLS:'Asia',VNM:'Asia',
        BGD:'Asia',BTN:'Asia',IND:'Asia',MDV:'Asia',NPL:'Asia',PAK:'Asia',LKA:'Asia',
        ARM:'Asia',AZE:'Asia',BHR:'Asia',CYP:'Asia',GEO:'Asia',IRQ:'Asia',IRN:'Asia',
        ISR:'Asia',JOR:'Asia',KWT:'Asia',LBN:'Asia',OMN:'Asia',QAT:'Asia',
        SAU:'Asia',SYR:'Asia',TUR:'Asia',ARE:'Asia',YEM:'Asia',PSE:'Asia',
        KAZ:'Asia',KGZ:'Asia',TJK:'Asia',TKM:'Asia',UZB:'Asia',AFG:'Asia',
        ALB:'Europe',AND:'Europe',AUT:'Europe',BLR:'Europe',BEL:'Europe',
        BIH:'Europe',BGR:'Europe',HRV:'Europe',CZE:'Europe',DNK:'Europe',
        EST:'Europe',FIN:'Europe',FRA:'Europe',DEU:'Europe',GRC:'Europe',
        HUN:'Europe',ISL:'Europe',IRL:'Europe',ITA:'Europe',XKX:'Europe',
        LVA:'Europe',LIE:'Europe',LTU:'Europe',LUX:'Europe',MLT:'Europe',
        MDA:'Europe',MCO:'Europe',MNE:'Europe',NLD:'Europe',MKD:'Europe',
        NOR:'Europe',POL:'Europe',PRT:'Europe',ROU:'Europe',RUS:'Europe',
        SMR:'Europe',SRB:'Europe',SVK:'Europe',SVN:'Europe',ESP:'Europe',
        SWE:'Europe',CHE:'Europe',UKR:'Europe',GBR:'Europe',VAT:'Europe',
        CAN:'North America',MEX:'North America',USA:'North America',
        ATG:'North America',BHS:'North America',BRB:'North America',
        CUB:'North America',DMA:'North America',DOM:'North America',
        GRD:'North America',HTI:'North America',JAM:'North America',
        KNA:'North America',LCA:'North America',VCT:'North America',
        TTO:'North America',CRI:'North America',SLV:'North America',
        GTM:'North America',HND:'North America',NIC:'North America',
        PAN:'North America',
        ARG:'South America',BOL:'South America',BRA:'South America',
        CHL:'South America',COL:'South America',ECU:'South America',
        GUY:'South America',PRY:'South America',PER:'South America',
        SUR:'South America',URY:'South America',VEN:'South America',
        AUS:'Oceania',FJI:'Oceania',KIR:'Oceania',MHL:'Oceania',
        FSM:'Oceania',NRU:'Oceania',NZL:'Oceania',PLW:'Oceania',
        PNG:'Oceania',WSM:'Oceania',SLB:'Oceania',TON:'Oceania',
        TUV:'Oceania',VUT:'Oceania',
    };

    const CONTINENT_COLORS = {
        'Africa':        '#e07b39',
        'Asia':          '#2196a8',
        'Europe':        '#5a7fc2',
        'North America': '#6dab6d',
        'South America': '#a86db2',
        'Oceania':       '#d4a017',
    };

    const CONTINENT_SOURCE = 'continent-source';
    const CONTINENT_FILL   = 'continent-fill';
    const CONTINENT_BORDER = 'continent-border';

    let _open             = false;
    let _currentContinent = null;
    let _hoveredContinent = null;
    let _mapInstance      = null;
    let _continentGeoJSON = null;

    // ── Public API ─────────────────────────────────────────────────────────
    window.ContinentPanel = {

        CONTINENT_COLORS,
        CONTINENT_BY_ISO3,

        init: function (mapInstance) {
            _mapInstance = mapInstance;
            _buildDOM();
        },

        buildLayers: function () {
            if (!window.worldGeoJSON || !_mapInstance) return;
            _continentGeoJSON = _dissolveByContinent(window.worldGeoJSON);
            _addMapLayers(_mapInstance, _continentGeoJSON);
        },

        setVisible: function (visible) {
            if (!_mapInstance) return;
            const v = visible ? 'visible' : 'none';
            if (_mapInstance.getLayer(CONTINENT_FILL))   _mapInstance.setLayoutProperty(CONTINENT_FILL,   'visibility', v);
            if (_mapInstance.getLayer(CONTINENT_BORDER)) _mapInstance.setLayoutProperty(CONTINENT_BORDER, 'visibility', v);
        },

        open: function (continentName) {
            const countryPanel = document.getElementById('panel');
            if (countryPanel && !countryPanel.classList.contains('hidden')) {
                closePanel(); // calls the global closePanel from main.js
            }
            _currentContinent = continentName;
            _open = true;
            document.getElementById('continent-panel').classList.add('open');
            document.getElementById('map').classList.add('map-narrowed');

            // Resize map, then render after transition completes (320ms)
            setTimeout(() => {
                if (_mapInstance) _mapInstance.resize();
                _render(continentName);
            }, 340);
        },

        close: function () {
            _open = false;
            _currentContinent = null;
            document.getElementById('continent-panel').classList.remove('open');
            document.getElementById('map').classList.remove('map-narrowed');
            setTimeout(() => _mapInstance && _mapInstance.resize(), 320);
        },

        refresh: function () {
            if (_open && _currentContinent) {
                // Slight delay so panel has settled dimensions
                setTimeout(() => _render(_currentContinent), 50);
            }
        },

        setHover: function(continentName, on) {
            _setHover(continentName, on);
        },

        isOpen: function () { return _open; },
    };

    const CONTINENT_ID_MAP = {
        'Africa': 1, 'Asia': 2, 'Europe': 3,
        'North America': 4, 'South America': 5, 'Oceania': 6
    };
    const CONTINENT_ID_REVERSE = Object.fromEntries(
        Object.entries(CONTINENT_ID_MAP).map(([k,v]) => [v,k])
    );
    
    function _dissolveByContinent(worldGeoJSON) {
        const groups = {};
        for (const feature of worldGeoJSON.features) {
            const p    = feature.properties;
            const iso3 = [p.ISO_A3, p.ADM0_A3, p.ISO_A3_EH, p.iso_a3]
                .find(v => v && v !== '-99' && v.length === 3) || '';
            if (!iso3 || iso3 === 'ATA') continue;
            const continent = CONTINENT_BY_ISO3[iso3];
            if (!continent) continue;
            if (!groups[continent]) groups[continent] = [];
            const geom = feature.geometry;
            if (geom.type === 'Polygon') {
                groups[continent].push(geom.coordinates);
            } else if (geom.type === 'MultiPolygon') {
                for (const poly of geom.coordinates) groups[continent].push(poly);
            }
        }
        const features = Object.entries(groups).map(([continent, polygons]) => ({
            type: 'Feature',
            id: CONTINENT_ID_MAP[continent],   // ← numeric id
            properties: { continent },
            geometry: { type: 'MultiPolygon', coordinates: polygons }
        }));
        return { type: 'FeatureCollection', features };
    }

    // ── Add continent fill + border layers ────────────────────────────────
    // Inserted BEFORE the bubble-layer so bubbles remain clickable on top,
    // but continent fill handles its own hover/click for empty-space interactions.
    function _addMapLayers(map, geojson) {
        if (map.getSource(CONTINENT_SOURCE)) return; // already added

        map.addSource(CONTINENT_SOURCE, {
            type:      'geojson',
            data:      geojson,
        });

        // Determine insertion point: put continent layers below bubble-layer
        const beforeLayer = map.getLayer('bubble-layer') ? 'bubble-layer' : undefined;

        map.addLayer({
            id:     CONTINENT_FILL,
            type:   'fill',
            source: CONTINENT_SOURCE,
            paint: {
                'fill-color': [
                    'match', ['get', 'continent'],
                    'Africa',        CONTINENT_COLORS['Africa'],
                    'Asia',          CONTINENT_COLORS['Asia'],
                    'Europe',        CONTINENT_COLORS['Europe'],
                    'North America', CONTINENT_COLORS['North America'],
                    'South America', CONTINENT_COLORS['South America'],
                    'Oceania',       CONTINENT_COLORS['Oceania'],
                    '#cccccc'
                ],
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false], 0.18,
                    0
                ]
            },
            layout: { visibility: 'none' }
        }, beforeLayer);

        map.addLayer({
            id:     CONTINENT_BORDER,
            type:   'line',
            source: CONTINENT_SOURCE,
            paint: {
                'line-color': [
                    'match', ['get', 'continent'],
                    'Africa',        CONTINENT_COLORS['Africa'],
                    'Asia',          CONTINENT_COLORS['Asia'],
                    'Europe',        CONTINENT_COLORS['Europe'],
                    'North America', CONTINENT_COLORS['North America'],
                    'South America', CONTINENT_COLORS['South America'],
                    'Oceania',       CONTINENT_COLORS['Oceania'],
                    '#cccccc'
                ],
                'line-width': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false], 2.5,
                    1.2
                ],
                'line-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false], 0.9,
                    0.0
                ]
            },
            layout: { visibility: 'none' }
        }, beforeLayer);

        // ── Hover on continent fill (background, between bubbles) ──────────
        map.on('mousemove', CONTINENT_FILL, (e) => {
            if (!window.globeActive) return;
            map.getCanvas().style.cursor = 'pointer';
            const continent = e.features[0].properties.continent;
            if (continent !== _hoveredContinent) {
                _setHover(_hoveredContinent, false);
                _hoveredContinent = continent;
                _setHover(_hoveredContinent, true);
            }
        });

        map.on('mouseleave', CONTINENT_FILL, () => {
            map.getCanvas().style.cursor = '';
            _setHover(_hoveredContinent, false);
            _hoveredContinent = null;
        });

        // Click on continent fill (background area, not on a bubble)
        map.on('click', CONTINENT_FILL, (e) => {
            if (!window.globeActive) return;
            if (e.originalEvent._bubbleClicked) return;
            const continent = e.features[0].properties.continent;
            if (continent) ContinentPanel.open(continent);
        });
    }

    function _setHover(continent, on) {
        if (!continent || !_mapInstance) return;
        const numericId = CONTINENT_ID_MAP[continent];
        if (!numericId) return;
        _mapInstance.setFeatureState(
            { source: CONTINENT_SOURCE, id: numericId },  // ← numeric id
            { hover: on }
        );
    }

    // ── DOM ────────────────────────────────────────────────────────────────
    function _buildDOM() {
        if (document.getElementById('continent-panel')) return;
        const panel = document.createElement('div');
        panel.id = 'continent-panel';
        panel.innerHTML = `
            <div class="cp-header">
                <button class="cp-back" onclick="ContinentPanel.close()">← Back to globe</button>
                <h2 class="cp-title"></h2>
            </div>
            <div class="cp-body">
                <svg id="cp-svg"></svg>
            </div>
        `;
        document.body.appendChild(panel);
    }

    // ── Render packed bubbles ──────────────────────────────────────────────
    function _render(continentName) {
        const svg = document.getElementById('cp-svg');
        if (!svg) return;
    
        document.querySelector('.cp-title').textContent = continentName;
    
        const sizeValues = _getSizeValues();
        const colorMap   = _getColorMap();
    
        const nodes = [];
        for (const [iso3, continent] of Object.entries(CONTINENT_BY_ISO3)) {
            if (continent !== continentName) continue;
            const value = sizeValues[iso3] || 0;
            const color = colorMap[iso3] || '#d0d0d0';
            const name  = _isoToName(iso3);
            nodes.push({ iso3, name, value, color });
        }
    
        nodes.sort((a, b) => b.value - a.value);
    
        const body = svg.parentElement;
        const W    = body.clientWidth  || 460;
        const H    = body.clientHeight || 620;
    
        svg.setAttribute('width',   W);
        svg.setAttribute('height',  H);
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.innerHTML = '';
    
        if (nodes.length === 0) {
            const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            t.setAttribute('x', W / 2);
            t.setAttribute('y', H / 2);
            t.setAttribute('text-anchor', 'middle');
            t.setAttribute('fill', '#aaa');
            t.textContent = 'No data';
            svg.appendChild(t);
            return;
        }
    
        const positiveVals = nodes.map(n => n.value).filter(v => v > 0);
        const maxVal = positiveVals.length ? Math.max(...positiveVals) : 1;
        const minVal = positiveVals.length ? Math.min(...positiveVals) : 1;
        const logMax = Math.log10(maxVal);
        const logMin = Math.log10(Math.max(minVal, 1));
        const MIN_R  = 8;
        const MAX_R  = Math.min(W, H) * 0.13;
    
        // Assign radii
        nodes.forEach(n => {
            if (n.value <= 0) {
                n.r = MIN_R * 0.55;
            } else {
                const t = logMax === logMin ? 1
                    : (Math.log10(n.value) - logMin) / (logMax - logMin);
                n.r = MIN_R + t * (MAX_R - MIN_R);
            }
        });
    
        // D3 pack layout — tight tangent circles, no overlap
        const packRoot = d3.hierarchy({ children: nodes })
            .sum(d => d.r ? (d.r + 2) ** 2 : 0);
    
        d3.pack()
            .size([W - 20, H - 50])
            .padding(3)
            (packRoot);
    
        // Copy packed positions back onto nodes
        packRoot.children.forEach(leaf => {
            leaf.data.x = leaf.x + 10;
            leaf.data.y = leaf.y + 10;
            leaf.data.r = leaf.r;
        });
    
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
        nodes.forEach(n => {
            // Circle
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', n.x);
            circle.setAttribute('cy', n.y);
            circle.setAttribute('r',  n.r);
            circle.setAttribute('fill', n.color);
            circle.setAttribute('fill-opacity', '0.85');
            circle.setAttribute('stroke', _darken(n.color, 0.35));
            circle.setAttribute('stroke-width', '1.5');
            circle.style.cursor = 'pointer';
            circle.style.transition = 'fill-opacity 0.15s, stroke-width 0.15s';
    
            circle.addEventListener('mouseenter', () => {
                circle.setAttribute('fill-opacity', '1');
                circle.setAttribute('stroke-width', '2.5');
                _showTooltip(n, circle);
            });
            circle.addEventListener('mouseleave', () => {
                circle.setAttribute('fill-opacity', '0.85');
                circle.setAttribute('stroke-width', '1.5');
                _hideTooltip();
            });
            g.appendChild(circle);
    
            // Label — show on larger bubbles, use ISO3 for small ones
            if (n.r >= 10) {
                const fontSize = Math.max(7, Math.min(12, n.r * 0.38));
                const displayName = n.r < 16 ? n.iso3 : n.name.length > 12 ? n.iso3 : n.name;
    
                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('x', n.x);
                label.setAttribute('y', n.y + 1);
                label.setAttribute('text-anchor', 'middle');
                label.setAttribute('dominant-baseline', 'middle');
                label.setAttribute('fill', _contrast(n.color));
                label.setAttribute('font-size', fontSize);
                label.setAttribute('font-family', 'Helvetica, Arial, sans-serif');
                label.setAttribute('font-weight', '600');
                label.setAttribute('pointer-events', 'none');
                label.textContent = displayName;
                g.appendChild(label);
            }
        });
    
        // Continent footer label
        const contColor = CONTINENT_COLORS[continentName] || '#888';
        const footer = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        footer.setAttribute('x', W / 2);
        footer.setAttribute('y', H - 14);
        footer.setAttribute('text-anchor', 'middle');
        footer.setAttribute('fill', contColor);
        footer.setAttribute('font-size', '11');
        footer.setAttribute('font-weight', '700');
        footer.setAttribute('font-family', 'Helvetica, Arial, sans-serif');
        footer.setAttribute('letter-spacing', '0.14em');
        footer.textContent = continentName.toUpperCase();
        g.appendChild(footer);
    
        svg.appendChild(g);
    }

    // ── Tooltip ────────────────────────────────────────────────────────────
    let _tooltip = null;

    function _showTooltip(node, circleEl) {
        _hideTooltip();
        if (!node.value) return;

        const tt = document.createElement('div');
        tt.id = 'cp-tooltip';
        tt.style.cssText = `
            position:fixed; z-index:9999;
            background:rgba(20,30,60,0.92); color:#fff;
            padding:7px 12px; border-radius:8px;
            font:600 12px/1.4 Helvetica,Arial,sans-serif;
            pointer-events:none; white-space:nowrap;
            box-shadow:0 3px 12px rgba(0,0,0,0.3);
            transform:translate(-50%,-120%);
        `;

        const sizeValues = _getSizeValues();
        const val = sizeValues[node.iso3];
        const valStr = val != null ? val.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—';

        tt.innerHTML = `<div>${node.name}</div><div style="opacity:0.75;font-weight:400">${valStr}</div>`;
        document.body.appendChild(tt);
        _tooltip = tt;

        // Position near the circle using getBoundingClientRect on the SVG circle
        const svgEl = document.getElementById('cp-svg');
        const svgRect = svgEl.getBoundingClientRect();
        const cx = parseFloat(circleEl.getAttribute('cx'));
        const cy = parseFloat(circleEl.getAttribute('cy'));
        const svgW = parseFloat(svgEl.getAttribute('width'))  || svgRect.width;
        const svgH = parseFloat(svgEl.getAttribute('height')) || svgRect.height;

        const screenX = svgRect.left + (cx / svgW) * svgRect.width;
        const screenY = svgRect.top  + (cy / svgH) * svgRect.height;

        tt.style.left = screenX + 'px';
        tt.style.top  = screenY + 'px';
    }

    function _hideTooltip() {
        if (_tooltip) { _tooltip.remove(); _tooltip = null; }
    }

    // ── Data helpers ───────────────────────────────────────────────────────
    function _getSizeValues() {
        const df = window.distortFeature || distortFeature;
        const cf = window.colorFeature || colorFeature;
        const fc = window.featureComputers || featureComputers;
        if (df && fc) {
            const c = fc[df];
            if (c) return c().values || {};
        }
        if (cf && fc) {
            const c = fc[cf];
            if (c) {
                const d = c();
                if (d && !d.legendType) return d.values || {};
            }
        }
        if (window.getCountryDisasterCounts) return window.getCountryDisasterCounts();
        return {};
    }

    function _getColorMap() {
        const cf = window.colorFeature || colorFeature;
        const fc = window.featureComputers || featureComputers;
        if (!cf || !fc) return {};
        const c = fc[cf];
        if (!c) return {};
        const d = c();
        return (d && window.precomputeCountryColors)
            ? window.precomputeCountryColors(d)
            : {};
    }

    function _isoToName(iso3) {
        if (window.worldGeoJSON) {
            const f = window.worldGeoJSON.features.find(f => {
                const p = f.properties;
                return [p.ISO_A3, p.ADM0_A3, p.ISO_A3_EH].includes(iso3);
            });
            if (f) return f.properties.ADMIN || f.properties.NAME || iso3;
        }
        return iso3;
    }

    function _darken(hex, factor) {
        if (!hex || !hex.startsWith('#')) return '#555';
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const r = parseInt(hex.slice(0, 2), 16) * (1 - factor);
        const g = parseInt(hex.slice(2, 4), 16) * (1 - factor);
        const b = parseInt(hex.slice(4, 6), 16) * (1 - factor);
        return '#' + [r, g, b].map(v => {
            const h = Math.round(Math.max(0, Math.min(255, v))).toString(16);
            return h.length === 1 ? '0' + h : h;
        }).join('');
    }

    function _contrast(hex) {
        if (!hex || !hex.startsWith('#')) return '#000';
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const lum = (
            0.299 * parseInt(hex.slice(0, 2), 16) +
            0.587 * parseInt(hex.slice(2, 4), 16) +
            0.114 * parseInt(hex.slice(4, 6), 16)
        ) / 255;
        return lum > 0.55 ? '#1a1a1a' : '#ffffff';
    }

})();