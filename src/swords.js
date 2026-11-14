import * as THREE from 'three';

export const SWORDS = [
  {
    id: 'iron_broadsword',
    name: 'Kirkland Bottle',
    subtitle: 'Hydration Starter',
    unlockText: 'Unlocked from start',
    checkUnlock: () => true,
    stats: {
      damageMult: 1.0,
      cooldown: 0.26,
      range: 3.4,
      knockbackBonus: 0,
      speedMult: 1.0,
    },
    slashColor: 0xf4f1ea,
    buildMesh() {
      const group = new THREE.Group();

      // Grip
      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.06, 0.38, 8),
        new THREE.MeshStandardMaterial({ color: 0x3b2f2f, roughness: 0.8 })
      );
      grip.rotation.x = Math.PI / 2;
      grip.position.z = 0.05;
      group.add(grip);

      // Pommel
      const pommel = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.09, 0),
        new THREE.MeshStandardMaterial({ color: 0xd99b26, metalness: 0.7, roughness: 0.3 })
      );
      pommel.position.z = -0.16;
      group.add(pommel);

      // Crossguard
      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.09, 0.1),
        new THREE.MeshStandardMaterial({ color: 0xd99b26, metalness: 0.7, roughness: 0.3 })
      );
      guard.position.z = 0.25;
      group.add(guard);

      // Blade
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.04, 1.15),
        new THREE.MeshStandardMaterial({ color: 0xdbe2ea, metalness: 0.75, roughness: 0.22 })
      );
      blade.position.z = 0.86;
      group.add(blade);

      // Tip
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.085, 0.26, 4),
        new THREE.MeshStandardMaterial({ color: 0xeff4f9, metalness: 0.8, roughness: 0.2 })
      );
      tip.rotation.x = Math.PI / 2;
      tip.rotation.z = Math.PI / 4;
      tip.position.z = 1.56;
      group.add(tip);

      return group;
    },
  },
  {
    id: 'kinetic_rapier',
    name: 'Pizza Crust',
    subtitle: 'Crispy & Fast',
    unlockText: 'Reach Wave 2 or 1,000 Score',
    checkUnlock: (prog) => prog.bestWave >= 2 || prog.bestScore >= 1000,
    stats: {
      damageMult: 0.95,
      cooldown: 0.17,
      range: 4.15,
      knockbackBonus: -2,
      speedMult: 1.08,
    },
    slashColor: 0x38bdf8,
    buildMesh() {
      const group = new THREE.Group();

      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.05, 0.34, 8),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
      );
      grip.rotation.x = Math.PI / 2;
      group.add(grip);

      // Swept basket guard
      const guard = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.03, 8, 16, Math.PI * 1.3),
        new THREE.MeshStandardMaterial({ color: 0xffb82e, metalness: 0.85, roughness: 0.2 })
      );
      guard.rotation.y = Math.PI / 2;
      guard.position.z = 0.2;
      group.add(guard);

      // Long needle blade
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.06, 1.65, 6),
        new THREE.MeshStandardMaterial({
          color: 0xe0f2fe,
          emissive: 0x0284c7,
          emissiveIntensity: 0.35,
          metalness: 0.85,
          roughness: 0.15,
        })
      );
      blade.rotation.x = Math.PI / 2;
      blade.position.z = 1.04;
      group.add(blade);

      return group;
    },
  },
  {
    id: 'bumper_claymore',
    name: 'Cherry Coke Can',
    subtitle: 'Heavy Knockback',
    unlockText: 'Trigger 2 Bounce Backs',
    checkUnlock: (prog) => prog.totalBounces >= 2,
    stats: {
      damageMult: 1.35,
      cooldown: 0.34,
      range: 3.8,
      knockbackBonus: 11,
      speedMult: 0.96,
    },
    slashColor: 0xff4d3d,
    buildMesh() {
      const group = new THREE.Group();

      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.07, 0.5, 8),
        new THREE.MeshStandardMaterial({ color: 0x2b1d1d, roughness: 0.85 })
      );
      grip.rotation.x = Math.PI / 2;
      group.add(grip);

      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.12, 0.14),
        new THREE.MeshStandardMaterial({ color: 0xff4d3d, emissive: 0x991b1b, emissiveIntensity: 0.35 })
      );
      guard.position.z = 0.28;
      group.add(guard);

      // Broad heavy blade
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.06, 1.45),
        new THREE.MeshStandardMaterial({ color: 0x52525b, metalness: 0.8, roughness: 0.3 })
      );
      blade.position.z = 1.04;
      group.add(blade);

      // Glowing fuller core
      const core = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.075, 1.15),
        new THREE.MeshStandardMaterial({ color: 0xff4d3d, emissive: 0xff4d3d, emissiveIntensity: 0.9 })
      );
      core.position.z = 0.98;
      group.add(core);

      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.32, 4),
        new THREE.MeshStandardMaterial({ color: 0x71717a, metalness: 0.8, roughness: 0.25 })
      );
      tip.rotation.x = Math.PI / 2;
      tip.rotation.z = Math.PI / 4;
      tip.position.z = 1.9;
      group.add(tip);

      return group;
    },
  },
  {
    id: 'solaris_greatsword',
    name: 'Freedom Flagstaff',
    subtitle: 'Strongest Final Relic',
    unlockText: 'Trigger 5 Bounce Backs or Wave 6',
    checkUnlock: (prog) => prog.totalBounces >= 5 || prog.bestWave >= 6,
    stats: {
      damageMult: 2.0,
      cooldown: 0.2,
      range: 4.8,
      knockbackBonus: 14,
      speedMult: 1.15,
    },
    slashColor: 0xffb82e,
    buildMesh() {
      const group = new THREE.Group();

      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.065, 0.46, 8),
        new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.4 })
      );
      grip.rotation.x = Math.PI / 2;
      group.add(grip);

      // Winged sun guard
      const guard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.22, 0),
        new THREE.MeshStandardMaterial({
          color: 0xffb82e,
          emissive: 0xd97706,
          emissiveIntensity: 0.7,
        })
      );
      guard.scale.set(2.4, 0.5, 0.6);
      guard.position.z = 0.26;
      group.add(guard);

      // Twin-split solar blade
      const leftEdge = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.045, 1.6),
        new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.85,
        })
      );
      leftEdge.position.set(-0.08, 0, 1.1);
      group.add(leftEdge);

      const rightEdge = leftEdge.clone();
      rightEdge.position.x = 0.08;
      group.add(rightEdge);

      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.11, 0),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xffb82e,
          emissiveIntensity: 1.2,
        })
      );
      core.position.z = 0.72;
      group.add(core);

      return group;
    },
  },
];

export function getSwordById(id) {
  return SWORDS.find((s) => s.id === id) || SWORDS[0];
}
