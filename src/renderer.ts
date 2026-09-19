import * as THREE from 'three';
import { dayNightColor, sunDir, moonDir } from './sky';

export class Renderer {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  moon: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  amb: THREE.PointLight;
  flashlight: THREE.SpotLight;
  sky: THREE.Mesh;
  sunSprite: THREE.Sprite;
  moonSprite: THREE.Sprite;
  stars: THREE.Points;
  worldGroup: THREE.Group;
  private fog: THREE.FogExp2;

  constructor(canvas: HTMLCanvasElement) {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(0x101825, 0.005);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0x0a0f1a);

    this.camera = new THREE.PerspectiveCamera(75, w / h, 0.05, 400);
    this.camera.position.set(0, 40, 0);

    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);

    // Lights
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const cam = this.camera;
    void cam;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 200;
    const sc = this.sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // Moonlight: second directional key light for night. No shadows (cheap);
    // gives surfaces real shape so dusk/night aren't flat black.
    this.moon = new THREE.DirectionalLight(0x8fa6d8, 0.0);
    this.moon.castShadow = false;
    this.scene.add(this.moon);
    this.scene.add(this.moon.target);

    this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0x0a0c10, 0.5);
    this.scene.add(this.hemi);

    this.amb = new THREE.PointLight(0x2a3a5a, 0.3, 40);
    this.scene.add(this.amb);

    // Flashlight
    this.flashlight = new THREE.SpotLight(0xfff2cc, 0, 30, 0.5, 0.45, 1.4);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(1024, 1024);
    this.flashlight.position.set(0, 0, 0);
    this.flashlight.visible = false;
    this.scene.add(this.flashlight);
    this.scene.add(this.flashlight.target);

    // Sky
    this.sky = this.makeSky();
    this.scene.add(this.sky);

    // Sun sprite
    this.sunSprite = this.makeSun();
    this.scene.add(this.sunSprite);

    // Moon sprite
    this.moonSprite = this.makeMoon();
    this.moonSprite.visible = false;
    this.scene.add(this.moonSprite);

    // Stars
    this.stars = this.makeStars();
    this.stars.visible = false;
    this.scene.add(this.stars);

    window.addEventListener('resize', this.resize);
  }

  private makeSky(): THREE.Mesh {
    const geom = new THREE.SphereGeometry(380, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vDir;
        void main(){
          vec4 wp = modelMatrix * vec4(position,1.0);
          vDir = normalize(wp.xyz - cameraPosition);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        void main(){
          float h = clamp(vDir.y * 1.4 + 0.18, 0.0, 1.0);
          vec3 col = mix(bottomColor, topColor, h);
          // subtle horizon glow band
          float glow = 1.0 - abs(vDir.y - 0.02) * 4.0;
          col += vec3(0.05, 0.04, 0.03) * clamp(glow, 0.0, 1.0) * 0.4;
          gl_FragColor = vec4(col, 1.0);
        }`,
      uniforms: {
        topColor: { value: new THREE.Color(0x0a1420) },
        bottomColor: { value: new THREE.Color(0x1a2838) },
      },
    });
    return new THREE.Mesh(geom, mat);
  }

  private makeSun(): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,240,200,1)');
    grad.addColorStop(0.4, 'rgba(255,220,160,0.5)');
    grad.addColorStop(1, 'rgba(255,200,140,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(60, 60, 1);
    return s;
  }

  private makeMoon(): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createRadialGradient(60, 58, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(235,240,255,1)');
    grad.addColorStop(0.5, 'rgba(200,215,245,0.85)');
    grad.addColorStop(0.62, 'rgba(150,170,210,0.15)');
    grad.addColorStop(1, 'rgba(120,140,180,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    // faint crater speckles for a hand-made, non-flat moon
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#8ea0c8';
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + i * 2.3;
      const r = 10 + (i % 5) * 4;
      const x = 64 + Math.cos(a) * r;
      const y = 62 + Math.sin(a) * r;
      ctx.beginPath();
      ctx.arc(x, y, 3 + (i % 3) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(44, 44, 1);
    return s;
  }

  private makeStars(): THREE.Points {
    const count = 800;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(Math.random());
      const r = 350;
      positions[i * 3] = r * Math.sin(b) * Math.cos(a);
      positions[i * 3 + 1] = Math.abs(r * Math.cos(b));
      positions[i * 3 + 2] = r * Math.sin(b) * Math.sin(a);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const m = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
    return new THREE.Points(g, m);
  }

  updateSky(timeOfDay: number, fogDensity: number): void {
    const cam = this.camera;
    const sun = sunDir(timeOfDay);
    const col = dayNightColor(timeOfDay);
    (this.scene.background as THREE.Color).copy(col.bottom);
    this.fog.color.copy(col.fog);
    this.fog.density = fogDensity;

    const skyMat = this.sky.material as THREE.ShaderMaterial;
    skyMat.uniforms.topColor.value.copy(col.top);
    skyMat.uniforms.bottomColor.value.copy(col.bottom);

    const sunUp = sun.y > -0.12;
    this.sun.visible = sunUp;
    this.sunSprite.visible = sun.y > -0.05;
    const md = moonDir(timeOfDay);
    const moonUp = md.y > -0.05;
    this.moon.visible = moonUp;
    this.moonSprite.visible = moonUp && !this.sunSprite.visible;
    this.stars.visible = !sunUp;
    this.sun.position.copy(cam.position).add(sun.clone().multiplyScalar(80));
    this.sun.target.position.copy(cam.position);
    this.sun.target.updateMatrixWorld();
    // floor at low sun so dawn/dusk light stays useful through civil twilight
    this.sun.intensity = 2.7 * (0.42 + 0.58 * Math.pow(Math.max(sun.y, 0), 0.6));
    this.sun.color.copy(col.sunLight);
    this.moon.position.copy(cam.position).add(md.clone().multiplyScalar(80));
    this.moon.target.position.copy(cam.position);
    this.moon.intensity = 2.6 * Math.pow(Math.max(md.y, 0), 0.7) * (1 - Math.pow(Math.max(sun.y, 0), 2));
    this.moon.color.set(0x9fb4e2);
    // Smooth day<->night blend from the sun's elevation (soft ramp, no snap at dawn/dusk).
    const nightf = THREE.MathUtils.clamp((-sun.y - 0.1) / 0.14, 0, 1);
    // generous dawn floor keeps early-morning shadow sides readable, not black
    const dayHemiI = 0.72 + Math.max(sun.y, 0) * 0.85;
    const nightHemiI = 0.75 + Math.pow(Math.max(md.y, 0), 0.6) * 0.3;
    this.hemi.intensity = dayHemiI + (nightHemiI - dayHemiI) * nightf;
    const dayTint = col.skyTint.clone(), dayGround = col.ground.clone();
    dayTint.lerp(new THREE.Color(0x3a4d74), nightf);   // moonlit-blue night floor
    dayGround.lerp(new THREE.Color(0x1c2740), nightf);
    this.hemi.color.copy(dayTint);
    this.hemi.groundColor.copy(dayGround);
    this.sunSprite.position.copy(cam.position).add(sun.clone().normalize().multiplyScalar(340));
    const ss = this.sunSprite.scale;
    ss.set(40 + (1 - sun.y) * 30, 40 + (1 - sun.y) * 30, 1);
    this.moonSprite.position.copy(cam.position).add(md.clone().normalize().multiplyScalar(340));
    // sky dome + stars ride with the camera so distant travel never exits them
    this.sky.position.copy(cam.position);
    this.stars.position.copy(cam.position);
  }

  resize = (): void => {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  /** Shadow quality: 0 off, 1 low (1024), 2 high (2048). */
  setShadowQuality(q: number): void {
    const sm = this.renderer.shadowMap;
    if (q === 0) { sm.enabled = false; return; }
    sm.enabled = true;
    const size = q === 1 ? 1024 : 2048;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      (this.sun.shadow as unknown as { map: unknown }).map = null;
    }
  }

  setResolutionScale(s: number): void {
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio) * s);
  }
}
