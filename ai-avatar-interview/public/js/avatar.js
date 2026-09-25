import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class AvatarManager {
  constructor(containerId, avatarUrl, onLoadCallback) {
    this.container = document.getElementById(containerId);
    this.avatarUrl = avatarUrl;
    this.onLoadCallback = onLoadCallback;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.model = null;
    
    // Meshes with morph targets (head, teeth, etc.)
    this.morphMeshes = [];
    this.morphIndices = {
      jawOpen: -1,
      mouthOpen: -1,
      eyeBlinkLeft: -1,
      eyeBlinkRight: -1,
      mouthSmile: -1,
      viseme_aa: -1,
      viseme_O: -1
    };

    // Procedural professional fallback states
    this.usingProcedural = false;
    this.proceduralHead = null;
    this.proceduralMouth = null;
    this.leftEye = null;
    this.rightEye = null;

    // Animation states
    this.isSpeaking = false;
    this.speechVolume = 0;
    
    this.blinkTimer = 0;
    this.blinkDuration = 0.15; // seconds
    this.nextBlinkTime = 3.0; // blink every 3 seconds on average
    this.isBlinking = false;
    
    this.clock = new THREE.Clock();
    this.neckBone = null;
    this.headBone = null;

    this.initScene();
    this.loadAvatar();
    this.animate();

    // Handle Window Resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  initScene() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // Create Scene
    this.scene = new THREE.Scene();
    this.scene.background = null; // transparent

    // Create Camera (Focus on head/torso)
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 1.15, 0.65);

    // Create Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

    // Setup Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableZoom = true;
    this.controls.minDistance = 0.4;
    this.controls.maxDistance = 2.0;
    this.controls.target.set(0, 1.12, 0); // Focus height
    this.controls.enablePan = false;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.1;
    this.controls.minPolarAngle = Math.PI / 3;

    // Professional Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambientLight);

    // Key Light
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
    keyLight.position.set(1.5, 2, 2);
    this.scene.add(keyLight);

    // Fill Light
    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.45);
    fillLight.position.set(-1.5, 1, 1);
    this.scene.add(fillLight);

    // Rim Light
    const rimLight = new THREE.PointLight(0xa855f7, 1.2, 4); // Purple backlight glow
    rimLight.position.set(0, 2.0, -1.5);
    this.scene.add(rimLight);
  }

  loadAvatar() {
    const isImage = this.avatarUrl.toLowerCase().match(/\.(jpeg|jpg|gif|png)$/) !== null;

    if (isImage) {
      console.log("Loading image-based 3D holographic avatar:", this.avatarUrl);
      const loader = new THREE.TextureLoader();
      loader.load(
        this.avatarUrl,
        (texture) => {
          this.buildHologramAvatar(texture);
          if (this.onLoadCallback) {
            this.onLoadCallback();
          }
        },
        undefined,
        (error) => {
          console.warn('Error loading avatar texture, using procedural fallback:', error);
          this.buildProceduralAvatar();
        }
      );
    } else {
      const loader = new GLTFLoader();
      loader.load(
        this.avatarUrl,
        (gltf) => {
          this.model = gltf.scene;
          this.model.position.set(0, 0, 0);
          this.scene.add(this.model);

          // Traverse model to find bones and morph targets
          this.model.traverse((child) => {
            if (child.isBone) {
              if (child.name.toLowerCase().includes('neck')) this.neckBone = child;
              if (child.name.toLowerCase().includes('head')) this.headBone = child;
            }

            if (child.isMesh && child.morphTargetDictionary) {
              this.morphMeshes.push(child);
              
              Object.keys(child.morphTargetDictionary).forEach((key) => {
                const lowerKey = key.toLowerCase();
                if (lowerKey === 'jawopen') this.morphIndices.jawOpen = child.morphTargetDictionary[key];
                if (lowerKey === 'mouthopen') this.morphIndices.mouthOpen = child.morphTargetDictionary[key];
                if (lowerKey.includes('blink') && lowerKey.includes('left')) this.morphIndices.eyeBlinkLeft = child.morphTargetDictionary[key];
                if (lowerKey.includes('blink') && lowerKey.includes('right')) this.morphIndices.eyeBlinkRight = child.morphTargetDictionary[key];
                if (lowerKey.includes('smile')) this.morphIndices.mouthSmile = child.morphTargetDictionary[key];
                if (lowerKey.includes('viseme_aa')) this.morphIndices.viseme_aa = child.morphTargetDictionary[key];
                if (lowerKey.includes('viseme_o')) this.morphIndices.viseme_O = child.morphTargetDictionary[key];
              });
            }
          });

          console.log("GLTF Avatar loaded successfully. Morph meshes found:", this.morphMeshes.length);

          if (this.neckBone) {
            const worldPos = new THREE.Vector3();
            this.neckBone.getWorldPosition(worldPos);
            this.controls.target.set(0, worldPos.y + 0.15, 0);
            this.camera.position.set(0, worldPos.y + 0.2, 0.75);
          }

          if (this.onLoadCallback) {
            this.onLoadCallback();
          }
        },
        undefined,
        (error) => {
          console.warn('Network issue loading GLTF avatar, activating procedural professional recruiter fallback:', error.message);
          this.buildProceduralAvatar();
        }
      );
    }
  }

  buildHologramAvatar(texture) {
    this.usingHologram = true;
    
    // Create a Group to hold the holographic elements
    this.model = new THREE.Group();
    this.model.position.set(0, 1.1, 0);

    // Circular Avatar Mesh
    const geometry = new THREE.CircleGeometry(0.24, 64);
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    this.avatarMesh = new THREE.Mesh(geometry, material);
    this.avatarMesh.position.set(0, 0, 0);
    this.model.add(this.avatarMesh);

    // Glowing border ring
    const ringGeom = new THREE.RingGeometry(0.24, 0.245, 64);
    this.borderMaterial = new THREE.MeshBasicMaterial({ color: 0x00f2fe, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeom, this.borderMaterial);
    ring.position.set(0, 0, 0.002);
    this.model.add(ring);

    // Ripple Rings (for dynamic soundwaves when speaking)
    this.rippleRings = [];
    const rippleCount = 3;
    for (let i = 0; i < rippleCount; i++) {
      const rGeom = new THREE.RingGeometry(0.24, 0.245, 64);
      const rMat = new THREE.MeshBasicMaterial({
        color: 0x00f2fe,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
      });
      const rMesh = new THREE.Mesh(rGeom, rMat);
      rMesh.position.set(0, 0, -0.005);
      this.model.add(rMesh);
      this.rippleRings.push({
        mesh: rMesh,
        scale: 1.0,
        speed: 1.2 + i * 0.3
      });
    }

    this.scene.add(this.model);

    // Setup Camera and controls focus
    this.controls.target.set(0, 1.1, 0);
    this.camera.position.set(0, 1.1, 0.85);

    // Restrict azimuthal rotation for clean 3D parallax tilt bounds
    this.controls.minAzimuthAngle = -Math.PI / 6;
    this.controls.maxAzimuthAngle = Math.PI / 6;
  }

  // Generates a beautiful professional suited recruiter character procedurally
  buildProceduralAvatar() {
    this.usingProcedural = true;

    // Create a Group to hold the character parts
    this.model = new THREE.Group();
    this.model.position.set(0, 0, 0); // Root position

    // 1. SKIN MATERIAL (Warm natural skin tone)
    const skinColor = 0xffedd5; // Peach beige
    const skinMat = new THREE.MeshStandardMaterial({ 
      color: skinColor, 
      roughness: 0.8,
      metalness: 0.05
    });

    // 2. NECK
    const neckGeom = new THREE.CylinderGeometry(0.038, 0.04, 0.08, 16);
    const neck = new THREE.Mesh(neckGeom, skinMat);
    neck.position.set(0, 0.96, 0);
    this.model.add(neck);

    // 3. HEAD SPHERE
    const headGeom = new THREE.SphereGeometry(0.13, 32, 32);
    this.proceduralHead = new THREE.Mesh(headGeom, skinMat);
    this.proceduralHead.position.set(0, 1.12, 0);
    this.model.add(this.proceduralHead);

    // 4. TORSO IN A SUIT
    const suitColor = 0x0f172a; // Deep slate/navy suit jacket
    const suitMat = new THREE.MeshStandardMaterial({ 
      color: suitColor, 
      roughness: 0.75,
      metalness: 0.1
    });
    
    // Torso Base (Coat shape)
    const torsoGeom = new THREE.CylinderGeometry(0.16, 0.13, 0.32, 32);
    const torso = new THREE.Mesh(torsoGeom, suitMat);
    torso.position.set(0, 0.77, 0);
    this.model.add(torso);

    // Inner White Shirt
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
    const shirtGeom = new THREE.CylinderGeometry(0.042, 0.042, 0.28, 16);
    const shirt = new THREE.Mesh(shirtGeom, shirtMat);
    shirt.position.set(0, 0.81, 0.015);
    this.model.add(shirt);

    // Professional Red Tie
    const tieMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.6 }); // Red tie
    const tieGeom = new THREE.BoxGeometry(0.022, 0.13, 0.01);
    const tie = new THREE.Mesh(tieGeom, tieMat);
    tie.position.set(0, 0.76, 0.055);
    this.model.add(tie);

    // Lapels (Suit details to build the V-cut shape)
    const lapelGeom = new THREE.BoxGeometry(0.045, 0.16, 0.018);
    
    const leftLapel = new THREE.Mesh(lapelGeom, suitMat);
    leftLapel.position.set(-0.065, 0.85, 0.04);
    leftLapel.rotation.z = 0.25;
    leftLapel.rotation.y = 0.15;
    this.model.add(leftLapel);

    const rightLapel = new THREE.Mesh(lapelGeom, suitMat);
    rightLapel.position.set(0.065, 0.85, 0.04);
    rightLapel.rotation.z = -0.25;
    rightLapel.rotation.y = -0.15;
    this.model.add(rightLapel);

    // 5. PROFESSIONAL HAIRCUT
    const hairColor = 0x27272a; // Dark charcoal hair
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.9 });
    
    // Top Hair
    const hairTopGeom = new THREE.SphereGeometry(0.136, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const hairTop = new THREE.Mesh(hairTopGeom, hairMat);
    hairTop.position.set(0, 0.03, 0);
    this.proceduralHead.add(hairTop);

    // Back Hair
    const hairBackGeom = new THREE.SphereGeometry(0.133, 16, 16, 0, Math.PI, 0, Math.PI);
    const hairBack = new THREE.Mesh(hairBackGeom, hairMat);
    hairBack.position.set(0, 0, -0.01);
    hairBack.rotation.y = Math.PI / 2;
    this.proceduralHead.add(hairBack);
    
    // Sideburns
    const sideburnGeom = new THREE.BoxGeometry(0.018, 0.07, 0.05);
    
    const sideburnL = new THREE.Mesh(sideburnGeom, hairMat);
    sideburnL.position.set(-0.12, -0.02, 0.02);
    this.proceduralHead.add(sideburnL);

    const sideburnR = new THREE.Mesh(sideburnGeom, hairMat);
    sideburnR.position.set(0.12, -0.02, 0.02);
    this.proceduralHead.add(sideburnR);

    // 6. EYES (Neat pupils & highlights)
    const eyeGeom = new THREE.SphereGeometry(0.011, 16, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1f2937 }); // Dark eyes
    
    this.leftEye = new THREE.Mesh(eyeGeom, eyeMat);
    this.leftEye.position.set(-0.045, 0.015, 0.115);
    this.proceduralHead.add(this.leftEye);

    this.rightEye = new THREE.Mesh(eyeGeom, eyeMat);
    this.rightEye.position.set(0.045, 0.015, 0.115);
    this.proceduralHead.add(this.rightEye);

    // Highlights
    const highlightGeom = new THREE.SphereGeometry(0.0035, 8, 8);
    const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    const hl = new THREE.Mesh(highlightGeom, highlightMat);
    hl.position.set(0.003, 0.003, 0.01);
    this.leftEye.add(hl);

    const hr = new THREE.Mesh(highlightGeom, highlightMat);
    hr.position.set(0.003, 0.003, 0.01);
    this.rightEye.add(hr);

    // 7. GLASSES (To look smart/intellectual)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.2 });
    const frameGeom = new THREE.TorusGeometry(0.022, 0.004, 8, 24);
    
    const frameL = new THREE.Mesh(frameGeom, frameMat);
    frameL.position.set(-0.045, 0.015, 0.125);
    this.proceduralHead.add(frameL);

    const frameR = new THREE.Mesh(frameGeom, frameMat);
    frameR.position.set(0.045, 0.015, 0.125);
    this.proceduralHead.add(frameR);

    // Glasses Bridge
    const bridgeGeom = new THREE.CylinderGeometry(0.003, 0.003, 0.024, 8);
    const bridge = new THREE.Mesh(bridgeGeom, frameMat);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.015, 0.125);
    this.proceduralHead.add(bridge);

    // 8. MOUTH (Procedural capsule that scales on Y to talk)
    const mouthGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.004, 16);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0xbe123c }); // Lipstick rose
    this.proceduralMouth = new THREE.Mesh(mouthGeom, mouthMat);
    this.proceduralMouth.rotation.x = Math.PI / 2;
    this.proceduralMouth.position.set(0, -0.05, 0.12);
    this.proceduralMouth.scale.set(1.0, 0.1, 1.0); // thin slit by default
    this.proceduralHead.add(this.proceduralMouth);

    // Add model group to scene
    this.scene.add(this.model);

    // Focus Camera on character head/shoulders
    this.controls.target.set(0, 1.05, 0);
    this.camera.position.set(0, 1.15, 0.65);

    // Fire callback to remove lobby loading screen
    if (this.onLoadCallback) {
      this.onLoadCallback();
    }
  }

  setSpeaking(speaking) {
    this.isSpeaking = speaking;
  }

  setEmotion(emotion) {
    if (this.usingHologram && this.borderMaterial) {
      let color = 0x00f2fe; // default cyan
      switch (emotion) {
        case 'smiling':
        case 'friendly':
          color = 0x10b981; // green
          break;
        case 'curious':
          color = 0x00f2fe; // cyan
          break;
        case 'thinking':
          color = 0xa855f7; // purple
          break;
        case 'professional':
        case 'neutral':
        default:
          color = 0x4facfe; // blue
          break;
      }
      this.borderMaterial.color.setHex(color);
      if (this.rippleRings) {
        this.rippleRings.forEach(r => r.mesh.material.color.setHex(color));
      }
      return;
    }

    if (this.usingProcedural) {
      // Procedural response (can tilt head slightly based on emotion)
      if (this.proceduralHead) {
        if (emotion === 'smiling' || emotion === 'friendly') {
          this.proceduralHead.rotation.z = 0.04; // Friendly tilt
        } else if (emotion === 'thinking' || emotion === 'curious') {
          this.proceduralHead.rotation.z = -0.05; // Analytical tilt
        } else {
          this.proceduralHead.rotation.z = 0;
        }
      }
      return;
    }

    if (!this.morphMeshes.length) return;

    let targetSmile = 0.0;
    switch (emotion) {
      case 'smiling':
      case 'friendly':
        targetSmile = 0.55;
        break;
      case 'curious':
        targetSmile = 0.15;
        break;
      case 'professional':
      case 'neutral':
      default:
        targetSmile = 0.0;
        break;
    }

    this.targetSmileValue = targetSmile;
  }

  onWindowResize() {
    if (!this.container || !this.camera || !this.renderer) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // 1. Breathing / Float Motion
    if (this.model) {
      if (this.usingHologram) {
        // High-tech holographic breathing/float motion around Y=1.1
        this.model.position.y = 1.1 + Math.sin(time * 1.5) * 0.012;
        this.model.rotation.y = Math.sin(time * 0.8) * 0.04;
        this.model.rotation.x = Math.cos(time * 0.6) * 0.015;
      } else if (this.usingProcedural) {
        // Natural vertical float (breathing simulation)
        this.model.position.y = Math.sin(time * 1.5) * 0.004;
        if (this.proceduralHead) {
          // Subtle random head tilting
          this.proceduralHead.rotation.x = Math.sin(time * 1.2) * 0.015;
          this.proceduralHead.rotation.y = Math.cos(time * 0.7) * 0.02;
        }
      } else {
        this.model.position.y = Math.sin(time * 1.5) * 0.003;
        if (this.neckBone) {
          this.neckBone.rotation.x = Math.sin(time * 1.5) * 0.015;
          this.neckBone.rotation.y = Math.cos(time * 0.8) * 0.01;
        }
        if (this.headBone) {
          this.headBone.rotation.z = Math.sin(time * 0.5) * 0.005;
        }
      }
    }

    // 2. Eye Blinking Logic
    this.blinkTimer += delta;
    if (this.blinkTimer >= this.nextBlinkTime) {
      this.isBlinking = true;
      this.blinkTimer = 0;
      this.nextBlinkTime = 2.0 + Math.random() * 4.0;
    }

    let blinkInfluence = 0;
    if (this.isBlinking) {
      const blinkProgress = this.blinkTimer / this.blinkDuration;
      if (blinkProgress <= 0.5) {
        blinkInfluence = blinkProgress * 2;
      } else if (blinkProgress <= 1.0) {
        blinkInfluence = 2 - (blinkProgress * 2);
      } else {
        this.isBlinking = false;
        blinkInfluence = 0;
      }
    }

    // 3. Speaking (Lip Sync) Logic & Procedural mouth scale
    let targetMouthOpen = 0;
    let targetVisemeAA = 0;
    let targetVisemeO = 0;

    if (this.isSpeaking) {
      const speakWave1 = Math.sin(time * 16) * 0.5 + 0.5;
      const speakWave2 = Math.cos(time * 9) * 0.5 + 0.5;
      const wave = (speakWave1 * 0.6 + speakWave2 * 0.4);
      
      targetMouthOpen = wave * 0.65;
      targetVisemeAA = wave * 0.5;
      targetVisemeO = Math.sin(time * 12) > 0.3 ? wave * 0.4 : 0;
    }

    // A. Apply to Hologram Ripple & Scale Pulse (If using image hologram)
    if (this.usingHologram) {
      if (this.avatarMesh) {
        const pulseScale = this.isSpeaking ? 1.0 + targetMouthOpen * 0.04 : 1.0;
        this.avatarMesh.scale.set(
          THREE.MathUtils.lerp(this.avatarMesh.scale.x, pulseScale, 0.2),
          THREE.MathUtils.lerp(this.avatarMesh.scale.y, pulseScale, 0.2),
          1
        );
      }

      if (this.rippleRings) {
        this.rippleRings.forEach((ripple) => {
          if (this.isSpeaking) {
            ripple.scale += delta * ripple.speed * 1.5;
            if (ripple.scale > 2.5) {
              ripple.scale = 1.0;
            }
            ripple.mesh.scale.set(ripple.scale, ripple.scale, 1);
            const opacity = ((2.5 - ripple.scale) / 1.5) * 0.45;
            ripple.mesh.material.opacity = opacity;
          } else {
            ripple.mesh.material.opacity = THREE.MathUtils.lerp(ripple.mesh.material.opacity, 0, delta * 5);
            ripple.scale = THREE.MathUtils.lerp(ripple.scale, 1.0, delta * 2);
            ripple.mesh.scale.set(ripple.scale, ripple.scale, 1);
          }
        });
      }
    }
    // B. Apply to Procedural Suited Recruiter Fallback
    else if (this.usingProcedural) {
      if (this.proceduralMouth) {
        // Scale mouth vertically when talking
        const scaleY = this.isSpeaking ? 1.0 + targetMouthOpen * 6.5 : 0.1;
        this.proceduralMouth.scale.y = THREE.MathUtils.lerp(this.proceduralMouth.scale.y, scaleY, 0.35);
      }

      // Blink character eyes
      const eyeScaleY = this.isBlinking ? 0.05 : 1.0;
      if (this.leftEye && this.rightEye) {
        this.leftEye.scale.y = THREE.MathUtils.lerp(this.leftEye.scale.y, eyeScaleY, 0.5);
        this.rightEye.scale.y = THREE.MathUtils.lerp(this.rightEye.scale.y, eyeScaleY, 0.5);
      }
    } 
    // C. Apply to GLTF Ready Player Me Morph Targets
    else if (this.morphMeshes.length > 0) {
      this.morphMeshes.forEach((mesh) => {
        // Blinking
        if (this.morphIndices.eyeBlinkLeft !== -1) {
          mesh.morphTargetInfluences[this.morphIndices.eyeBlinkLeft] = THREE.MathUtils.lerp(
            mesh.morphTargetInfluences[this.morphIndices.eyeBlinkLeft],
            blinkInfluence,
            0.6
          );
        }
        if (this.morphIndices.eyeBlinkRight !== -1) {
          mesh.morphTargetInfluences[this.morphIndices.eyeBlinkRight] = THREE.MathUtils.lerp(
            mesh.morphTargetInfluences[this.morphIndices.eyeBlinkRight],
            blinkInfluence,
            0.6
          );
        }

        // Speaking
        if (this.morphIndices.jawOpen !== -1) {
          mesh.morphTargetInfluences[this.morphIndices.jawOpen] = THREE.MathUtils.lerp(
            mesh.morphTargetInfluences[this.morphIndices.jawOpen],
            targetMouthOpen,
            0.45
          );
        }
        if (this.morphIndices.mouthOpen !== -1) {
          mesh.morphTargetInfluences[this.morphIndices.mouthOpen] = THREE.MathUtils.lerp(
            mesh.morphTargetInfluences[this.morphIndices.mouthOpen],
            targetMouthOpen * 0.8,
            0.45
          );
        }
        if (this.morphIndices.viseme_aa !== -1) {
          mesh.morphTargetInfluences[this.morphIndices.viseme_aa] = THREE.MathUtils.lerp(
            mesh.morphTargetInfluences[this.morphIndices.viseme_aa],
            targetVisemeAA,
            0.45
          );
        }
        if (this.morphIndices.viseme_O !== -1) {
          mesh.morphTargetInfluences[this.morphIndices.viseme_O] = THREE.MathUtils.lerp(
            mesh.morphTargetInfluences[this.morphIndices.viseme_O],
            targetVisemeO,
            0.4
          );
        }

        // Expressions
        if (this.morphIndices.mouthSmile !== -1 && this.targetSmileValue !== undefined) {
          mesh.morphTargetInfluences[this.morphIndices.mouthSmile] = THREE.MathUtils.lerp(
            mesh.morphTargetInfluences[this.morphIndices.mouthSmile],
            this.targetSmileValue,
            0.1
          );
        }
      });
    }

    // 4. Update Orbit Controls & Render
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  destroy() {
    if (this.renderer) {
      this.renderer.dispose();
      if (this.container.contains(this.renderer.domElement)) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.model = null;
    this.morphMeshes = [];
    this.proceduralHead = null;
    this.proceduralMouth = null;
    this.leftEye = null;
    this.rightEye = null;
    this.avatarMesh = null;
    this.borderMaterial = null;
    this.rippleRings = null;
  }
}
