import * as THREE from 'three';

const loader = new THREE.TextureLoader();
let manifestFiles = null;

async function loadManifest() {
  if (manifestFiles !== null) return manifestFiles;
  try {
    const res = await fetch('assets/manifest.json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      manifestFiles = new Set(Array.isArray(data.sprites) ? data.sprites : []);
    } else {
      manifestFiles = new Set();
    }
  } catch {
    manifestFiles = new Set();
  }
  return manifestFiles;
}

/**
 * If `<filename>` is listed in `assets/manifest.json`, loads `assets/<filename>`
 * as a crisp floating PNG billboard sprite inside `containerGroup` and hides `fallbackGroup`.
 */
export async function attachCustomPngIfPresent(filename, containerGroup, targetHeight, fallbackGroup, yOffset = 0) {
  const files = await loadManifest();
  if (!files.has(filename)) return null;

  return new Promise((resolve) => {
    loader.load(
      `assets/${filename}`,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter; // crisp for pixel art & clean for hand-drawn
        const aspect = tex.image.width / Math.max(1, tex.image.height);
        const w = targetHeight * aspect;

        const mat = new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          alphaTest: 0.1,
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(w, targetHeight, 1);
        sprite.position.y = targetHeight * 0.5 + yOffset;

        if (fallbackGroup) fallbackGroup.visible = false;
        containerGroup.add(sprite);
        resolve(sprite);
      },
      undefined,
      () => resolve(null)
    );
  });
}

/**
 * Loads a custom sword PNG as a 3D double-sided plane attached to the player's hand.
 */
export async function attachCustomSwordPngIfPresent(filename, weaponPivot, length = 1.65, fallbackMesh) {
  const files = await loadManifest();
  if (!files.has(filename)) return null;

  return new Promise((resolve) => {
    loader.load(
      `assets/${filename}`,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        const aspect = tex.image.width / Math.max(1, tex.image.height);
        const geo = new THREE.PlaneGeometry(length * aspect, length);
        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          alphaTest: 0.15,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = Math.PI / 2;
        mesh.position.z = length * 0.52;

        if (fallbackMesh) fallbackMesh.visible = false;
        weaponPivot.add(mesh);
        resolve(mesh);
      },
      undefined,
      () => resolve(null)
    );
  });
}
