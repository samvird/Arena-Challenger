import * as THREE from 'three';
import { ARENA_RADIUS } from './arena.js';
import { attachCustomPngIfPresent } from './sprites.js';

export class EchoAlly {
  constructor(scene, particles, spawnPos, powerMult = 1) {
    this.scene = scene;
    this.particles = particles;
    this.pos = spawnPos.clone();
    this.pos.y = 0;
    this.vel = new THREE.Vector3();
    this.powerMult = powerMult;
    this.attackCooldown = 0.3;
    this.swingTimer = 0;
    this.facingYaw = 0;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.radius = 0.55;
    this.buildMesh();
  }

  buildMesh() {
    this.group = new THREE.Group();

    const holoMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.72,
      roughness: 0.2,
    });

    const goldMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.9,
    });

    // Spectral Torso & Head
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.68, 0.32), holoMat);
    torso.position.y = 0.78;
    this.group.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), holoMat);
    head.position.y = 1.38;
    this.group.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.38), goldMat);
    visor.position.y = 1.4;
    this.group.add(visor);

    // Spectral Sword Arm
    this.armPivot = new THREE.Group();
    this.armPivot.rotation.order = 'YXZ';
    this.armPivot.position.set(0.36, 0.95, 0.1);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 1.15), goldMat);
    blade.position.z = 0.6;
    this.armPivot.add(blade);
    this.group.add(this.armPivot);

    // Floating Halo Ring
    const haloGeo = new THREE.TorusGeometry(0.42, 0.045, 8, 24);
    haloGeo.rotateX(Math.PI / 2);
    this.halo = new THREE.Mesh(haloGeo, goldMat);
    this.halo.position.y = 1.75;
    this.group.add(this.halo);

    this.group.position.copy(this.pos);
    attachCustomPngIfPresent('echo.png', this.group, 1.9, null).then((sprite) => {
      if (sprite) {
        for (const child of this.group.children) {
          if (child !== sprite && child !== this.halo) {
            child.visible = false;
          }
        }
      }
    });
    this.scene.add(this.group);
  }

  update(dt, time, enemies, allEchoes, onHitCallback) {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.swingTimer = Math.max(0, this.swingTimer - dt);

    // Find nearest living enemy
    let nearest = null;
    let bestDist = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = this.pos.distanceToSquared(e.pos);
      if (d < bestDist) {
        bestDist = d;
        nearest = e;
      }
    }

    if (nearest) {
      const toEnemy = new THREE.Vector3().subVectors(nearest.pos, this.pos);
      toEnemy.y = 0;
      const dist = toEnemy.length();
      const dir = dist > 0.01 ? toEnemy.clone().normalize() : new THREE.Vector3(0, 0, 1);

      const speed = 10.8;
      this.vel.x = THREE.MathUtils.lerp(this.vel.x, dir.x * speed, Math.min(1, 8 * dt));
      this.vel.z = THREE.MathUtils.lerp(this.vel.z, dir.z * speed, Math.min(1, 8 * dt));
      this.facingYaw = Math.atan2(dir.x, dir.z);

      if (dist <= nearest.radius + 1.85 && this.attackCooldown <= 0) {
        this.attackCooldown = 0.52;
        this.swingTimer = 0.2;
        const dmg = Math.round(16 * this.powerMult);
        nearest.takeDamage(dmg, dir, 9);
        this.particles.burst(nearest.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 0xfacc15, 6, 4, 0.7);
        if (onHitCallback) onHitCallback(nearest, dmg);
      }
    } else {
      this.vel.multiplyScalar(0.88);
    }

    // Separation between Echoes so they fan out instead of stacking
    if (allEchoes) {
      for (const other of allEchoes) {
        if (other === this) continue;
        const dx = this.pos.x - other.pos.x;
        const dz = this.pos.z - other.pos.z;
        const dSq = dx * dx + dz * dz;
        const minSep = 1.25;
        if (dSq > 0.0001 && dSq < minSep * minSep) {
          const d = Math.sqrt(dSq);
          const push = (minSep - d) * 10 * dt;
          this.pos.x += (dx / d) * push;
          this.pos.z += (dz / d) * push;
        }
      }
    }

    this.pos.addScaledVector(this.vel, dt);
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > ARENA_RADIUS - 1) {
      this.pos.x *= (ARENA_RADIUS - 1) / r;
      this.pos.z *= (ARENA_RADIUS - 1) / r;
    }

    if (this.swingTimer > 0) {
      const p = 1 - this.swingTimer / 0.2;
      this.armPivot.rotation.y = THREE.MathUtils.lerp(-1.2, 1.2, p);
    } else {
      this.armPivot.rotation.y = THREE.MathUtils.lerp(this.armPivot.rotation.y, 0, Math.min(1, 12 * dt));
    }

    this.group.position.set(
      this.pos.x,
      Math.sin(time * 5 + this.bobPhase) * 0.14,
      this.pos.z
    );
    this.group.rotation.y = this.facingYaw;
    this.halo.rotation.z = time * 2.5;
  }

  destroy() {
    this.scene.remove(this.group);
  }
}
