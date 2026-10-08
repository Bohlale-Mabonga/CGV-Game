// Procedural texture library. Every surface texture in the game is generated
// here on a <canvas> at load time: a height field is authored first, then the
// colour, normal, roughness and displacement maps are all derived from it so
// lighting detail lines up exactly with the painted detail.

import * as THREE from 'three';

// ----------------------------------------------------------- noise helpers --
function hash(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, y, period, seed) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const p = period;
    const a = hash(((xi % p) + p) % p, ((yi % p) + p) % p, seed);
    const b = hash((((xi + 1) % p) + p) % p, ((yi % p) + p) % p, seed);
    const c = hash(((xi % p) + p) % p, (((yi + 1) % p) + p) % p, seed);
    const d = hash((((xi + 1) % p) + p) % p, (((yi + 1) % p) + p) % p, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Tileable fractal noise in [0,1].
function fbm(x, y, size, baseFreq, octaves, seed) {
    let total = 0, amp = 0.5, norm = 0, freq = baseFreq;
    for (let o = 0; o < octaves; o++) {
        total += valueNoise((x / size) * freq, (y / size) * freq, freq, seed + o * 17) * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2;
    }
    return total / norm;
}

function makeCanvas(w, h = w) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}

// Converts a tileable height field to a tangent-space normal map (Sobel-ish).
function heightToNormalCanvas(height, size, strength) {
    const canvas = makeCanvas(size);
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);
    const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
            const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
            let nx = -dx, ny = dy, nz = 1;
            const len = Math.hypot(nx, ny, nz);
            nx /= len; ny /= len; nz /= len;
            const i = (y * size + x) * 4;
            img.data[i] = (nx * 0.5 + 0.5) * 255;
            img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
            img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
}

function grayCanvas(values, size) {
    const canvas = makeCanvas(size);
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
        const v = Math.max(0, Math.min(255, values[i] * 255));
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
}

function rgbCanvas(fn, size) {
    const canvas = makeCanvas(size);
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            const [r, g, b] = fn(x, y, y * size + x);
            img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
}

const smooth = (e0, e1, x) => {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------ the library --
class TextureLibrary {
    constructor() {
        this.cache = new Map();
        this.anisotropy = 4;
    }

    setAnisotropy(value) {
        this.anisotropy = value;
    }

    wrap(canvas, { srgb = false, repeat = [1, 1] } = {}) {
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeat[0], repeat[1]);
        tex.anisotropy = this.anisotropy;
        tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        tex.userData.shared = true;
        return tex;
    }

    cached(key, build) {
        if (!this.cache.has(key)) this.cache.set(key, build());
        return this.cache.get(key);
    }

    // Returns a texture set cloned with its own repeat (shares the GPU image).
    set(name, repeatX = 1, repeatY = 1) {
        const base = this[name]();
        const out = {};
        for (const [k, tex] of Object.entries(base)) {
            if (!tex?.isTexture) continue;
            if (repeatX === 1 && repeatY === 1) {
                out[k] = tex;
            } else {
                const clone = tex.clone();
                clone.repeat.set(repeatX, repeatY);
                clone.userData.shared = false; // the clone object is ours to dispose
                out[k] = clone;
            }
        }
        return out;
    }

    // Wall panels: seams, bevels, rivets and vents, with grime in colour + roughness.
    panels() {
        return this.cached('panels', () => {
            const S = 512;
            const height = new Float32Array(S * S);
            const grime = new Float32Array(S * S);
            const cells = 2;
            const cell = S / cells;
            for (let y = 0; y < S; y++) {
                for (let x = 0; x < S; x++) {
                    const i = y * S + x;
                    const cx = x % cell, cy = y % cell;
                    const edge = Math.min(cx, cy, cell - 1 - cx, cell - 1 - cy);
                    let h = smooth(2, 12, edge) * 0.7 + 0.3; // bevelled plate
                    if (edge < 3) h = 0.0; // seam
                    // Rivets near the corners.
                    for (const [rx, ry] of [[12, 12], [cell - 13, 12], [12, cell - 13], [cell - 13, cell - 13]]) {
                        const d = Math.hypot(cx - rx, cy - ry);
                        if (d < 5) h = Math.max(h, 1.0 - (d / 5) * 0.3);
                    }
                    // Vent slots on one panel of four.
                    const panelIndex = Math.floor(x / cell) + Math.floor(y / cell) * cells;
                    if (panelIndex === 1 && cx > 60 && cx < cell - 60 && cy > 90 && cy < 170) {
                        if ((cy - 90) % 14 < 6) h = 0.15;
                    }
                    // Horizontal stiffener ridge on panel 2.
                    if (panelIndex === 2 && Math.abs(cy - cell / 2) < 10) h = 0.85 + smooth(10, 4, Math.abs(cy - cell / 2)) * 0.15;
                    const n = fbm(x, y, S, 4, 5, 3);
                    height[i] = h + (n - 0.5) * 0.08;
                    grime[i] = Math.pow(fbm(x, y, S, 3, 5, 11), 1.6) + (edge < 6 ? 0.25 : 0);
                }
            }
            const map = rgbCanvas((x, y, i) => {
                const g = grime[i];
                const base = 0.42 + height[i] * 0.2 - g * 0.35;
                const panelIndex = Math.floor(x / cell) + Math.floor(y / cell) * cells;
                const tint = panelIndex === 3 ? [0.92, 0.98, 1.08] : [1, 1, 1];
                return [base * 118 * tint[0], base * 132 * tint[1], base * 150 * tint[2]];
            }, S);
            const rough = new Float32Array(S * S);
            for (let i = 0; i < S * S; i++) rough[i] = 0.35 + grime[i] * 0.55;
            return {
                map: this.wrap(map, { srgb: true }),
                normalMap: this.wrap(heightToNormalCanvas(height, S, 3.2)),
                roughnessMap: this.wrap(grayCanvas(rough, S))
            };
        });
    }

    // Diamond tread floor plate.
    floor() {
        return this.cached('floor', () => {
            const S = 256;
            const height = new Float32Array(S * S);
            const wear = new Float32Array(S * S);
            const cell = 32;
            for (let y = 0; y < S; y++) {
                for (let x = 0; x < S; x++) {
                    const i = y * S + x;
                    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
                    const lx = (x % cell) - cell / 2, ly = (y % cell) - cell / 2;
                    const flip = (gx + gy) % 2 === 0;
                    const a = flip ? (lx + ly) * 0.707 : (lx - ly) * 0.707;
                    const b = flip ? (lx - ly) * 0.707 : (lx + ly) * 0.707;
                    const d = Math.max(Math.abs(a) / 10, Math.abs(b) / 2.6);
                    const n = fbm(x, y, S, 4, 4, 5);
                    height[i] = (d < 1 ? 1 - d * d : 0) * 0.8 + n * 0.15;
                    wear[i] = fbm(x, y, S, 2, 5, 23);
                }
            }
            const map = rgbCanvas((x, y, i) => {
                const v = 0.3 + height[i] * 0.18 + wear[i] * 0.12;
                return [v * 140, v * 145, v * 150];
            }, S);
            const rough = new Float32Array(S * S);
            for (let i = 0; i < S * S; i++) rough[i] = 0.75 - height[i] * 0.4 + wear[i] * 0.15;
            return {
                map: this.wrap(map, { srgb: true }),
                normalMap: this.wrap(heightToNormalCanvas(height, S, 2.6)),
                roughnessMap: this.wrap(grayCanvas(rough, S))
            };
        });
    }

    // Ceiling: square light grilles with an emissive map for the lit cells.
    ceiling() {
        return this.cached('ceiling', () => {
            const S = 256;
            const height = new Float32Array(S * S);
            const emit = new Float32Array(S * S);
            for (let y = 0; y < S; y++) {
                for (let x = 0; x < S; x++) {
                    const i = y * S + x;
                    const cx = x % 128, cy = y % 128;
                    const edge = Math.min(cx, cy, 127 - cx, 127 - cy);
                    height[i] = edge < 4 ? 0 : 0.6 + fbm(x, y, S, 4, 3, 9) * 0.1;
                    const inLight = cx > 40 && cx < 88 && cy > 20 && cy < 108;
                    if (inLight) {
                        height[i] = (cy % 8 < 2) ? 0.3 : 0.45;
                        emit[i] = (cy % 8 < 2) ? 0.2 : 1;
                    }
                }
            }
            const map = rgbCanvas((x, y, i) => {
                const v = emit[i] > 0 ? 200 : 40 + height[i] * 50;
                return [v, v * 1.02, v * 1.08];
            }, S);
            return {
                map: this.wrap(map, { srgb: true }),
                normalMap: this.wrap(heightToNormalCanvas(height, S, 2)),
                emissiveMap: this.wrap(grayCanvas(emit, S), { srgb: true })
            };
        });
    }

    // Yellow/black hazard stripes, worn at the edges.
    hazard() {
        return this.cached('hazard', () => {
            const S = 256;
            const height = new Float32Array(S * S);
            const map = rgbCanvas((x, y, i) => {
                const stripe = ((x + y) % 64) < 32;
                const wear = fbm(x, y, S, 6, 4, 31);
                height[i] = wear * 0.3;
                const worn = wear > 0.62;
                if (worn) return [70, 70, 72];
                return stripe ? [235, 180, 30] : [22, 22, 24];
            }, S);
            return {
                map: this.wrap(map, { srgb: true }),
                normalMap: this.wrap(heightToNormalCanvas(height, S, 1.5))
            };
        });
    }

    // Scorched, cracked rock/concrete for the collapsing meltdown corridor.
    // The height map doubles as a displacement map on finely tessellated walls.
    rubble() {
        return this.cached('rubble', () => {
            const S = 256;
            const height = new Float32Array(S * S);
            const crack = new Float32Array(S * S);
            for (let y = 0; y < S; y++) {
                for (let x = 0; x < S; x++) {
                    const i = y * S + x;
                    const n = fbm(x, y, S, 3, 6, 41);
                    const ridge = 1 - Math.abs(fbm(x, y, S, 4, 4, 77) * 2 - 1);
                    height[i] = n * 0.7 + Math.pow(ridge, 6) * -0.35 + 0.2;
                    crack[i] = Math.pow(ridge, 18);
                }
            }
            const map = rgbCanvas((x, y, i) => {
                const v = 0.25 + height[i] * 0.35;
                return [v * 150, v * 128, v * 115];
            }, S);
            const rough = new Float32Array(S * S).fill(0.92);
            return {
                map: this.wrap(map, { srgb: true }),
                normalMap: this.wrap(heightToNormalCanvas(height, S, 4)),
                displacementMap: this.wrap(grayCanvas(height, S)),
                emissiveMap: this.wrap(grayCanvas(crack, S), { srgb: true }),
                roughnessMap: this.wrap(grayCanvas(rough, S))
            };
        });
    }

    // Brushed metal — anisotropic-looking streaks via the bump map.
    brushed() {
        return this.cached('brushed', () => {
            const S = 256;
            const height = new Float32Array(S * S);
            for (let y = 0; y < S; y++) {
                for (let x = 0; x < S; x++) {
                    height[y * S + x] = fbm(x * 0.05, y * 4, S, 8, 3, 61);
                }
            }
            return { bumpMap: this.wrap(grayCanvas(height, S)) };
        });
    }

    // Grating with an alpha map, used for catwalks you can see through.
    grate() {
        return this.cached('grate', () => {
            const S = 128;
            const alpha = new Float32Array(S * S);
            const height = new Float32Array(S * S);
            for (let y = 0; y < S; y++) {
                for (let x = 0; x < S; x++) {
                    const bar = (x % 16 < 4) || (y % 32 < 4);
                    alpha[y * S + x] = bar ? 1 : 0;
                    height[y * S + x] = bar ? 1 : 0;
                }
            }
            return {
                alphaMap: this.wrap(grayCanvas(alpha, S)),
                normalMap: this.wrap(heightToNormalCanvas(height, S, 1.2))
            };
        });
    }

    // Six-face star field cube map — the static skybox seen through portholes,
    // also used as the environment for refraction on glass.
    starCube() {
        return this.cached('starCube', () => {
            const S = 512;
            const faces = [];
            for (let f = 0; f < 6; f++) {
                const canvas = makeCanvas(S);
                const ctx = canvas.getContext('2d');
                const grad = ctx.createRadialGradient(S * 0.5, S * 0.5, 0, S * 0.5, S * 0.5, S * 0.75);
                grad.addColorStop(0, f === 4 ? '#0d1530' : '#060a16');
                grad.addColorStop(1, '#020309');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, S, S);
                // Soft nebula smudges.
                for (let k = 0; k < 6; k++) {
                    const x = hash(k, f, 7) * S, y = hash(k, f, 9) * S, r = 60 + hash(k, f, 13) * 160;
                    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
                    const hue = [200, 280, 320, 190][k % 4];
                    g.addColorStop(0, `hsla(${hue},70%,45%,0.12)`);
                    g.addColorStop(1, 'hsla(0,0%,0%,0)');
                    ctx.fillStyle = g;
                    ctx.fillRect(0, 0, S, S);
                }
                for (let k = 0; k < 700; k++) {
                    const x = hash(k, f, 1) * S, y = hash(k, f, 2) * S;
                    const b = Math.pow(hash(k, f, 3), 3);
                    ctx.fillStyle = `rgba(${200 + b * 55},${210 + b * 45},255,${0.3 + b * 0.7})`;
                    const r = 0.4 + b * 1.4;
                    ctx.beginPath();
                    ctx.arc(x, y, r, 0, Math.PI * 2);
                    ctx.fill();
                }
                faces.push(canvas);
            }
            const cube = new THREE.CubeTexture(faces);
            cube.colorSpace = THREE.SRGBColorSpace;
            cube.needsUpdate = true;
            cube.userData.shared = true;
            return { cube };
        }).cube;
    }

    // Soft round sprite used by particle systems.
    softDot() {
        return this.cached('softDot', () => {
            const S = 64;
            const canvas = makeCanvas(S);
            const ctx = canvas.getContext('2d');
            const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, S, S);
            const tex = new THREE.CanvasTexture(canvas);
            tex.userData.shared = true;
            return { tex };
        }).tex;
    }

    // Warning ring decal projected under falling debris.
    warningRing() {
        return this.cached('warningRing', () => {
            const S = 128;
            const canvas = makeCanvas(S);
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = 'rgba(255,70,40,1)';
            ctx.lineWidth = 7;
            ctx.beginPath();
            ctx.arc(S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(S / 2, S / 2, S / 2 - 22, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,70,40,0.25)';
            ctx.beginPath();
            ctx.arc(S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2);
            ctx.fill();
            const tex = new THREE.CanvasTexture(canvas);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.userData.shared = true;
            return { tex };
        }).tex;
    }
}

export const textures = new TextureLibrary();

// Text labels (signs, junction displays). Not cached — owned by the caller.
export function makeLabelTexture(lines, {
    width = 512, height = 128, bg = 'rgba(6,14,24,0.92)', color = '#bfefff',
    border = '#37c8ff', font = '700 54px Orbitron, Rajdhani, sans-serif', glow = true, align = 'center'
} = {}) {
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d');
    drawLabel(ctx, lines, { width, height, bg, color, border, font, glow, align });
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = textures.anisotropy;
    tex.userData.canvas = canvas;
    tex.userData.redraw = (newLines, overrides = {}) => {
        drawLabel(ctx, newLines, { width, height, bg, color, border, font, glow, align, ...overrides });
        tex.needsUpdate = true;
    };
    return tex;
}

function drawLabel(ctx, lines, { width, height, bg, color, border, font, glow, align }) {
    ctx.clearRect(0, 0, width, height);
    if (bg) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);
    }
    if (border) {
        ctx.strokeStyle = border;
        ctx.lineWidth = 6;
        ctx.strokeRect(5, 5, width - 10, height - 10);
    }
    const list = Array.isArray(lines) ? lines : [lines];
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
    }
    const lineHeight = height / (list.length + 0.4);
    list.forEach((line, k) => {
        const x = align === 'center' ? width / 2 : 24;
        ctx.fillText(line, x, lineHeight * (k + 0.7));
    });
    ctx.shadowBlur = 0;
}