import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.rings = [];

    this.particleGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    this.ringGeo = new THREE.RingGeometry(0.7, 1.0, 32);
    this.ringGeo.rotateX(-Math.PI / 2);
  }

  burst(pos, color = 0x38bdf8, count = 14, speed = 7, scale = 1) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      mesh.position.copy(pos);
      mesh.scale.setScalar(scale * (0.6 + Math.random() * 0.7));

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.65;
      const spd = speed * (0.5 + Math.random() * 0.8);
      const vel = new THREE.Vector3(
        Math.cos(theta) * Math.sin(phi) * spd,
        Math.cos(phi) * spd + 2.5,
        Math.sin(theta) * Math.sin(phi) * spd
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel,
        life: 0.35 + Math.random() * 0.3,
        maxLife: 0.65,
      });
    }
  }

  shockwave(pos, color = 0xfacc15, maxRadius = 8, duration = 0.45) {
    const mat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(this.ringGeo, mat);
    mesh.position.set(pos.x, 0.12, pos.z);
    mesh.scale.setScalar(0.5);
    this.scene.add(mesh);

    this.rings.push({
      mesh,
      life: duration,
      maxLife: duration,
      maxRadius,
    });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y -= 18 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += 6 * dt;
      p.mesh.rotation.y += 5 * dt;
      if (p.mesh.position.y < 0.1) {
        p.mesh.position.y = 0.1;
        p.vel.y *= -0.45;
      }
      const alpha = Math.max(0, p.life / p.maxLife);
      p.mesh.material.opacity = alpha;
      p.mesh.scale.multiplyScalar(0.97);
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.scene.remove(r.mesh);
        r.mesh.material.dispose();
        this.rings.splice(i, 1);
        continue;
      }
      const t = 1 - r.life / r.maxLife;
      const radius = 0.5 + (r.maxRadius - 0.5) * (1 - Math.pow(1 - t, 3));
      r.mesh.scale.setScalar(radius);
      r.mesh.material.opacity = 0.9 * (1 - t);
    }
  }

  clear() {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      p.mesh.material.dispose();
    }
    for (const r of this.rings) {
      this.scene.remove(r.mesh);
      r.mesh.material.dispose();
    }
    this.particles = [];
    this.rings = [];
  }
}
