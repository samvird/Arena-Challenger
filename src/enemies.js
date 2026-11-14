import * as THREE from 'three';
import { ARENA_RADIUS } from './arena.js';
import { sfx } from './audio.js';
import { attachCustomPngIfPresent } from './sprites.js';

export class Enemy {
  constructor(scene, particles, type, pos, waveScale = 1) {
    this.scene = scene;
    this.particles = particles;
    this.type = type;
    this.pos = pos.clone();
    this.vel = new THREE.Vector3();
    this.dead = false;
    this.hitFlash = 0;
    this.attackCooldown = 0.6 + Math.random() * 0.5;
    this.chargeTimer = 0;
    this.chargeWindup = 0;
    this.chargeDir = new THREE.Vector3();
    this.animPhase = Math.random() * Math.PI * 2;
    this.leftArm = null;
    this.rightArm = null;
    this.spinRing = null;
    this.hpBarFill = null;

    if (type === 'swarmer') {
      this.radius = 0.65;
      this.maxHp = Math.round(36 * waveScale);
      this.speed = 7.2;
      this.damage = 12;
      this.scoreValue = 100;
      this.color = 0xff4d3d;
    } else if (type === 'charger') {
      this.radius = 0.85;
      this.maxHp = Math.round(62 * waveScale);
      this.speed = 5.4;
      this.damage = 18;
      this.scoreValue = 180;
      this.color = 0xa855f7;
    } else {
      const isRareBoss = type === 'rare_boss';
      const isBoss = type === 'boss' || isRareBoss;
      this.radius = isBoss ? 1.55 : 1.18;
      this.maxHp = Math.round((isRareBoss ? 320 : isBoss ? 240 : 125) * waveScale);
      this.speed = isRareBoss ? 4.8 : isBoss ? 4.4 : 3.9;
      this.damage = isRareBoss ? 30 : isBoss ? 26 : 20;
      this.scoreValue = isRareBoss ? 1200 : isBoss ? 600 : 300;
      this.color = isRareBoss ? 0xfacc15 : isBoss ? 0xff4d3d : 0xffb82e;
    }

    this.hp = this.maxHp;
    this.buildMesh();
  }

  buildMesh() {
    this.group = new THREE.Group();

    this.mat = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.color,
      emissiveIntensity: 0.22,
      roughness: 0.35,
      metalness: 0.3,
    });

    const darkArmorMat = new THREE.MeshStandardMaterial({
      color: 0x1c1c24,
      roughness: 0.4,
      metalness: 0.65,
    });

    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    if (this.type === 'swarmer') {
      // Spiked Gyro-Drone
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.56, 0), this.mat);
      core.position.y = 0.72;
      core.castShadow = true;
      this.group.add(core);

      const bladeRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.66, 0.06, 6, 6),
        darkArmorMat
      );
      bladeRing.rotation.x = Math.PI / 2;
      bladeRing.position.y = 0.72;
      this.spinRing = bladeRing;
      this.group.add(bladeRing);

      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.16), glowMat);
      eye.position.set(0, 0.76, 0.45);
      this.group.add(eye);
    } else if (this.type === 'charger') {
      // Horned Ram-Beetle
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.55, 6), this.mat);
      body.rotation.x = Math.PI / 2;
      body.position.y = 0.76;
      body.castShadow = true;
      this.group.add(body);

      const shell = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.35, 1.05), darkArmorMat);
      shell.position.set(0, 0.96, -0.1);
      shell.castShadow = true;
      this.group.add(shell);

      // Twin Ramming Horns
      const hornGeo = new THREE.ConeGeometry(0.12, 0.75, 5);
      hornGeo.rotateX(Math.PI * 0.42);
      const hornL = new THREE.Mesh(hornGeo, glowMat);
      hornL.position.set(-0.34, 0.82, 0.75);
      const hornR = hornL.clone();
      hornR.position.x = 0.34;
      this.group.add(hornL, hornR);
    } else {
      // Brute Golem & Dreadnought Boss
      const isBoss = this.type === 'boss' || this.type === 'rare_boss';
      const s = isBoss ? 1.38 : 1.0;

      // Legs / Stance Pillars
      const legGeo = new THREE.CylinderGeometry(0.24 * s, 0.3 * s, 0.75 * s, 8);
      const legL = new THREE.Mesh(legGeo, darkArmorMat);
      legL.position.set(-0.42 * s, 0.38 * s, 0);
      legL.castShadow = true;
      const legR = legL.clone();
      legR.position.x = 0.42 * s;
      this.group.add(legL, legR);

      // Tapered Armored Torso
      const torsoGeo = new THREE.CylinderGeometry(0.88 * s, 0.56 * s, 1.25 * s, 8);
      const torso = new THREE.Mesh(torsoGeo, darkArmorMat);
      torso.position.y = 1.28 * s;
      torso.castShadow = true;
      this.group.add(torso);

      // Sculpted Chest Plate & Furnace Core
      const chestPlate = new THREE.Mesh(
        new THREE.BoxGeometry(1.18 * s, 0.76 * s, 0.95 * s),
        this.mat
      );
      chestPlate.position.set(0, 1.42 * s, 0.08 * s);
      chestPlate.castShadow = true;
      this.group.add(chestPlate);

      const coreFurnace = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32 * s, 0),
        new THREE.MeshBasicMaterial({ color: isBoss ? 0xb8f342 : 0xfef08a })
      );
      coreFurnace.position.set(0, 1.38 * s, 0.52 * s);
      this.group.add(coreFurnace);

      // Massive Spiked Shoulder Pauldrons
      const pauldronGeo = new THREE.DodecahedronGeometry(0.52 * s, 0);
      const pL = new THREE.Mesh(pauldronGeo, this.mat);
      pL.position.set(-0.98 * s, 1.78 * s, 0);
      pL.castShadow = true;
      const pR = pL.clone();
      pR.position.x = 0.98 * s;
      this.group.add(pL, pR);

      const spikeGeo = new THREE.ConeGeometry(0.16 * s, 0.55 * s, 5);
      const spL = new THREE.Mesh(spikeGeo, darkArmorMat);
      spL.position.set(-1.12 * s, 2.22 * s, 0);
      spL.rotation.z = 0.35;
      const spR = spL.clone();
      spR.position.x = 1.12 * s;
      spR.rotation.z = -0.35;
      this.group.add(spL, spR);

      // Armored Head & Horned Visor
      const head = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.42 * s, 1),
        darkArmorMat
      );
      head.position.set(0, 2.12 * s, 0.12 * s);
      this.group.add(head);

      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.56 * s, 0.14 * s, 0.28 * s),
        glowMat
      );
      visor.position.set(0, 2.12 * s, 0.38 * s);
      this.group.add(visor);

      if (isBoss) {
        // Boss Crown Horns & Orbiting Rune Ring
        const hornGeo = new THREE.ConeGeometry(0.16 * s, 0.85 * s, 5);
        const hL = new THREE.Mesh(hornGeo, this.mat);
        hL.position.set(-0.35 * s, 2.62 * s, 0.05 * s);
        hL.rotation.z = 0.32;
        const hR = hL.clone();
        hR.position.x = 0.35 * s;
        hR.rotation.z = -0.32;
        this.group.add(hL, hR);

        const haloRing = new THREE.Mesh(
          new THREE.TorusGeometry(1.45 * s, 0.06 * s, 6, 24),
          new THREE.MeshBasicMaterial({ color: 0xffb82e })
        );
        haloRing.rotation.x = Math.PI / 2;
        haloRing.position.y = 1.35 * s;
        this.spinRing = haloRing;
        this.group.add(haloRing);
      }

      // Articulated Crusher Arms
      const buildArm = (side) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * 1.05 * s, 1.65 * s, 0);

        const upper = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18 * s, 0.22 * s, 0.75 * s, 6),
          darkArmorMat
        );
        upper.position.y = -0.35 * s;
        pivot.add(upper);

        const fist = new THREE.Mesh(
          new THREE.BoxGeometry(0.52 * s, 0.62 * s, 0.68 * s),
          this.mat
        );
        fist.position.set(0, -0.82 * s, 0.18 * s);
        fist.castShadow = true;
        pivot.add(fist);

        if (isBoss) {
          // Boss War-Hammer head on right arm
          const hammer = new THREE.Mesh(
            new THREE.CylinderGeometry(0.32 * s, 0.32 * s, 0.95 * s, 8),
            darkArmorMat
          );
          hammer.rotation.z = Math.PI / 2;
          hammer.position.set(0, -0.95 * s, 0.55 * s);
          pivot.add(hammer);
        }

        this.group.add(pivot);
        return pivot;
      };

      this.leftArm = buildArm(-1);
      this.rightArm = buildArm(1);

      // Overhead Health Bar for Heavy Enemies
      const barWidth = 1.6 * s;
      const bgPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(barWidth, 0.18),
        new THREE.MeshBasicMaterial({ color: 0x09090d, side: THREE.DoubleSide })
      );
      bgPlane.position.y = 2.75 * s;

      const fillPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(barWidth - 0.06, 0.12),
        new THREE.MeshBasicMaterial({
          color: isBoss ? 0xff4d3d : 0xffb82e,
          side: THREE.DoubleSide,
        })
      );
      fillPlane.position.z = 0.01;
      bgPlane.add(fillPlane);
      this.hpBarBg = bgPlane;
      this.hpBarFill = fillPlane;
      this.group.add(bgPlane);
    }

    this.group.position.copy(this.pos);
    const spriteHeight = this.type === 'rare_boss' ? 6.8 : this.type === 'boss' ? 6.0 : this.type === 'brute' ? 4.4 : this.type === 'charger' ? 2.3 : 1.85;
    const applyCustom = (sprite) => {
      if (!sprite) return;
      this.customSprite = sprite;
      for (const child of this.group.children) {
        if (child !== sprite && child !== this.hpBarBg) {
          child.visible = false;
        }
      }
      if (this.hpBarBg) {
        this.hpBarBg.position.y = spriteHeight + 0.45;
      }
    };
    attachCustomPngIfPresent(`${this.type}.png`, this.group, spriteHeight, null).then((s) => {
      if (s) applyCustom(s);
      else attachCustomPngIfPresent(`${this.type}.jpg`, this.group, spriteHeight, null).then(applyCustom);
    });
    this.scene.add(this.group);
  }

  takeDamage(amount, knockDir, knockForce = 12) {
    if (this.dead) return;
    this.hp -= amount;
    this.hitFlash = 0.14;
    const resist = (this.type === 'boss' || this.type === 'rare_boss') ? 0.35 : this.type === 'brute' ? 0.55 : 1.0;

    if (knockDir) {
      this.vel.x += knockDir.x * knockForce * resist;
      this.vel.z += knockDir.z * knockForce * resist;
      this.vel.y = Math.max(this.vel.y, 4.5 * resist);
    }

    if (this.hpBarFill) {
      const pct = Math.max(0.001, this.hp / this.maxHp);
      this.hpBarFill.scale.x = pct;
    }

    this.particles.burst(
      this.pos.clone().add(new THREE.Vector3(0, this.radius, 0)),
      this.color,
      7,
      5,
      0.75
    );

    if (this.hp <= 0) {
      this.die();
    }
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    sfx.enemyDie();
    this.particles.burst(
      this.pos.clone().add(new THREE.Vector3(0, this.radius, 0)),
      this.color,
      20,
      8,
      1.15
    );
    this.scene.remove(this.group);
  }

  update(dt, targetPos, player, allEnemies, arena, cameraPos) {
    if (this.dead) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.animPhase += dt * 7;

    const toTarget = new THREE.Vector3().subVectors(targetPos, this.pos);
    toTarget.y = 0;
    const dist = toTarget.length();
    const dir = dist > 0.01 ? toTarget.clone().normalize() : new THREE.Vector3(0, 0, 1);

    // AI Behavior
    if (this.type === 'charger') {
      if (this.chargeTimer > 0) {
        this.chargeTimer -= dt;
        this.vel.x = this.chargeDir.x * 19;
        this.vel.z = this.chargeDir.z * 19;
      } else if (this.chargeWindup > 0) {
        this.chargeWindup -= dt;
        this.vel.x *= 0.85;
        this.vel.z *= 0.85;
        if (this.chargeWindup <= 0) {
          this.chargeTimer = 0.42;
        }
      } else {
        this.vel.x = THREE.MathUtils.lerp(this.vel.x, dir.x * this.speed, Math.min(1, 6 * dt));
        this.vel.z = THREE.MathUtils.lerp(this.vel.z, dir.z * this.speed, Math.min(1, 6 * dt));
        if (dist < 10 && dist > 3 && this.attackCooldown <= 0) {
          this.chargeWindup = 0.45;
          this.chargeDir.copy(dir);
          this.attackCooldown = 2.6;
        }
      }
    } else {
      this.vel.x = THREE.MathUtils.lerp(this.vel.x, dir.x * this.speed, Math.min(1, 6 * dt));
      this.vel.z = THREE.MathUtils.lerp(this.vel.z, dir.z * this.speed, Math.min(1, 6 * dt));
    }

    // Enemy-to-Enemy Separation (prevents enemies from merging into one spot)
    if (allEnemies) {
      for (const other of allEnemies) {
        if (other === this || other.dead) continue;
        const dx = this.pos.x - other.pos.x;
        const dz = this.pos.z - other.pos.z;
        const dSq = dx * dx + dz * dz;
        const minSep = this.radius + other.radius + 0.25;
        if (dSq > 0.0001 && dSq < minSep * minSep) {
          const d = Math.sqrt(dSq);
          const push = (minSep - d) * 12 * dt;
          this.pos.x += (dx / d) * push;
          this.pos.z += (dz / d) * push;
        }
      }
    }

    // Gravity
    this.vel.y -= 28 * dt;
    this.pos.addScaledVector(this.vel, dt);

    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.vel.y = 0;
    }

    // Bouncy Bumpers
    for (const b of arena.bumpers) {
      const dx = this.pos.x - b.pos.x;
      const dz = this.pos.z - b.pos.z;
      const distSq = dx * dx + dz * dz;
      const minDist = b.radius + this.radius;
      if (distSq < minDist * minDist && this.pos.y < 2.5) {
        const d = Math.sqrt(distSq) || 0.01;
        const nx = dx / d;
        const nz = dz / d;
        this.pos.x = b.pos.x + nx * minDist;
        this.pos.z = b.pos.z + nz * minDist;
        this.vel.x = nx * 16;
        this.vel.z = nz * 16;
        this.vel.y = 5;
        b.pulse = 1;
        sfx.bumper();
        this.takeDamage(18, new THREE.Vector3(nx, 0, nz), 8);
      }
    }

    // Arena rim keep-in
    const horizDist = Math.hypot(this.pos.x, this.pos.z);
    const maxR = ARENA_RADIUS - this.radius - 0.3;
    if (horizDist > maxR) {
      const nx = this.pos.x / horizDist;
      const nz = this.pos.z / horizDist;
      this.pos.x = nx * maxR;
      this.pos.z = nz * maxR;
      this.vel.x = -nx * 10;
      this.vel.z = -nz * 10;
    }

    // Player collision damage
    const toPlayer = new THREE.Vector3().subVectors(player.pos, this.pos);
    toPlayer.y = 0;
    const pDist = toPlayer.length();
    if (pDist < this.radius + player.radius + 0.15 && Math.abs(player.pos.y - this.pos.y) < 1.8) {
      if (this.attackCooldown <= 0) {
        const kDir = pDist > 0.01 ? toPlayer.normalize() : new THREE.Vector3(0, 0, 1);
        if (player.takeDamage(this.damage, kDir)) {
          this.attackCooldown = 0.85;
        }
      }
    }

    // Visual & Articulated Animations
    this.group.position.copy(this.pos);
    if (dir.lengthSq() > 0.01) {
      this.group.rotation.y = Math.atan2(dir.x, dir.z);
    }

    if (this.hpBarBg && cameraPos) {
      this.hpBarBg.lookAt(cameraPos);
    }

    if (this.spinRing) {
      this.spinRing.rotation.z += dt * 4.5;
    }

    if (this.leftArm && this.rightArm) {
      const swing = Math.sin(this.animPhase) * 0.55;
      this.leftArm.rotation.x = swing;
      this.rightArm.rotation.x = -swing;
    }

    if (this.hitFlash > 0) {
      this.mat.emissive.setHex(0xffffff);
      this.mat.emissiveIntensity = 0.9;
      if (this.customSprite) this.customSprite.material.color.setHex(0xff6b6b);
    } else if (this.chargeWindup > 0) {
      this.mat.emissive.setHex(0xffb82e);
      this.mat.emissiveIntensity = 0.85;
      if (this.customSprite) this.customSprite.material.color.setHex(0xffc61a);
    } else {
      this.mat.emissive.setHex(this.color);
      this.mat.emissiveIntensity = 0.22;
      if (this.customSprite) this.customSprite.material.color.setHex(0xffffff);
    }
  }
}
