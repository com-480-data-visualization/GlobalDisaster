// bubbles.js — Proportional circle overlay on the Mapbox globe
// Called from main.js when distortFeature is active and globeActive is true.

(function () {

    const LAYER_ID = 'bubble-layer';
    const SOURCE_ID = 'bubble-source';

    let _map = null;

    window.BubbleOverlay = {

        init: function (mapInstance) {
            _map = mapInstance;

            _map.addSource(SOURCE_ID, {
                type: 'geojson',
                data: emptyFC()
            });

            _map.addLayer({
                id: LAYER_ID,
                type: 'circle',
                source: SOURCE_ID,
                paint: {
                    'circle-radius':          ['get', '_radius'],
                    'circle-color':           ['get', '_color'],
                    'circle-opacity':         0.75,
                    'circle-stroke-width':    1.8,
                    'circle-stroke-color':    ['get', '_strokeColor'],
                    'circle-stroke-opacity':  0.9
                }
            });

            _map.on('click', LAYER_ID, (e) => {
                if (!window.countryActive) return;
                const props = e.features[0].properties;
                if (window.onBubbleClick) window.onBubbleClick(props._iso3, props);
            });

            _map.on('mouseenter', LAYER_ID, () => {
                _map.getCanvas().style.cursor = 'pointer';
            });
            _map.on('mouseleave', LAYER_ID, () => {
                _map.getCanvas().style.cursor = '';
            });
        },

        show: function (geoJSON, distortValues, colorMap) {
            if (!_map || !geoJSON) return;

            const positiveVals = Object.values(distortValues).filter(v => v > 0);
            if (positiveVals.length === 0) { this.hide(); return; }

            const logMin = Math.log10(Math.min(...positiveVals));
            const logMax = Math.log10(Math.max(...positiveVals));

            const MIN_R = 4;
            const MAX_R = 36;

            const features = [];

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

                const radius = MIN_R + t * (MAX_R - MIN_R);

                // Darken the choropleth color so bubbles read as a distinct layer
                const baseColor  = colorMap[iso3] || '#9bd4d0';
                const strokeColor = darkenColor(baseColor, 0.75); // even darker border

                features.push({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: centroid },
                    properties: {
                        _iso3: iso3,
                        _iso2: (p.ISO_A2 || '').toLowerCase(),
                        _name: p.ADMIN || p.NAME || iso3,
                        _radius: radius,
                        _color: baseColor,
                        _strokeColor: strokeColor,
                        _value: value,
                        ...p
                    }
                });
            }

            _map.getSource(SOURCE_ID).setData({ type: 'FeatureCollection', features });
            _map.setLayoutProperty(LAYER_ID, 'visibility', 'visible');
        },

        hide: function () {
            if (!_map) return;
            const src = _map.getSource(SOURCE_ID);
            if (src) src.setData(emptyFC());
            if (_map.getLayer(LAYER_ID)) {
                _map.setLayoutProperty(LAYER_ID, 'visibility', 'none');
            }
        }
    };

    // ── Color helpers ──────────────────────────────────────────────────────

    // Parse '#rrggbb' or '#rgb' → [r, g, b] 0-255
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

    // factor 0 = original, factor 1 = black
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