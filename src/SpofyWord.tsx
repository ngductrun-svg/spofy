import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { StemSubjects } from "./StemSubjects";

type Stroke = { points: number[][]; closed?: boolean };
// Centre lines keep the word legible while every visible strand winds in 3D.
const letters: Stroke[][] = [
  [{ points: [[.84,.88],[.66,1],[.34,.99],[.12,.82],[.17,.63],[.43,.52],[.71,.41],[.83,.24],[.69,.06],[.39,0],[.1,.13]] }],
  [{ points: [[.13,0],[.12,.5],[.12,1]] }, { points: [[.12,1],[.48,1],[.78,.88],[.81,.69],[.62,.53],[.12,.52]] }],
  [{ points: Array.from({ length: 12 }, (_, i) => [.46 + Math.cos(i / 12 * Math.PI * 2) * .4, .5 + Math.sin(i / 12 * Math.PI * 2) * .5]), closed: true }],
  [{ points: [[.13,0],[.12,.5],[.12,1]] }, { points: [[.12,1],[.5,1],[.88,.98]] }, { points: [[.12,.54],[.4,.54],[.69,.54]] }],
  [{ points: [[.05,1],[.26,.76],[.46,.5],[.48,.25],[.48,0]] }, { points: [[.88,1],[.68,.75],[.46,.5]] }],
];

/** Organic helices and instanced rays, rendered against a transparent scene. */
export function SpofyWord() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const host = hostRef.current!, canvas = canvasRef.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" }); }
    catch { return; }
    THREE.ColorManagement.legacyMode = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
    const word = new THREE.Group(); scene.add(word);
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const strandMaterials = [
      new THREE.MeshStandardMaterial({ color: "#ad5243", roughness: .57, metalness: .2, emissive: "#51160e", emissiveIntensity: .13 }),
      new THREE.MeshStandardMaterial({ color: "#7b342e", roughness: .7, metalness: .12, emissive: "#40110c", emissiveIntensity: .09 }),
      new THREE.MeshStandardMaterial({ color: "#d28b6b", roughness: .5, metalness: .2, transparent: true, opacity: .72 }),
    ];
    const fineMaterial = new THREE.MeshBasicMaterial({ color: "#db8264", transparent: true, opacity: .24, depthWrite: false });
    materials.push(...strandMaterials, fineMaterial);
    const glyphs: THREE.Group[] = [];
    const raySamples: { glyph: number; point: THREE.Vector3; direction: THREE.Vector3; length: number; phase: number; strength: number }[] = [];
    const heightUnits = 1.38, advance = 1.48, wordWidth = 7.18;
    letters.forEach((strokes, glyphIndex) => {
      const glyph = new THREE.Group(); glyph.position.x = (glyphIndex - 2) * advance; word.add(glyph); glyphs.push(glyph);
      strokes.forEach((stroke, strokeIndex) => {
        const centre = new THREE.CatmullRomCurve3(stroke.points.map(([x, y]) => new THREE.Vector3((x - .46) * heightUnits, (y - .5) * heightUnits, Math.sin(y * 4 + glyphIndex) * .028)), !!stroke.closed, "centripetal");
        const length = centre.getLength();
        const segments = Math.max(48, Math.ceil(length * 100));
        const frames = centre.computeFrenetFrames(segments, !!stroke.closed);
        const turns = stroke.closed ? Math.round(length * 4.8) : length * 4.8;
        for (let strand = 0; strand < 5; strand++) {
          const phase = strand / 3 * Math.PI * 2 + glyphIndex * .55 + strokeIndex * .4;
          const fine = strand >= 3;
          const points = Array.from({ length: segments + 1 }, (_, i) => {
            const t = i / segments, angle = t * turns * Math.PI * 2 + phase;
            const radius = (fine ? .068 : .044) * (1 + Math.sin(t * 8 + phase) * .1);
            return centre.getPointAt(t).addScaledVector(frames.normals[i], Math.cos(angle) * radius).addScaledVector(frames.binormals[i], Math.sin(angle) * radius);
          });
          const spiral = new THREE.CatmullRomCurve3(points, !!stroke.closed, "centripetal");
          const geometry = new THREE.TubeGeometry(spiral, segments, fine ? .004 : .015, fine ? 3 : 6, !!stroke.closed);
          geometries.push(geometry); glyph.add(new THREE.Mesh(geometry, fine ? fineMaterial : strandMaterials[strand]));
        }
        const count = Math.ceil(length * 22);
        for (let i = 0; i < count; i++) {
          const t = (i + .3) / count, angle = i * 2.399 + glyphIndex;
          const frameIndex = Math.min(segments, Math.round(t * segments));
          const radial = frames.normals[frameIndex].clone().multiplyScalar(Math.cos(angle)).addScaledVector(frames.binormals[frameIndex], Math.sin(angle));
          const direction = radial.clone(); direction.z += .72; direction.normalize();
          raySamples.push({ glyph: glyphIndex, point: centre.getPointAt(t).addScaledVector(radial, .05), direction, length: .28 + ((i * 17 + glyphIndex * 7) % 29) / 29 * .48, phase: angle, strength: 0 });
        }
      });
    });

    // A low-contrast connecting curl blends the floating letters into the field.
    const connectingCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-3.8,-.38,-.35),new THREE.Vector3(-2.2,-.89,-.5),new THREE.Vector3(0,-.78,-.5),new THREE.Vector3(2.4,-.65,-.4),new THREE.Vector3(3.8,-.15,-.5)]);
    const connectingGeometry = new THREE.TubeGeometry(connectingCurve, 100, .007, 4, false);
    geometries.push(connectingGeometry); word.add(new THREE.Mesh(connectingGeometry, fineMaterial));
    scene.add(new THREE.AmbientLight("#edb3a0", .65));
    const key = new THREE.DirectionalLight("#ffcab0", 1.7); key.position.set(-3, 4, 5); scene.add(key);
    const fill = new THREE.DirectionalLight("#d45240", .9); fill.position.set(4, -2, 1); scene.add(fill);
    const rim = new THREE.DirectionalLight("#f2aa89", 1.2); rim.position.set(0, 3, -2); scene.add(rim);

    const rayGeometry = new THREE.ConeGeometry(.007, 1, 4);
    const rayMaterial = new THREE.MeshBasicMaterial({ color: "#dd9378", transparent: true, opacity: .48, depthWrite: false });
    const rays = new THREE.InstancedMesh(rayGeometry, rayMaterial, raySamples.length);
    rays.instanceMatrix.setUsage(THREE.DynamicDrawUsage); rays.frustumCulled = false; scene.add(rays);
    const tipGeometry = new THREE.BufferGeometry();
    const tipPositions = new Float32Array(raySamples.length * 3), tipStrength = new Float32Array(raySamples.length);
    tipGeometry.setAttribute("position", new THREE.BufferAttribute(tipPositions, 3).setUsage(THREE.DynamicDrawUsage));
    tipGeometry.setAttribute("strength", new THREE.BufferAttribute(tipStrength, 1).setUsage(THREE.DynamicDrawUsage));
    const tipMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { pixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) } },
      vertexShader: "attribute float strength; varying float alpha; uniform float pixelRatio; void main(){ alpha=strength; vec4 p=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*p; gl_PointSize=(2.0+strength*2.5)*pixelRatio; }",
      fragmentShader: "varying float alpha; void main(){ float d=length(gl_PointCoord-.5); float glow=1.0-smoothstep(.06,.5,d); gl_FragColor=vec4(1.0,.53,.35,glow*alpha*.7); }",
    });
    const tips = new THREE.Points(tipGeometry, tipMaterial); tips.frustumCulled = false; scene.add(tips);
    geometries.push(rayGeometry, tipGeometry); materials.push(rayMaterial, tipMaterial);

    const pointer = { x: -10000, y: -10000 };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const projected = new THREE.Vector3(), worldPoint = new THREE.Vector3(), direction = new THREE.Vector3(), tip = new THREE.Vector3();
    const transform = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
    let width = 1, canvasHeight = 1, frame = 0, time = 0, lastTime = 0, inView = true, focused = false, contextLost = false, datasetTick = 0;
    const damp = (value: number, target: number, factor: number) => value + (target - value) * factor;
    function draw(delta = 1 / 60) {
      const rect = host.getBoundingClientRect(), localX = pointer.x - rect.left, localY = pointer.y - rect.top;
      const radius = Math.max(55, Math.min(width * .15, 105));
      const factor = reduced.matches ? 1 : 1 - Math.exp(-delta * 8);
      const moving = !reduced.matches;
      word.rotation.set(-.08 + (moving ? Math.sin(time * .3) * .026 : 0), -.055 + (moving ? Math.sin(time * .24) * .05 : 0), -.02);
      word.position.y = moving ? Math.sin(time * .4) * .04 : 0;
      let proximity = 0, activeRays = 0, maxRayLength = 0;
      word.updateMatrixWorld(true);
      glyphs.forEach((glyph, i) => {
        glyph.getWorldPosition(projected); projected.project(camera);
        const dx = localX - (projected.x * .5 + .5) * width, dy = localY - (-projected.y * .5 + .5) * canvasHeight;
        const influence = moving ? focused ? .65 : Math.exp(-(dx * dx + dy * dy) / (radius * radius)) : 0;
        proximity = Math.max(proximity, influence);
        glyph.rotation.y = damp(glyph.rotation.y, influence * .12 * Math.sin(i + time * .4), factor);
        glyph.position.z = damp(glyph.position.z, influence * .11, factor);
      });
      word.updateMatrixWorld(true);
      raySamples.forEach((sample, i) => {
        const glyph = glyphs[sample.glyph];
        worldPoint.copy(sample.point).applyMatrix4(glyph.matrixWorld);
        projected.copy(worldPoint).project(camera);
        const dx = localX - (projected.x * .5 + .5) * width, dy = localY - (-projected.y * .5 + .5) * canvasHeight;
        const target = moving ? focused ? .6 : Math.exp(-(dx * dx + dy * dy) / (radius * radius * .8)) : 0;
        proximity = Math.max(proximity, target);
        sample.strength = damp(sample.strength, target, factor);
        const length = sample.length * sample.strength * (moving ? .94 + Math.sin(time * 1.8 + sample.phase) * .06 : 1);
        direction.copy(sample.direction).transformDirection(glyph.matrixWorld);
        transform.position.copy(worldPoint).addScaledVector(direction, length * .5);
        transform.quaternion.setFromUnitVectors(up, direction);
        transform.scale.set(sample.strength, Math.max(.00001, length), sample.strength); transform.updateMatrix(); rays.setMatrixAt(i, transform.matrix);
        tip.copy(worldPoint).addScaledVector(direction, length); tip.toArray(tipPositions, i * 3); tipStrength[i] = sample.strength;
        if (length > .06) activeRays++;
        maxRayLength = Math.max(maxRayLength, length);
      });
      rays.instanceMatrix.needsUpdate = true; tipGeometry.attributes.position.needsUpdate = true; tipGeometry.attributes.strength.needsUpdate = true;
      renderer.render(scene, camera);
      if (datasetTick++ % 8 === 0) {
        host.dataset.proximity = proximity.toFixed(3); host.dataset.state = proximity > .1 ? "interactive" : "idle";
        host.dataset.activeRays = String(activeRays); host.dataset.rayLength = maxRayLength.toFixed(3);
      }
    }
    function animate(timestamp: number) {
      frame = 0; const delta = lastTime ? Math.min((timestamp - lastTime) / 1000, .05) : 1 / 60;
      lastTime = timestamp; time += delta; draw(delta);
      if (inView && !document.hidden && !contextLost && !reduced.matches) frame = requestAnimationFrame(animate);
    }
    function restart() {
      cancelAnimationFrame(frame); frame = 0; lastTime = 0;
      if (contextLost) return;
      if (inView && !document.hidden && !reduced.matches) frame = requestAnimationFrame(animate); else draw();
    }
    function resize() {
      width = Math.max(host.clientWidth, 1); canvasHeight = Math.max(host.clientHeight, 1);
      renderer.setSize(width, canvasHeight, false); camera.aspect = width / canvasHeight;
      const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const distance = Math.max(wordWidth / (2 * tangent * camera.aspect) * 1.12, 4.3);
      camera.position.set(0, .08, distance); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); draw();
    }
    function move(event: PointerEvent) { pointer.x = event.clientX; pointer.y = event.clientY; }
    function leave() { pointer.x = pointer.y = -10000; }
    function focus() { focused = host.matches(":focus-visible"); }
    function blur() { focused = false; }
    function lost(event: Event) { event.preventDefault(); contextLost = true; cancelAnimationFrame(frame); setReady(false); }
    function restored() { contextLost = false; setReady(true); restart(); }
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
    const visibilityObserver = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; restart(); }); visibilityObserver.observe(host);
    window.addEventListener("pointermove", move, { passive: true }); window.addEventListener("pointerdown", move, { passive: true });
    document.addEventListener("pointerleave", leave); document.addEventListener("visibilitychange", restart);
    host.addEventListener("focus", focus); host.addEventListener("blur", blur);
    canvas.addEventListener("webglcontextlost", lost); canvas.addEventListener("webglcontextrestored", restored); reduced.addEventListener("change", restart);
    resize(); setReady(true); restart();
    return () => {
      cancelAnimationFrame(frame); resizeObserver.disconnect(); visibilityObserver.disconnect();
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerdown", move);
      document.removeEventListener("pointerleave", leave); document.removeEventListener("visibilitychange", restart);
      host.removeEventListener("focus", focus); host.removeEventListener("blur", blur);
      canvas.removeEventListener("webglcontextlost", lost); canvas.removeEventListener("webglcontextrestored", restored); reduced.removeEventListener("change", restart);
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); renderer.dispose();
    };
  }, []);

  return <div className="spofy-word-wrap">
    <StemSubjects />
    <div ref={hostRef} className={`spofy-word ${ready ? "is-ready" : ""}`} role="img" aria-label="Chữ SPOFY bằng sợi xoắn 3D; di chuột gần hoặc chạm để các tia bung ra" tabIndex={0} data-state="idle">
      <span className="spofy-word-fallback" aria-hidden="true">SPOFY</span><canvas ref={canvasRef} aria-hidden="true" />
    </div>
    <p className="spofy-word-hint"><span aria-hidden="true">⊹</span> Đưa con trỏ gần để đánh thức những sợi sáng</p>
  </div>;
}
