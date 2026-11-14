import * as THREE from 'three';
import { ARENA_RADIUS } from './arena.js';
import { sfx } from './audio.js';
import { getSwordById } from './swords.js';
import { attachCustomPngIfPresent, attachCustomSwordPngIfPresent } from './sprites.js';

export class Player {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;

    this.pos = new THREE.Vector3(0, 0, 0);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.facingYaw = 0;
    this.radius = 0.65;

    // Base stats
    this.maxHp = 100;
    this.hp = 100;
    this.moveSpeed = 12;
    this.attackDamage = 28;
    this.attackRange = 3.4;
    this.knockbackForce = 16;
    this.lifesteal = 0;
    this.slamRadius = 6.8;
    this.slamDamage = 52;
    this.bounceCount = 0;

    // Movement & Action state
    this.onGround = true;
    this.jumpsLeft = 2;
    this.dashCooldown = 0;
    this.dashMaxCooldown = 1.1;
    this.dashTimer = 0;
    this.dashDir = new THREE.Vector3();

    this.attackCooldown = 0;
    this.attackAnimTimer = 0;

    // E-Move (Bounce Slam) state
    this.slamCooldown = 0;
    this.slamMaxCooldown = 4.2;
    this.isSlamming = false;
    this.slamPhase = 'none'; // 'rise', 'hang', 'dive'
    this.slamTimer = 0;
    this.slamSpin = 0;
    this.slamImpactFlash = 0;

    this.invulnTimer = 0;
    this.squash = 1;
    this.walkCycle = 0;
    this.sword = getSwordById('iron_broadsword');

    this.buildMesh();
  }

  buildMesh() {
    this.group = new THREE.Group();
    this.bodyPivot = new THREE.Group();
    this.bodyPivot.position.y = 0.95;
    this.group.add(this.bodyPivot);

    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x3b4252, roughness: 0.65 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x1e222a, roughness: 0.5 });
    const kneeMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4 });

    // Left & Right Legs (pivoted at hip)
    const buildLeg = (side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.2, -0.15, 0);

      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.46, 0.26), pantsMat);
      thigh.position.y = -0.22;
      thigh.castShadow = true;
      hip.add(thigh);

      const knee = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.28), kneeMat);
      knee.position.set(0, -0.44, 0.02);
      hip.add(knee);

      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.34), bootMat);
      boot.position.set(0, -0.64, 0.03);
      boot.castShadow = true;
      hip.add(boot);

      this.bodyPivot.add(hip);
      return hip;
    };

    this.leftLeg = buildLeg(-1);
    this.rightLeg = buildLeg(1);

    // Belt
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.12, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.5 })
    );
    belt.position.y = -0.08;
    this.bodyPivot.add(belt);

    // Torso / Tactical Tunic
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      emissive: 0x1e3a8a,
      emissiveIntensity: 0.25,
      roughness: 0.45,
    });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.68, 0.38), this.bodyMat);
    torso.position.y = 0.32;
    torso.castShadow = true;
    this.bodyPivot.add(torso);

    // Chest Emblem / Armor Vest Plate
    const vest = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.42, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.3 })
    );
    vest.position.y = 0.36;
    this.bodyPivot.add(vest);

    // Head & Mask
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.55 });
    const maskMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });

    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 0.88;

    const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skinMat);
    headBox.castShadow = true;
    this.headGroup.add(headBox);

    // Face Mask (like the reference character!)
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.46), maskMat);
    mask.position.y = -0.1;
    this.headGroup.add(mask);

    // Brow / Visor Band
    const brow = new THREE.Mesh(
      new THREE.BoxGeometry(0.47, 0.1, 0.47),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.4 })
    );
    brow.position.y = 0.08;
    this.headGroup.add(brow);

    // Spiky Hair Top
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.48), hairMat);
    hair.position.y = 0.22;
    this.headGroup.add(hair);

    this.bodyPivot.add(this.headGroup);

    // Left Arm
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.46, 0.56, 0);
    const lSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.24), this.bodyMat);
    lSleeve.position.y = -0.1;
    const lForearm = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.34, 0.2), skinMat);
    lForearm.position.y = -0.36;
    const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.16, 0.22), bootMat);
    lGlove.position.y = -0.54;
    this.leftArm.add(lSleeve, lForearm, lGlove);
    this.bodyPivot.add(this.leftArm);

    // Right Arm + Sword Hand
    this.rightArm = new THREE.Group();
    this.rightArm.rotation.order = 'YXZ';
    this.rightArm.position.set(0.46, 0.56, 0);
    const rSleeve = lSleeve.clone();
    const rForearm = lForearm.clone();
    const rGlove = lGlove.clone();
    this.rightArm.add(rSleeve, rForearm, rGlove);

    // Weapon Pivot attached to Right Hand
    this.weaponPivot = new THREE.Group();
    this.weaponPivot.position.set(0, -0.52, 0.12);
    this.rightArm.add(this.weaponPivot);
    this.bodyPivot.add(this.rightArm);

    // Slash Arc visual
    const slashGeo = new THREE.RingGeometry(1.4, 3.1, 24, 1, -Math.PI * 0.45, Math.PI * 0.9);
    slashGeo.rotateX(-Math.PI / 2);
    this.slashMat = new THREE.MeshBasicMaterial({
      color: this.sword.slashColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.slashMesh = new THREE.Mesh(slashGeo, this.slashMat);
    this.slashMesh.position.y = 0.9;
    this.slashMesh.rotation.y = Math.PI / 2;
    this.group.add(this.slashMesh);

    // Slam Dive Cone & Impact Spikes (for the [E] move animation!)
    const diveConeGeo = new THREE.ConeGeometry(1.35, 3.2, 16, 1, true);
    this.diveConeMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    this.diveCone = new THREE.Mesh(diveConeGeo, this.diveConeMat);
    this.diveCone.position.y = 1.2;
    this.group.add(this.diveCone);

    this.equipSword(this.sword.id);
    attachCustomPngIfPresent('player.png', this.group, 2.1, this.bodyPivot).then((sprite) => {
      if (sprite) {
        // Keep weapon hand visible in front of custom PNG
        this.group.add(this.weaponPivot);
        this.weaponPivot.position.set(0.46, 0.95, 0.16);
      }
    });
    this.scene.add(this.group);
  }

  equipSword(swordId) {
    this.sword = getSwordById(swordId);
    while (this.weaponPivot.children.length > 0) {
      this.weaponPivot.remove(this.weaponPivot.children[0]);
    }
    this.bladeMesh = this.sword.buildMesh();
    this.weaponPivot.add(this.bladeMesh);
    attachCustomSwordPngIfPresent(`sword_${this.sword.id}.png`, this.weaponPivot, 1.65, this.bladeMesh);
    if (this.slashMat) {
      this.slashMat.color.setHex(this.sword.slashColor);
    }
  }

  updateLobbyPose(dt, time) {
    this.pos.set(0, 0, 0);
    this.group.position.set(0, 0, 0);
    this.group.scale.set(1, 1, 1);
    this.bodyPivot.rotation.set(0, 0, 0);
    this.bodyPivot.position.y = 0.95 + Math.sin(time * 2.6) * 0.025;

    // Confident hero stance holding the sword clearly visible in front/side
    this.leftLeg.rotation.x = 0.06;
    this.leftLeg.rotation.z = -0.06;
    this.rightLeg.rotation.x = -0.06;
    this.rightLeg.rotation.z = 0.06;

    this.leftArm.rotation.x = -0.15 + Math.sin(time * 2.6) * 0.04;
    this.leftArm.rotation.z = 0.18;

    // Right arm holds the sword angled up & out so the entire blade is framed on screen
    this.rightArm.rotation.x = -0.55 + Math.sin(time * 2.2) * 0.04;
    this.rightArm.rotation.y = -0.35;
    this.rightArm.rotation.z = -0.32;

    this.weaponPivot.rotation.set(-1.12, 0, -0.22);
    this.weaponPivot.scale.setScalar(0.68);
    this.slashMat.opacity = 0;
    this.diveConeMat.opacity = 0;
  }

  reset() {
    this.pos.set(0, 0, 0);
    this.vel.set(0, 0, 0);
    this.maxHp = 100;
    this.hp = 100;
    this.moveSpeed = 12;
    this.attackDamage = 28;
    this.attackRange = 3.4;
    this.knockbackForce = 16;
    this.lifesteal = 0;
    this.slamRadius = 6.8;
    this.slamDamage = 52;
    this.bounceCount = 0;
    this.dashCooldown = 0;
    this.slamCooldown = 0;
    this.invulnTimer = 0;
    this.isSlamming = false;
    this.slamPhase = 'none';
    this.slamSpin = 0;
    this.bodyPivot.rotation.set(0, 0, 0);
    this.diveConeMat.opacity = 0;
    this.group.position.copy(this.pos);
  }

  jump() {
    if (this.isSlamming) return;
    if (this.jumpsLeft > 0) {
      this.vel.y = this.onGround ? 12.5 : 11.5;
      this.onGround = false;
      this.jumpsLeft--;
      this.squash = 1.3;
      sfx.jump();
      this.particles.burst(this.pos, 0x38bdf8, 8, 4, 0.7);
    }
  }

  dash(moveDir) {
    if (this.dashCooldown > 0 || this.dashTimer > 0) return;
    this.dashCooldown = this.dashMaxCooldown;
    this.dashTimer = 0.18;
    this.invulnTimer = Math.max(this.invulnTimer, 0.22);

    if (moveDir.lengthSq() > 0.01) {
      this.dashDir.copy(moveDir).normalize();
    } else {
      this.dashDir.set(Math.sin(this.facingYaw), 0, Math.cos(this.facingYaw));
    }
    this.facingYaw = Math.atan2(this.dashDir.x, this.dashDir.z);
    this.squash = 0.75;
    sfx.dash();
    this.particles.burst(this.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 0x38bdf8, 12, 6, 0.8);
  }

  triggerSlam() {
    if (this.slamCooldown > 0 || this.isSlamming) return false;
    this.slamCooldown = this.slamMaxCooldown;
    this.isSlamming = true;
    this.slamPhase = 'rise';
    this.slamTimer = 0.34;
    this.slamSpin = 0;
    this.invulnTimer = Math.max(this.invulnTimer, 0.85);
    this.vel.y = 17.5;
    this.onGround = false;
    this.squash = 1.38;
    sfx.jump();
    this.particles.shockwave(this.pos, 0x38bdf8, 3.5, 0.25);
    this.particles.burst(this.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 0xfacc15, 16, 7, 0.9);
    return true;
  }

  attack(enemies, onHitCallback) {
    if (this.attackCooldown > 0 || this.isSlamming) return;
    const stats = this.sword.stats;
    this.attackCooldown = stats.cooldown;
    this.attackAnimTimer = 0.22;
    sfx.swing();

    const forward = new THREE.Vector3(Math.sin(this.facingYaw), 0, Math.cos(this.facingYaw));
    let hitAny = false;
    const effectiveRange = stats.range;
    const effectiveDamage = Math.round(this.attackDamage * stats.damageMult);
    const effectiveKnockback = this.knockbackForce + stats.knockbackBonus;

    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const toEnemy = new THREE.Vector3().subVectors(enemy.pos, this.pos);
      toEnemy.y = 0;
      const dist = toEnemy.length();
      if (dist <= effectiveRange + enemy.radius) {
        const dir = dist > 0.01 ? toEnemy.clone().normalize() : forward.clone();
        const dot = forward.dot(dir);
        if (dot > -0.2 || dist < 1.6) {
          enemy.takeDamage(effectiveDamage, dir, effectiveKnockback);
          hitAny = true;
          if (this.lifesteal > 0) {
            this.hp = Math.min(this.maxHp, this.hp + this.lifesteal);
          }
          onHitCallback(enemy, effectiveDamage);
        }
      }
    }

    if (hitAny) {
      sfx.hit();
    }
  }

  takeDamage(amount, knockDir) {
    if (this.invulnTimer > 0) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnTimer = 0.45;
    if (knockDir) {
      this.vel.x += knockDir.x * 10;
      this.vel.z += knockDir.z * 10;
      this.vel.y = Math.max(this.vel.y, 4.5);
    }
    this.squash = 0.72;
    sfx.playerHurt();
    this.particles.burst(this.pos.clone().add(new THREE.Vector3(0, 0.9, 0)), 0xf43f5e, 14, 6, 0.9);
    return true;
  }

  bounceBackRevive() {
    this.bounceCount++;
    this.hp = this.maxHp;
    this.invulnTimer = 1.6;
    this.vel.set(0, 11, 0);
    this.onGround = false;
    this.squash = 1.4;
    this.particles.shockwave(this.pos, 0xfacc15, 11, 0.55);
    this.particles.burst(this.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0xfacc15, 32, 11, 1.2);
    sfx.bounceBack();
  }

  update(dt, moveInput, arena, enemies, onSlamImpact) {
    this.weaponPivot.scale.setScalar(1);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.slamCooldown = Math.max(0, this.slamCooldown - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.slamImpactFlash = Math.max(0, this.slamImpactFlash - dt);

    // Horizontal movement
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.vel.x = this.dashDir.x * 28;
      this.vel.z = this.dashDir.z * 28;
    } else {
      const effectiveSpeed = this.moveSpeed * this.sword.stats.speedMult * (this.isSlamming ? 1.25 : 1);
      const targetVx = moveInput.x * effectiveSpeed;
      const targetVz = moveInput.z * effectiveSpeed;
      const accel = this.onGround ? 14 : 8;
      this.vel.x = THREE.MathUtils.lerp(this.vel.x, targetVx, Math.min(1, accel * dt));
      this.vel.z = THREE.MathUtils.lerp(this.vel.z, targetVz, Math.min(1, accel * dt));

      if (moveInput.lengthSq() > 0.01) {
        const targetYaw = Math.atan2(moveInput.x, moveInput.z);
        let diff = targetYaw - this.facingYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.facingYaw += diff * Math.min(1, 14 * dt);
      }
    }

    // Multi-Phase [E] Bounce Slam Animation & Physics!
    if (this.isSlamming) {
      if (this.slamPhase === 'rise') {
        this.slamTimer -= dt;
        // Fast aerial front-flip spin while rising!
        this.slamSpin += dt * Math.PI * 6.2;
        this.bodyPivot.rotation.x = this.slamSpin;
        this.rightArm.rotation.x = -2.4;
        this.leftArm.rotation.x = -2.2;
        this.vel.y -= 26 * dt;

        // Golden spiral trail while flipping
        if (Math.random() < 0.75) {
          this.particles.burst(
            this.pos.clone().add(new THREE.Vector3(0, 1.1, 0)),
            this.sword.slashColor,
            2,
            3,
            0.65
          );
        }

        if (this.slamTimer <= 0 || this.vel.y <= 1.5) {
          this.slamPhase = 'hang';
          this.slamTimer = 0.11; // Dramatic mid-air hang frame!
          this.vel.y = 0;
          this.bodyPivot.rotation.x = 0;
        }
      } else if (this.slamPhase === 'hang') {
        this.slamTimer -= dt;
        this.vel.y = 0;
        // Raise sword straight overhead with both arms before meteor drop
        this.rightArm.rotation.x = -2.85;
        this.leftArm.rotation.x = -2.6;
        this.weaponPivot.rotation.x = -0.9;
        if (this.slamTimer <= 0) {
          this.slamPhase = 'dive';
          this.vel.y = -38;
          sfx.swing();
        }
      } else if (this.slamPhase === 'dive') {
        this.vel.y = -42;
        // Plunge sword downward with glowing dive vortex cone!
        this.bodyPivot.rotation.x = 0.38;
        this.rightArm.rotation.x = -1.65;
        this.weaponPivot.rotation.x = 1.1;
        this.diveConeMat.color.setHex(this.sword.slashColor);
        this.diveConeMat.opacity = 0.65;
        this.diveCone.rotation.y += dt * 18;
        this.particles.burst(
          this.pos.clone().add(new THREE.Vector3(0, 1.0, 0)),
          0xfacc15,
          3,
          5,
          0.8
        );
      }
    } else {
      this.vel.y -= 30 * dt;
      this.bodyPivot.rotation.x = THREE.MathUtils.lerp(this.bodyPivot.rotation.x, 0, Math.min(1, 14 * dt));
      this.diveConeMat.opacity = 0;
    }

    this.pos.addScaledVector(this.vel, dt);

    // Ground collision
    if (this.pos.y <= 0) {
      const wasAirborne = !this.onGround;
      this.pos.y = 0;
      if (this.isSlamming) {
        this.isSlamming = false;
        this.slamPhase = 'none';
        this.slamImpactFlash = 0.28;
        this.bodyPivot.rotation.x = 0.25;
        this.diveConeMat.opacity = 0;
        this.squash = 0.52;
        sfx.slam();
        // Triple concentric shockwave + sword color burst!
        this.particles.shockwave(this.pos, 0xfacc15, this.slamRadius, 0.45);
        this.particles.shockwave(this.pos, this.sword.slashColor, this.slamRadius * 0.72, 0.35);
        this.particles.burst(this.pos, 0xfacc15, 28, 11, 1.25);
        this.particles.burst(this.pos, this.sword.slashColor, 18, 8, 1.0);
        if (onSlamImpact) onSlamImpact(this.pos, this.slamRadius, this.slamDamage);
      } else if (wasAirborne && this.vel.y < -6) {
        this.squash = 0.78;
      }
      this.vel.y = 0;
      this.onGround = true;
      this.jumpsLeft = 2;
    }

    // Bounce Pads
    for (const pad of arena.bouncePads) {
      const dx = this.pos.x - pad.pos.x;
      const dz = this.pos.z - pad.pos.z;
      if (dx * dx + dz * dz < (pad.radius + this.radius) ** 2 && this.pos.y < 0.7 && this.vel.y <= 2) {
        this.vel.y = 19.5;
        this.onGround = false;
        this.jumpsLeft = 1;
        this.squash = 1.45;
        pad.pulse = 1;
        sfx.bumper();
        this.particles.burst(pad.pos, 0xb8f342, 14, 7, 0.9);
      }
    }

    // Bouncy Bumpers
    for (const b of arena.bumpers) {
      const dx = this.pos.x - b.pos.x;
      const dz = this.pos.z - b.pos.z;
      const distSq = dx * dx + dz * dz;
      const minDist = b.radius + this.radius;
      if (distSq < minDist * minDist && this.pos.y < 2.2) {
        const dist = Math.sqrt(distSq) || 0.01;
        const nx = dx / dist;
        const nz = dz / dist;
        this.pos.x = b.pos.x + nx * minDist;
        this.pos.z = b.pos.z + nz * minDist;
        this.vel.x = nx * 18;
        this.vel.z = nz * 18;
        this.vel.y = Math.max(this.vel.y, 6);
        b.pulse = 1;
        sfx.bumper();
        this.particles.burst(b.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0xff4d3d, 10, 6, 0.8);
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
      this.vel.x = -nx * 12;
      this.vel.z = -nz * 12;
    }

    // Limb Walk/Run Animations
    const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && horizSpeed > 0.5 && !this.isSlamming) {
      this.walkCycle += dt * horizSpeed * 1.15;
      const swing = Math.sin(this.walkCycle) * 0.65;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.7;
    } else if (!this.onGround && !this.isSlamming) {
      this.leftLeg.rotation.x = -0.35;
      this.rightLeg.rotation.x = 0.25;
      this.leftArm.rotation.x = -0.5;
    } else if (!this.isSlamming) {
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, Math.min(1, 10 * dt));
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, Math.min(1, 10 * dt));
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, Math.min(1, 10 * dt));
    }
    this.leftLeg.rotation.z = 0;
    this.rightLeg.rotation.z = 0;
    this.leftArm.rotation.z = 0.1;

    // Visuals & squash
    this.squash = THREE.MathUtils.lerp(this.squash, 1, Math.min(1, 12 * dt));
    const xzScale = 1 / Math.sqrt(this.squash);
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.facingYaw;
    this.group.scale.set(xzScale, this.squash, xzScale);

    // Invulnerability flash
    if (this.invulnTimer > 0) {
      this.bodyMat.emissive.setHex(0xfacc15);
      this.bodyMat.emissiveIntensity = Math.sin(performance.now() * 0.03) > 0 ? 0.85 : 0.25;
    } else {
      this.bodyMat.emissive.setHex(0x1e3a8a);
      this.bodyMat.emissiveIntensity = 0.25;
    }

    // Right Arm & Sword Swing Animation
    if (!this.isSlamming) {
      if (this.attackAnimTimer > 0) {
        this.attackAnimTimer -= dt;
        const p = 1 - this.attackAnimTimer / 0.22;
        this.rightArm.rotation.x = -1.25;
        this.rightArm.rotation.y = THREE.MathUtils.lerp(-1.35, 1.35, p);
        this.rightArm.rotation.z = 0;
        this.weaponPivot.rotation.set(0.38, 0, 0);
        this.slashMat.opacity = Math.sin(p * Math.PI) * 0.88;
        this.slashMesh.rotation.y = Math.PI / 2 + (p - 0.5) * 0.95;
      } else if (this.slamImpactFlash > 0) {
        // Post-slam ground cleave pose!
        this.rightArm.rotation.set(-0.45, 0, 0);
        this.weaponPivot.rotation.set(0.85, 0, 0);
        this.slashMat.opacity = 0;
      } else {
        this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, -0.35, Math.min(1, 12 * dt));
        this.rightArm.rotation.y = THREE.MathUtils.lerp(this.rightArm.rotation.y, 0, Math.min(1, 12 * dt));
        this.rightArm.rotation.z = -0.15;
        this.weaponPivot.rotation.x = THREE.MathUtils.lerp(this.weaponPivot.rotation.x, 0, Math.min(1, 12 * dt));
        this.weaponPivot.rotation.y = 0;
        this.weaponPivot.rotation.z = 0;
        this.slashMat.opacity = 0;
      }
    }
  }
}
