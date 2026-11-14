import * as THREE from 'three';
import { attachCustomPngIfPresent } from './sprites.js';

export const ARENA_RADIUS = 24;

export class Arena {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.bumpers = [];
    this.bouncePads = [];
    this.ambientMeshes = [];
    this.build();
  }

  build() {
    // Lobby Shadow Disc under character feet
    const shadowGeo = new THREE.CircleGeometry(0.95, 32);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x082f5e,
      transparent: true,
      opacity: 0.42,
    });
    this.lobbyShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.lobbyShadow.position.y = 0.01;
    this.scene.add(this.lobbyShadow);

    // Stepped Colosseum Base
    const baseGeo = new THREE.CylinderGeometry(ARENA_RADIUS + 1.8, ARENA_RADIUS + 2.8, 2.2, 48);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x16161c,
      roughness: 0.78,
      metalness: 0.15,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -1.15;
    base.receiveShadow = true;
    this.group.add(base);

    // Main Arena Floor (custom stone brick texture)
    const floorTex = new THREE.TextureLoader().load('assets/floor.jpg');
    floorTex.colorSpace = THREE.SRGBColorSpace;
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(5, 5);

    const floorGeo = new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS, 0.3, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: floorTex,
      roughness: 0.85,
      metalness: 0.08,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.15;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Center Emblem Rings
    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(3.2, 3.65, 48).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xffb82e, emissive: 0x92400e, emissiveIntensity: 0.45 })
    );
    innerRing.position.y = 0.02;
    this.group.add(innerRing);

    const midRing = new THREE.Mesh(
      new THREE.RingGeometry(14.5, 14.8, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x3f3f4e })
    );
    midRing.position.y = 0.015;
    this.group.add(midRing);

    // Outer Brass/Vermilion Rim
    const rimGeo = new THREE.TorusGeometry(ARENA_RADIUS, 0.34, 10, 64);
    rimGeo.rotateX(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xffb82e,
      emissive: 0x78350f,
      emissiveIntensity: 0.35,
      roughness: 0.35,
      metalness: 0.6,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.y = 0.16;
    this.group.add(rim);

    // 12 Sculpted Piston Spring Bumpers
    const bumperCount = 12;
    const basePostGeo = new THREE.CylinderGeometry(1.15, 1.32, 0.65, 16);
    const springCoreGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.75, 16);
    const capGeo = new THREE.CylinderGeometry(1.28, 1.18, 0.34, 16);

    for (let i = 0; i < bumperCount; i++) {
      const angle = (i / bumperCount) * Math.PI * 2;
      const dist = ARENA_RADIUS - 0.85;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      const group = new THREE.Group();
      group.position.set(x, 0, z);

      const visualGroup = new THREE.Group();
      group.add(visualGroup);

      const post = new THREE.Mesh(
        basePostGeo,
        new THREE.MeshStandardMaterial({ color: 0x18181f, metalness: 0.6, roughness: 0.35 })
      );
      post.position.y = 0.32;
      post.castShadow = true;
      visualGroup.add(post);

      const core = new THREE.Mesh(
        springCoreGeo,
        new THREE.MeshStandardMaterial({
          color: 0xff4d3d,
          emissive: 0xb91c1c,
          emissiveIntensity: 0.75,
          roughness: 0.25,
        })
      );
      core.position.y = 0.95;
      core.castShadow = true;
      visualGroup.add(core);

      const cap = new THREE.Mesh(
        capGeo,
        new THREE.MeshStandardMaterial({
          color: 0xf4f1ea,
          metalness: 0.4,
          roughness: 0.3,
        })
      );
      cap.position.y = 1.45;
      cap.castShadow = true;
      visualGroup.add(cap);

      attachCustomPngIfPresent('bumper.png', group, 2.2, visualGroup);

      this.group.add(group);
      this.bumpers.push({
        mesh: group,
        pos: new THREE.Vector3(x, 0, z),
        radius: 1.35,
        pulse: 0,
      });
    }

    // 4 Quadrant Kinetic Launch Pads
    const padPositions = [
      new THREE.Vector3(10, 0, 10),
      new THREE.Vector3(-10, 0, 10),
      new THREE.Vector3(10, 0, -10),
      new THREE.Vector3(-10, 0, -10),
    ];

    const padBaseGeo = new THREE.CylinderGeometry(1.85, 2.1, 0.24, 8);
    const padTopGeo = new THREE.CylinderGeometry(1.38, 1.45, 0.14, 8);

    for (const p of padPositions) {
      const baseMesh = new THREE.Mesh(
        padBaseGeo,
        new THREE.MeshStandardMaterial({ color: 0x1a1a22, metalness: 0.65, roughness: 0.3 })
      );
      baseMesh.position.set(p.x, 0.12, p.z);
      baseMesh.receiveShadow = true;

      const top = new THREE.Mesh(
        padTopGeo,
        new THREE.MeshStandardMaterial({
          color: 0xb8f342,
          emissive: 0x65a30d,
          emissiveIntensity: 0.8,
        })
      );
      top.position.y = 0.15;
      baseMesh.add(top);

      this.group.add(baseMesh);
      this.bouncePads.push({
        mesh: baseMesh,
        top,
        pos: p.clone(),
        radius: 1.85,
        pulse: 0,
      });
    }

    // Distant Architectural Monoliths
    const pillarGeo = new THREE.BoxGeometry(2.2, 12, 2.2);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + 0.13;
      const dist = ARENA_RADIUS + 13 + (i % 2) * 5;
      const mat = new THREE.MeshStandardMaterial({
        color: 0x1b1b24,
        roughness: 0.7,
        metalness: 0.2,
      });
      const mesh = new THREE.Mesh(pillarGeo, mat);
      const baseY = -3 + (i % 3) * 2.5;
      mesh.position.set(Math.cos(angle) * dist, baseY, Math.sin(angle) * dist);
      mesh.rotation.y = angle;
      this.group.add(mesh);
      this.ambientMeshes.push({ mesh, baseY, phase: i * 0.6 });
    }
  }

  setLobbyMode(isLobby) {
    this.group.visible = !isLobby;
    this.lobbyShadow.visible = isLobby;
  }

  update(dt, time) {
    for (const b of this.bumpers) {
      if (b.pulse > 0) {
        b.pulse = Math.max(0, b.pulse - dt * 4);
        const s = 1 + Math.sin(b.pulse * Math.PI) * 0.26;
        b.mesh.scale.set(s, 1 / Math.sqrt(s), s);
      }
    }

    for (const pad of this.bouncePads) {
      if (pad.pulse > 0) {
        pad.pulse = Math.max(0, pad.pulse - dt * 4);
        pad.top.position.y = 0.15 + Math.sin(pad.pulse * Math.PI) * 0.45;
      } else {
        pad.top.position.y = 0.15 + Math.sin(time * 3) * 0.03;
      }
    }

    for (const a of this.ambientMeshes) {
      a.mesh.position.y = a.baseY + Math.sin(time * 0.7 + a.phase) * 0.7;
    }
  }
}
