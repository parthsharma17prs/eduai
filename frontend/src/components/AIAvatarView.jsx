import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './AIAvatarView.css';

/**
 * AIAvatarView - 3D Interactive AI Interviewer Component
 * Adapted from Jayesh-P006/AI-Avatar-Interview
 * Supports 3D Procedural Recruiter, GLTF ReadyPlayerMe models, Holographic Avatar, and CSS Fallback.
 */
export default function AIAvatarView({
  isSpeaking = false,
  emotion = 'neutral', // 'neutral' | 'friendly' | 'thinking' | 'curious' | 'professional'
  avatarType = 'procedural', // 'procedural' | 'hologram' | 'gltf'
  interviewerName = 'Alex (AI Lead Interviewer)',
  modelUrl = 'https://models.readyplayer.me/6460d37574ae9d9c47082164.glb?morphTargets=mouthOpen,jawOpen,viseme_aa,viseme_O,eyesClosed'
}) {
  const mountRef = useRef(null);
  const [currentMode, setCurrentMode] = useState(avatarType);
  const [loading, setLoading] = useState(true);
  const [webglSupported, setWebglSupported] = useState(true);
  const avatarManagerRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return;

    try {
      // Test WebGL availability safely
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebglSupported(false);
        setLoading(false);
        return;
      }

      // Initialize Avatar in isolated mount container
      const manager = new LiveAvatarManager(
        mountRef.current,
        currentMode,
        modelUrl,
        () => setLoading(false),
        () => {
          setWebglSupported(false);
          setLoading(false);
        }
      );
      avatarManagerRef.current = manager;
    } catch (err) {
      console.warn('[AIAvatarView] WebGL init fallback:', err.message);
      setWebglSupported(false);
      setLoading(false);
    }

    return () => {
      if (avatarManagerRef.current) {
        avatarManagerRef.current.destroy();
        avatarManagerRef.current = null;
      }
    };
  }, [currentMode, modelUrl]);

  // Handle Speaking state changes
  useEffect(() => {
    if (avatarManagerRef.current) {
      avatarManagerRef.current.setSpeaking(isSpeaking);
    }
  }, [isSpeaking]);

  // Handle Emotion state changes
  useEffect(() => {
    if (avatarManagerRef.current) {
      avatarManagerRef.current.setEmotion(emotion);
    }
  }, [emotion]);

  const handleResetCamera = () => {
    if (avatarManagerRef.current) {
      avatarManagerRef.current.resetCamera();
    }
  };

  return (
    <div className="ai-avatar-container">
      <div className="ai-avatar-header">
        <div className="ai-avatar-status">
          <span className={`status-indicator ${isSpeaking ? 'active-speaking' : 'active-listening'}`} />
          <span className="interviewer-title">{interviewerName}</span>
          <span className="ai-badge">3D AI AVATAR</span>
        </div>
        <div className="avatar-controls-top">
          <button
            type="button"
            className={`mode-pill ${currentMode === 'procedural' ? 'active' : ''}`}
            onClick={() => setCurrentMode('procedural')}
            title="3D Executive Avatar"
          >
            3D Suited
          </button>
          <button
            type="button"
            className={`mode-pill ${currentMode === 'hologram' ? 'active' : ''}`}
            onClick={() => setCurrentMode('hologram')}
            title="Holographic Stream"
          >
            Holo AI
          </button>
          <button
            type="button"
            className={`mode-pill ${currentMode === 'gltf' ? 'active' : ''}`}
            onClick={() => setCurrentMode('gltf')}
            title="Full 3D GLTF Model"
          >
            RPM 3D
          </button>
          {webglSupported && (
            <button
              type="button"
              className="cam-reset-btn"
              onClick={handleResetCamera}
              title="Reset Camera View"
            >
              ↺
            </button>
          )}
        </div>
      </div>

      <div className="canvas-wrapper">
        <div
          className="three-canvas-mount"
          ref={mountRef}
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            inset: 0,
            display: webglSupported ? 'block' : 'none'
          }}
        />

        {!webglSupported && (
          <div className="avatar-fallback-visual">
            <div className={`holo-circle-avatar ${isSpeaking ? 'speaking-pulse' : ''}`}>
              <img
                src="/images/avatar.jpg"
                alt="AI Interviewer"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <div className="holo-ring ring-1" />
              <div className="holo-ring ring-2" />
            </div>
            <div className="avatar-fallback-label">
              <span>{interviewerName}</span>
              <p>{isSpeaking ? 'Speaking...' : 'Listening attentively'}</p>
            </div>
          </div>
        )}

        {webglSupported && loading && (
          <div className="avatar-loading-overlay">
            <div className="avatar-spinner" />
            <span>Initializing 3D Interviewer...</span>
          </div>
        )}
      </div>

      <div className="ai-avatar-footer">
        <div className="voice-state">
          {isSpeaking ? (
            <div className="speaking-wave">
              <span className="wave-bar" />
              <span className="wave-bar" />
              <span className="wave-bar" />
              <span className="wave-bar" />
              <span className="wave-bar" />
              <span className="wave-label">Interviewer Speaking...</span>
            </div>
          ) : (
            <div className="listening-wave">
              <span className="listen-dot" />
              <span>Interviewer Observing & Listening</span>
            </div>
          )}
        </div>
        <div className="emotion-pill">
          <span className="emotion-dot" />
          <span>{emotion.charAt(0).toUpperCase() + emotion.slice(1)}</span>
        </div>
      </div>
    </div>
  );
}

class LiveAvatarManager {
  constructor(mountContainer, mode, modelUrl, onLoad, onError) {
    this.mountContainer = mountContainer;
    this.mode = mode;
    this.modelUrl = modelUrl;
    this.onLoad = onLoad;
    this.onError = onError;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.model = null;

    this.isSpeaking = false;
    this.emotion = 'neutral';
    this.targetSmileValue = 0;

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

    this.proceduralHead = null;
    this.proceduralMouth = null;
    this.leftEye = null;
    this.rightEye = null;

    this.avatarMesh = null;
    this.borderMaterial = null;
    this.rippleRings = [];

    this.blinkTimer = 0;
    this.blinkDuration = 0.15;
    this.nextBlinkTime = 2.5;
    this.isBlinking = false;
    this.clock = new THREE.Clock();

    try {
      this.initScene();
      this.buildModel();
      this.animate = this.animate.bind(this);
      this.animationFrameId = requestAnimationFrame(this.animate);

      this.onWindowResize = this.onWindowResize.bind(this);
      window.addEventListener('resize', this.onWindowResize);
    } catch (err) {
      console.warn('[LiveAvatarManager] Setup error:', err);
      if (this.onError) this.onError(err);
    }
  }

  initScene() {
    const width = this.mountContainer.clientWidth || 400;
    const height = this.mountContainer.clientHeight || 300;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 1.15, 0.72);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    while (this.mountContainer.firstChild) {
      this.mountContainer.removeChild(this.mountContainer.firstChild);
    }
    this.mountContainer.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableZoom = true;
    this.controls.minDistance = 0.4;
    this.controls.maxDistance = 1.8;
    this.controls.target.set(0, 1.08, 0);
    this.controls.enablePan = false;

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(1.5, 2.5, 2);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.5);
    fillLight.position.set(-1.5, 1.2, 1.5);
    this.scene.add(fillLight);

    const rimLight = new THREE.PointLight(0x8b5cf6, 1.4, 4);
    rimLight.position.set(0, 2.0, -1.2);
    this.scene.add(rimLight);
  }

  buildModel() {
    if (this.mode === 'hologram') {
      const loader = new THREE.TextureLoader();
      loader.load(
        '/images/avatar.jpg',
        (tex) => {
          this.buildHologram(tex);
          if (this.onLoad) this.onLoad();
        },
        undefined,
        () => {
          this.buildProcedural();
          if (this.onLoad) this.onLoad();
        }
      );
    } else if (this.mode === 'gltf') {
      const loader = new GLTFLoader();
      loader.load(
        this.modelUrl,
        (gltf) => {
          this.model = gltf.scene;
          this.model.position.set(0, 0, 0);
          this.scene.add(this.model);

          this.model.traverse((child) => {
            if (child.isMesh && child.morphTargetDictionary) {
              this.morphMeshes.push(child);
              Object.keys(child.morphTargetDictionary).forEach((key) => {
                const lower = key.toLowerCase();
                if (lower === 'jawopen') this.morphIndices.jawOpen = child.morphTargetDictionary[key];
                if (lower === 'mouthopen') this.morphIndices.mouthOpen = child.morphTargetDictionary[key];
                if (lower.includes('blink') && lower.includes('left')) this.morphIndices.eyeBlinkLeft = child.morphTargetDictionary[key];
                if (lower.includes('blink') && lower.includes('right')) this.morphIndices.eyeBlinkRight = child.morphTargetDictionary[key];
                if (lower.includes('smile')) this.morphIndices.mouthSmile = child.morphTargetDictionary[key];
                if (lower.includes('viseme_aa')) this.morphIndices.viseme_aa = child.morphTargetDictionary[key];
                if (lower.includes('viseme_o')) this.morphIndices.viseme_O = child.morphTargetDictionary[key];
              });
            }
          });

          this.controls.target.set(0, 1.1, 0);
          this.camera.position.set(0, 1.15, 0.7);
          if (this.onLoad) this.onLoad();
        },
        undefined,
        (err) => {
          console.warn('Could not load online GLTF avatar, using procedural 3D model:', err);
          this.buildProcedural();
          if (this.onLoad) this.onLoad();
        }
      );
    } else {
      this.buildProcedural();
      if (this.onLoad) this.onLoad();
    }
  }

  buildProcedural() {
    this.model = new THREE.Group();
    this.model.position.set(0, 0, 0);

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xffedd5,
      roughness: 0.75,
      metalness: 0.05
    });

    const neckGeom = new THREE.CylinderGeometry(0.04, 0.042, 0.08, 16);
    const neck = new THREE.Mesh(neckGeom, skinMat);
    neck.position.set(0, 0.96, 0);
    this.model.add(neck);

    const headGeom = new THREE.SphereGeometry(0.13, 32, 32);
    this.proceduralHead = new THREE.Mesh(headGeom, skinMat);
    this.proceduralHead.position.set(0, 1.12, 0);
    this.model.add(this.proceduralHead);

    const suitMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.7,
      metalness: 0.15
    });
    const torsoGeom = new THREE.CylinderGeometry(0.16, 0.13, 0.32, 32);
    const torso = new THREE.Mesh(torsoGeom, suitMat);
    torso.position.set(0, 0.77, 0);
    this.model.add(torso);

    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
    const shirtGeom = new THREE.CylinderGeometry(0.042, 0.042, 0.28, 16);
    const shirt = new THREE.Mesh(shirtGeom, shirtMat);
    shirt.position.set(0, 0.81, 0.015);
    this.model.add(shirt);

    const tieMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5 });
    const tieGeom = new THREE.BoxGeometry(0.024, 0.14, 0.01);
    const tie = new THREE.Mesh(tieGeom, tieMat);
    tie.position.set(0, 0.76, 0.055);
    this.model.add(tie);

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

    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });
    const hairTopGeom = new THREE.SphereGeometry(0.136, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const hairTop = new THREE.Mesh(hairTopGeom, hairMat);
    hairTop.position.set(0, 0.03, 0);
    this.proceduralHead.add(hairTop);

    const eyeGeom = new THREE.SphereGeometry(0.012, 16, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
    this.leftEye = new THREE.Mesh(eyeGeom, eyeMat);
    this.leftEye.position.set(-0.045, 0.015, 0.115);
    this.proceduralHead.add(this.leftEye);

    this.rightEye = new THREE.Mesh(eyeGeom, eyeMat);
    this.rightEye.position.set(0.045, 0.015, 0.115);
    this.proceduralHead.add(this.rightEye);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.7, roughness: 0.3 });
    const frameGeom = new THREE.TorusGeometry(0.022, 0.004, 8, 24);
    const frameL = new THREE.Mesh(frameGeom, frameMat);
    frameL.position.set(-0.045, 0.015, 0.125);
    this.proceduralHead.add(frameL);

    const frameR = new THREE.Mesh(frameGeom, frameMat);
    frameR.position.set(0.045, 0.015, 0.125);
    this.proceduralHead.add(frameR);

    const bridgeGeom = new THREE.CylinderGeometry(0.003, 0.003, 0.024, 8);
    const bridge = new THREE.Mesh(bridgeGeom, frameMat);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.015, 0.125);
    this.proceduralHead.add(bridge);

    const mouthGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.004, 16);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0xbe123c });
    this.proceduralMouth = new THREE.Mesh(mouthGeom, mouthMat);
    this.proceduralMouth.rotation.x = Math.PI / 2;
    this.proceduralMouth.position.set(0, -0.05, 0.12);
    this.proceduralMouth.scale.set(1.0, 0.1, 1.0);
    this.proceduralHead.add(this.proceduralMouth);

    this.scene.add(this.model);
    this.controls.target.set(0, 1.05, 0);
    this.camera.position.set(0, 1.15, 0.65);
  }

  buildHologram(texture) {
    this.model = new THREE.Group();
    this.model.position.set(0, 1.1, 0);

    const geometry = new THREE.CircleGeometry(0.24, 64);
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    this.avatarMesh = new THREE.Mesh(geometry, material);
    this.model.add(this.avatarMesh);

    const ringGeom = new THREE.RingGeometry(0.24, 0.248, 64);
    this.borderMaterial = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeom, this.borderMaterial);
    ring.position.set(0, 0, 0.002);
    this.model.add(ring);

    this.rippleRings = [];
    for (let i = 0; i < 3; i++) {
      const rGeom = new THREE.RingGeometry(0.24, 0.248, 64);
      const rMat = new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
      });
      const rMesh = new THREE.Mesh(rGeom, rMat);
      rMesh.position.set(0, 0, -0.005);
      this.model.add(rMesh);
      this.rippleRings.push({ mesh: rMesh, scale: 1.0, speed: 1.2 + i * 0.35 });
    }

    this.scene.add(this.model);
    this.controls.target.set(0, 1.1, 0);
    this.camera.position.set(0, 1.1, 0.85);
  }

  setSpeaking(speaking) {
    this.isSpeaking = speaking;
  }

  setEmotion(emotion) {
    this.emotion = emotion;
    if (this.borderMaterial) {
      let color = 0x06b6d4;
      if (emotion === 'friendly' || emotion === 'smiling') color = 0x10b981;
      if (emotion === 'thinking') color = 0xa855f7;
      if (emotion === 'curious') color = 0x3b82f6;
      this.borderMaterial.color.setHex(color);
      this.rippleRings.forEach(r => r.mesh.material.color.setHex(color));
    }
  }

  resetCamera() {
    if (this.controls && this.camera) {
      this.controls.target.set(0, 1.08, 0);
      this.camera.position.set(0, 1.15, 0.72);
      this.controls.update();
    }
  }

  onWindowResize() {
    if (!this.mountContainer || !this.camera || !this.renderer) return;
    const width = this.mountContainer.clientWidth || 400;
    const height = this.mountContainer.clientHeight || 300;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    if (this.model) {
      this.model.position.y = (this.mode === 'hologram' ? 1.1 : 0) + Math.sin(time * 1.5) * 0.004;
      if (this.proceduralHead) {
        this.proceduralHead.rotation.x = Math.sin(time * 1.2) * 0.012;
        this.proceduralHead.rotation.y = Math.cos(time * 0.7) * 0.018;
      }
    }

    this.blinkTimer += delta;
    if (this.blinkTimer >= this.nextBlinkTime) {
      this.isBlinking = true;
      this.blinkTimer = 0;
      this.nextBlinkTime = 2.0 + Math.random() * 3.5;
    }
    let blinkProgress = 0;
    if (this.isBlinking) {
      const p = this.blinkTimer / this.blinkDuration;
      blinkProgress = p <= 0.5 ? p * 2 : 2 - p * 2;
      if (p > 1.0) this.isBlinking = false;
    }

    let targetMouth = 0;
    if (this.isSpeaking) {
      const w1 = Math.sin(time * 16) * 0.5 + 0.5;
      const w2 = Math.cos(time * 9) * 0.5 + 0.5;
      targetMouth = (w1 * 0.6 + w2 * 0.4) * 0.65;
    }

    if (this.mode === 'procedural') {
      if (this.proceduralMouth) {
        const targetScale = this.isSpeaking ? 1.0 + targetMouth * 6.0 : 0.1;
        this.proceduralMouth.scale.y = THREE.MathUtils.lerp(this.proceduralMouth.scale.y, targetScale, 0.35);
      }
      if (this.leftEye && this.rightEye) {
        const eyeY = this.isBlinking ? 0.08 : 1.0;
        this.leftEye.scale.y = eyeY;
        this.rightEye.scale.y = eyeY;
      }
    } else if (this.mode === 'hologram') {
      if (this.avatarMesh) {
        const pulse = this.isSpeaking ? 1.0 + targetMouth * 0.05 : 1.0;
        this.avatarMesh.scale.set(pulse, pulse, 1);
      }
      this.rippleRings.forEach((ring) => {
        if (this.isSpeaking) {
          ring.scale += delta * ring.speed * 1.5;
          if (ring.scale > 2.4) ring.scale = 1.0;
          ring.mesh.scale.set(ring.scale, ring.scale, 1);
          ring.mesh.material.opacity = ((2.4 - ring.scale) / 1.4) * 0.5;
        } else {
          ring.mesh.material.opacity = THREE.MathUtils.lerp(ring.mesh.material.opacity, 0, delta * 5);
        }
      });
    } else if (this.morphMeshes.length > 0) {
      this.morphMeshes.forEach((mesh) => {
        if (this.morphIndices.jawOpen !== -1) {
          mesh.morphTargetInfluences[this.morphIndices.jawOpen] = THREE.MathUtils.lerp(
            mesh.morphTargetInfluences[this.morphIndices.jawOpen],
            targetMouth,
            0.45
          );
        }
        if (this.morphIndices.eyeBlinkLeft !== -1) {
          mesh.morphTargetInfluences[this.morphIndices.eyeBlinkLeft] = blinkProgress;
        }
        if (this.morphIndices.eyeBlinkRight !== -1) {
          mesh.morphTargetInfluences[this.morphIndices.eyeBlinkRight] = blinkProgress;
        }
      });
    }

    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  destroy() {
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.onWindowResize);
    if (this.renderer) {
      try {
        this.renderer.dispose();
      } catch {}
      if (this.mountContainer && this.renderer.domElement && this.mountContainer.contains(this.renderer.domElement)) {
        try {
          this.mountContainer.removeChild(this.renderer.domElement);
        } catch {}
      }
    }
  }
}

