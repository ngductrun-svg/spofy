import { useEffect, useRef } from "react";
import {
  ACESFilmicToneMapping, AmbientLight, Color, DirectionalLight, ExtrudeGeometry,
  Group, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera,
  PointLight, Scene, ShapePath, WebGLRenderer, sRGBEncoding,
} from "three";
import glyphData from "./spofyGlyphs.json";

type OutlineCommand = [string, ...number[]];
type Glyph = { advance: number; bounds: { xMin: number; yMin: number; xMax: number; yMax: number }; contours: OutlineCommand[][] };
type Box = { left: number; right: number; top: number; bottom: number; x: number; y: number };
type Spring = { value: number; velocity: number };
type Letter = {
  mesh: Mesh; front: MeshStandardMaterial; side: MeshStandardMaterial;
  node: HTMLElement; box: Box; x: number; y: number;
  rx: Spring; ry: Spring; z: Spring; influence: number;
};
const LETTERS = "SPOFY";
const PADDING = 48;
const RADIUS = 200;
const DEG = Math.PI / 180;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const spring = (): Spring => ({ value: 0, velocity: 0 });
const ease = (value: number) => 1 - Math.pow(1 - clamp(value, 0, 1), 3);
const smoothstep = (value: number) => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const color = (value: string) => new Color(value).convertSRGBToLinear();

// These bounds belong to the stationary HTML glyphs, never the moving meshes.
function proximity(point: { x: number; y: number }, box: Box) {
  const dx = Math.max(box.left - point.x, 0, point.x - box.right);
  const dy = Math.max(box.top - point.y, 0, point.y - box.bottom);
  return smoothstep(1 - Math.hypot(dx, dy) / RADIUS);
}

function advance(state: Spring, target: number, dt: number) {
  // Damping ratio .90: a weighted return with one very small settling response.
  state.velocity += ((target - state.value) * 185 - state.velocity * 24.5) * dt;
  state.value += state.velocity * dt;
  if (Math.abs(target - state.value) < .0004 && Math.abs(state.velocity) < .002) {
    state.value = target; state.velocity = 0;
  }
  return Math.abs(target - state.value) + Math.abs(state.velocity) > .002;
}

function shapesFor(glyph: Glyph) {
  const path = new ShapePath();
  glyph.contours.forEach(contour => contour.forEach(([command, ...points]) => {
    if (command === "M") path.moveTo(points[0], points[1]);
    else if (command === "L") path.lineTo(points[0], points[1]);
    else if (command === "Q") path.quadraticCurveTo(points[0], points[1], points[2], points[3]);
    else if (command === "C") path.bezierCurveTo(points[0], points[1], points[2], points[3], points[4], points[5]);
    else if (command === "Z") path.currentPath?.closePath();
  }));
  return path.toShapes(false);
}

/** Decorative, demand-rendered mesh layer. The original HTML button owns all interaction. */
export function MagneticWord3D({ pulse = 0 }: { pulse?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pulseRef = useRef(pulse);
  const pulseControl = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    const button = canvas?.closest<HTMLButtonElement>(".spofy-word-trigger");
    const sceneNode = button?.closest<HTMLElement>(".spofy-word-scene");
    const hero = button?.closest<HTMLElement>(".spofy-hero");
    const glyphNodes = button ? Array.from(button.querySelectorAll<HTMLElement>(".spofy-word-glyph")) : [];
    if (!canvas || !button || !sceneNode || !hero || glyphNodes.length !== LETTERS.length) return;

    let renderer: WebGLRenderer;
    sceneNode.dataset.renderer = "fallback";
    sceneNode.dataset.word3dStatus = "fallback";
    try {
      renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      // Native letters, focus ring and both timeline controls remain available.
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = sRGBEncoding;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

    const scene = new Scene();
    const word = new Group(); scene.add(word);
    const camera = new PerspectiveCamera(34, 1, .1, 3000);
    camera.position.z = 850;
    scene.add(new AmbientLight(color("#e7ddd8"), .72));
    scene.add(new HemisphereLight(color("#fff6eb"), color("#603325"), .72));
    const key = new DirectionalLight(color("#fff6ed"), 1.35);
    key.position.set(-250, 380, 480); scene.add(key);
    const rim = new DirectionalLight(color("#ff8a5b"), .82);
    rim.position.set(350, -170, -130); scene.add(rim);
    const pointerLight = new PointLight(color("#ffd7bd"), .8, 0, 1);
    pointerLight.position.set(-160, 190, 340); scene.add(pointerLight);

    const uniforms = {
      uSheenX: { value: -10000 }, uSheenAmount: { value: 0 },
      uPulseX: { value: -10000 }, uPulseAmount: { value: 0 },
      uBandWidth: { value: 65 },
    };
    const letters: Letter[] = [];
    let alive = true, failed = false, frame = 0, measureFrame = 0;
    let visible = true, lastFrame = 0, clock = 0, frameCount = 0;
    let width = 1, height = 1, fontSize = 1, measuredFontSize = 0;
    let buttonBox: Box = { left: 0, right: 0, top: 0, bottom: 0, x: 0, y: 0 };
    let pointer = { x: 0, y: 0, active: false };
    let pulseAt = -10000;
    const wordRx = spring(), wordRy = spring(), lightX = spring(), lightY = spring();
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isStatic = () => reduce.matches || !fine.matches;
    const interactive = () => !isStatic() && pointer.active;

    function makeFront() {
      const material = new MeshStandardMaterial({
        color: color("#f5eee8"), roughness: .43, metalness: .035,
        transparent: true, opacity: 0,
      });
      material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = "varying vec3 vSpofyPosition;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
          "#include <begin_vertex>\nvSpofyPosition = (modelMatrix * vec4(position, 1.0)).xyz;");
        shader.fragmentShader = "varying vec3 vSpofyPosition;\nuniform float uSheenX;\nuniform float uSheenAmount;\nuniform float uPulseX;\nuniform float uPulseAmount;\nuniform float uBandWidth;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace("#include <dithering_fragment>", `
          float spofySheen = exp(-pow((vSpofyPosition.x - uSheenX) / uBandWidth, 2.0)) * uSheenAmount;
          float spofyPulse = exp(-pow((vSpofyPosition.x - uPulseX) / (uBandWidth * 1.25), 2.0)) * uPulseAmount;
          gl_FragColor.rgb += vec3(0.20, 0.16, 0.12) * spofySheen + vec3(0.27, 0.085, 0.026) * spofyPulse;
          #include <dithering_fragment>
        `);
      };
      material.customProgramCacheKey = () => "spofy-satin-face-v1";
      return material;
    }

    function rebuild() {
      letters.forEach(letter => { word.remove(letter.mesh); letter.mesh.geometry.dispose(); letter.front.dispose(); letter.side.dispose(); });
      letters.length = 0;
      for (let index = 0; index < LETTERS.length; index++) {
        const glyph = (glyphData.glyphs as unknown as Record<string, Glyph>)[LETTERS[index]];
        const unit = fontSize / glyphData.unitsPerEm;
        const depth = clamp(fontSize * .064, 7, 19);
        const geometry = new ExtrudeGeometry(shapesFor(glyph), {
          depth: depth / unit, steps: 1, curveSegments: 10,
          bevelEnabled: true, bevelThickness: Math.max(.9, fontSize * .007) / unit,
          bevelSize: Math.max(.75, fontSize * .006) / unit, bevelSegments: 3,
        });
        geometry.scale(unit, unit, unit);
        geometry.translate(-(glyph.bounds.xMin + glyph.bounds.xMax) * unit / 2,
          -(glyph.bounds.yMin + glyph.bounds.yMax) * unit / 2, -depth / 2);
        geometry.computeVertexNormals();
        const front = makeFront();
        const side = new MeshStandardMaterial({ color: color("#a34f31"), emissive: color("#ff8a5b"), emissiveIntensity: .025,
          roughness: .54, metalness: .23, transparent: true, opacity: 0 });
        const mesh = new Mesh(geometry, [front, side]); word.add(mesh);
        letters.push({ mesh, front, side, node: glyphNodes[index], box: buttonBox, x: 0, y: 0,
          rx: spring(), ry: spring(), z: spring(), influence: 0 });
      }
      measuredFontSize = fontSize;
      sceneNode!.dataset.word3dDepth = clamp(fontSize * .064, 7, 19).toFixed(1);
    }

    function measure() {
      if (!alive || failed) return;
      const box = button!.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) return;
      width = button!.offsetWidth + PADDING * 2;
      height = button!.offsetHeight + PADDING * 2;
      fontSize = parseFloat(getComputedStyle(button!).fontSize);
      buttonBox = { left: box.left, right: box.right, top: box.top, bottom: box.bottom, x: box.left + box.width / 2, y: box.top + box.height / 2 };
      if (Math.abs(fontSize - measuredFontSize) > .1 || !letters.length) rebuild();
      renderer.setSize(width, height, false);
      // Preserve one world unit per CSS pixel at z=0, while a lifted letter
      // becomes visibly larger through genuine perspective foreshortening.
      camera.aspect = width / height;
      camera.position.z = height / (2 * Math.tan(camera.fov * DEG / 2));
      camera.updateProjectionMatrix();
      letters.forEach((letter, index) => {
        const glyphBox = letter.node.getBoundingClientRect();
        const glyph = (glyphData.glyphs as unknown as Record<string, Glyph>)[LETTERS[index]];
        const unit = fontSize / glyphData.unitsPerEm;
        // Lexend's bundled hhea metrics are ascent 1000 / descent -250.
        // Align the mesh to its actual ink, including the S/O overshoot, not its advance box.
        const baseline = glyphBox.top + glyphBox.height / 2 + fontSize * .375;
        const left = glyphBox.left + glyph.bounds.xMin * unit;
        const right = glyphBox.left + glyph.bounds.xMax * unit;
        const top = baseline - glyph.bounds.yMax * unit;
        const bottom = baseline - glyph.bounds.yMin * unit;
        letter.box = { left, right, top, bottom, x: (left + right) / 2, y: (top + bottom) / 2 };
        letter.x = letter.node.offsetLeft + (glyph.bounds.xMin + glyph.bounds.xMax) * unit / 2 - button!.offsetWidth / 2;
        letter.y = ((glyph.bounds.yMin + glyph.bounds.yMax) / (2 * glyphData.unitsPerEm) - .375) * fontSize;
      });
      sceneNode!.dataset.word3dBounds = JSON.stringify(letters.map((letter, index) => ({
        letter: LETTERS[index], ...letter.box,
      })));
      uniforms.uBandWidth.value = Math.max(26, button!.offsetWidth * .09);
      wake();
    }

    function fail() {
      failed = true; cancelAnimationFrame(frame); frame = 0;
      canvas!.style.visibility = "hidden";
      sceneNode!.dataset.renderer = "fallback"; sceneNode!.dataset.word3dStatus = "fallback";
      sceneNode!.dataset.magnetic = "false";
      sceneNode!.style.setProperty("--proximity", "0");
      glyphNodes.forEach(node => { node.dataset.proximity = "0"; });
    }

    function paint(now: number) {
      frame = 0;
      if (!alive || failed || !visible || document.hidden) return;
      const elapsed = lastFrame ? Math.max(0, now - lastFrame) : 1000 / 60;
      const dt = Math.min(elapsed / 1000, 1 / 30);
      lastFrame = now; clock += elapsed;
      const staticPose = isStatic();
      let moving = false, strongest = 0;
      const targets = letters.map(letter => interactive() ? proximity(pointer, letter.box) : 0);
      letters.forEach((letter, index) => {
        const own = targets[index];
        // A soft linked response falls off beyond the nearest neighbours.
        const influence = Math.max(own, (targets[index - 1] ?? 0) * .19, (targets[index + 1] ?? 0) * .19);
        strongest = Math.max(strongest, influence); letter.influence = influence;
        const rx = interactive() ? clamp((letter.box.y - pointer.y) / Math.max((letter.box.bottom - letter.box.top) * .65, 70), -1, 1) * 7 * DEG * influence : 0;
        const ry = interactive() ? clamp((pointer.x - letter.box.x) / Math.max((letter.box.right - letter.box.left) * .8, 70), -1, 1) * 7 * DEG * influence : 0;
        if (staticPose) {
          letter.rx.value = 0; letter.rx.velocity = 0; letter.ry.value = 0; letter.ry.velocity = 0; letter.z.value = 0; letter.z.velocity = 0;
        } else {
          moving = advance(letter.rx, rx, dt) || moving;
          moving = advance(letter.ry, ry, dt) || moving;
          moving = advance(letter.z, influence * 22, dt) || moving;
        }
        const entrance = staticPose ? 1 : ease((clock - index * 60) / 740);
        letter.mesh.position.set(letter.x, letter.y - (1 - entrance) * 12, letter.z.value - (1 - entrance) * 74);
        letter.mesh.rotation.set(-5.8 * DEG + letter.rx.value + (1 - entrance) * .18,
          (-6.5 + (index - 2) * .35) * DEG + letter.ry.value - (1 - entrance) * .15, 0);
        const opacity = staticPose ? 1 : smoothstep((clock - index * 60) / 540);
        letter.front.opacity = opacity; letter.side.opacity = opacity;
        letter.node.dataset.proximity = influence.toFixed(3);
        letter.node.dataset.depth = letter.z.value.toFixed(2);
        letter.node.dataset.rotateX = (letter.rx.value / DEG).toFixed(2);
        letter.node.dataset.rotateY = (letter.ry.value / DEG).toFixed(2);
      });
      const nx = interactive() ? clamp((pointer.x - buttonBox.x) / Math.max(180, (buttonBox.right - buttonBox.left) / 2), -1, 1) : 0;
      const ny = interactive() ? clamp((buttonBox.y - pointer.y) / Math.max(160, buttonBox.bottom - buttonBox.top), -1, 1) : 0;
      if (!staticPose) {
        moving = advance(wordRx, ny * 1.8 * DEG * strongest, dt) || moving;
        moving = advance(wordRy, nx * 2 * DEG * strongest, dt) || moving;
        moving = advance(lightX, nx * 170 * strongest, dt) || moving;
        moving = advance(lightY, ny * 100 * strongest, dt) || moving;
      } else { [wordRx, wordRy, lightX, lightY].forEach(value => { value.value = 0; value.velocity = 0; }); }
      word.rotation.set(wordRx.value, wordRy.value, 0);
      pointerLight.position.set(-160 + lightX.value, 190 + lightY.value, 340);
      pointerLight.intensity = .8 + strongest * .3;
      const sheenPhase = staticPose ? 1 : clamp((clock - 840) / 560, 0, 1);
      uniforms.uSheenX.value = (sheenPhase - .5) * (width + 180);
      uniforms.uSheenAmount.value = staticPose || sheenPhase === 1 ? 0 : Math.sin(sheenPhase * Math.PI) * .75;
      const pulsePhase = staticPose ? 1 : clamp((clock - pulseAt) / 420, 0, 1);
      uniforms.uPulseX.value = (pulsePhase - .5) * (width + 180);
      uniforms.uPulseAmount.value = staticPose || pulsePhase === 1 ? 0 : Math.sin(pulsePhase * Math.PI) * .85;
      letters.forEach((letter, index) => { letter.side.emissiveIntensity = .025 + (pulsePhase < 1 ? Math.max(0, 1 - Math.abs(pulsePhase * 6 - index - .5)) * .22 : 0); });
      sceneNode!.style.setProperty("--proximity", strongest.toFixed(3));
      sceneNode!.style.setProperty("--glow-alpha", (strongest * .16).toFixed(3));
      sceneNode!.dataset.magnetic = String(strongest > .01);
      try {
        renderer.render(scene, camera);
        if (renderer.info.programs?.some(program => {
          const diagnostics = (program as typeof program & { diagnostics?: { runnable: boolean } }).diagnostics;
          return diagnostics && !diagnostics.runnable;
        })) { fail(); return; }
      } catch { fail(); return; }
      canvas!.style.visibility = "visible";
      sceneNode!.dataset.renderer = "webgl";
      sceneNode!.dataset.word3dFrames = String(++frameCount);
      const entering = !staticPose && clock < 1400;
      const pulsing = !staticPose && pulsePhase < 1;
      sceneNode!.dataset.word3dStatus = entering ? "entering" : moving || pulsing ? "tracking" : "idle";
      if (entering || moving || pulsing) frame = requestAnimationFrame(paint);
      else lastFrame = 0;
    }

    function wake() {
      if (alive && !failed && visible && !document.hidden && !frame) frame = requestAnimationFrame(paint);
    }
    function requestMeasure() {
      if (measureFrame || !alive || failed) return;
      measureFrame = requestAnimationFrame(() => { measureFrame = 0; measure(); });
    }
    const pointerMove = (event: PointerEvent) => {
      if (!fine.matches || reduce.matches || event.pointerType === "touch") return;
      const point = { x: event.clientX, y: event.clientY };
      const near = letters.some(letter => proximity(point, letter.box) > 0);
      if (!near && !pointer.active) return;
      pointer = { ...point, active: near }; wake();
    };
    const pointerLeave = () => { pointer.active = false; wake(); };
    const pause = () => {
      cancelAnimationFrame(frame); frame = 0; lastFrame = 0; pointer.active = false;
      if (!failed) sceneNode.dataset.word3dStatus = "paused";
    };
    const visibilityChange = () => { if (document.hidden) pause(); else { requestMeasure(); wake(); } };
    const preferenceChange = () => { pointer.active = false; lastFrame = 0; requestMeasure(); wake(); };
    const contextLost = (event: Event) => { event.preventDefault(); fail(); };
    const contextRestored = () => { failed = false; lastFrame = 0; requestMeasure(); wake(); };
    pulseControl.current = () => { if (!isStatic()) { pulseAt = clock; wake(); } };
    const observer = new ResizeObserver(requestMeasure);
    observer.observe(button); glyphNodes.forEach(node => observer.observe(node));
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) pause(); else { requestMeasure(); wake(); }
    }, { threshold: 0 }); intersection.observe(hero);
    hero.addEventListener("pointermove", pointerMove, { passive: true });
    hero.addEventListener("pointerleave", pointerLeave);
    window.addEventListener("resize", requestMeasure, { passive: true });
    window.addEventListener("scroll", requestMeasure, { passive: true });
    document.addEventListener("visibilitychange", visibilityChange);
    fine.addEventListener("change", preferenceChange); reduce.addEventListener("change", preferenceChange);
    canvas.addEventListener("webglcontextlost", contextLost);
    canvas.addEventListener("webglcontextrestored", contextRestored);
    document.fonts.ready.then(() => { if (alive) requestMeasure(); });
    try { measure(); } catch { fail(); }

    return () => {
      alive = false; pulseControl.current = () => {};
      cancelAnimationFrame(frame); cancelAnimationFrame(measureFrame);
      observer.disconnect(); intersection.disconnect();
      hero.removeEventListener("pointermove", pointerMove); hero.removeEventListener("pointerleave", pointerLeave);
      window.removeEventListener("resize", requestMeasure); window.removeEventListener("scroll", requestMeasure);
      document.removeEventListener("visibilitychange", visibilityChange);
      fine.removeEventListener("change", preferenceChange); reduce.removeEventListener("change", preferenceChange);
      canvas.removeEventListener("webglcontextlost", contextLost); canvas.removeEventListener("webglcontextrestored", contextRestored);
      letters.forEach(letter => { letter.mesh.geometry.dispose(); letter.front.dispose(); letter.side.dispose(); });
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (pulse !== pulseRef.current) { pulseRef.current = pulse; pulseControl.current(); }
  }, [pulse]);

  return <canvas className="spofy-magnetic-canvas" ref={canvasRef} aria-hidden="true" tabIndex={-1}
    style={{ position: "absolute", left: -PADDING, top: -PADDING, width: `calc(100% + ${PADDING * 2}px)`,
      height: `calc(100% + ${PADDING * 2}px)`, pointerEvents: "none", visibility: "hidden" }} />;
}
