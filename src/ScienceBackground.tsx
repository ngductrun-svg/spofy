import { useEffect, useRef } from "react";

export function ScienceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 1, height = 1, frame = 0, tick = 0;
    const pointer = { x: 0, y: 0 };
    const particles = Array.from({ length: 65 }, (_, i) => ({
      x: ((i * 47 + 17) % 101) / 101,
      y: ((i * 31 + 29) % 103) / 103,
      size: .6 + (i % 4) * .35,
      phase: i * 1.7,
    }));
    function atom(x: number, y: number, radius: number, time: number) {
      ctx!.save(); ctx!.translate(x, y); ctx!.rotate(time * .035);
      ctx!.strokeStyle = "rgba(232,96,79,.12)"; ctx!.lineWidth = .8;
      for (let orbit = 0; orbit < 3; orbit++) {
        const angle = orbit * Math.PI / 3;
        ctx!.save(); ctx!.rotate(angle);
        ctx!.beginPath(); ctx!.ellipse(0, 0, radius, radius * .32, 0, 0, Math.PI * 2); ctx!.stroke();
        const position = time * .35 + orbit * 2.1;
        ctx!.fillStyle = "rgba(232,96,79,.42)";
        ctx!.beginPath(); ctx!.arc(Math.cos(position) * radius, Math.sin(position) * radius * .32, 2.7, 0, Math.PI * 2); ctx!.fill();
        ctx!.restore();
      }
      ctx!.fillStyle = "rgba(232,96,79,.3)"; ctx!.beginPath(); ctx!.arc(0, 0, 4, 0, Math.PI * 2); ctx!.fill(); ctx!.restore();
    }
    function molecule(x: number, y: number, radius: number, rotation: number) {
      ctx!.save(); ctx!.translate(x, y); ctx!.rotate(rotation);
      ctx!.strokeStyle = "rgba(232,96,79,.13)"; ctx!.lineWidth = 1;
      ctx!.beginPath();
      for (let i = 0; i < 6; i++) { const angle = i * Math.PI / 3; ctx!.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius); }
      ctx!.closePath(); ctx!.stroke();
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        ctx!.beginPath(); ctx!.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        ctx!.lineTo(Math.cos(angle) * radius * 1.5, Math.sin(angle) * radius * 1.5); ctx!.stroke();
        ctx!.fillStyle = "rgba(232,96,79,.25)";
        ctx!.beginPath(); ctx!.arc(Math.cos(angle) * radius * 1.5, Math.sin(angle) * radius * 1.5, 2, 0, Math.PI * 2); ctx!.fill();
      }
      ctx!.restore();
    }
    function dna(x: number, y: number, size: number, rotation: number) {
      ctx!.save(); ctx!.translate(x, y); ctx!.rotate(rotation);
      const length = size * 2.8, amplitude = size * .22;
      ctx!.lineWidth = 1;
      for (let strand = 0; strand < 2; strand++) {
        ctx!.strokeStyle = strand ? "rgba(221,155,118,.16)" : "rgba(232,96,79,.19)";
        ctx!.beginPath();
        for (let step = 0; step <= 80; step++) {
          const t = step / 80, angle = t * Math.PI * 4 + tick * .12 + strand * Math.PI;
          ctx!.lineTo(Math.sin(angle) * amplitude, (t - .5) * length);
        }
        ctx!.stroke();
      }
      for (let i = 0; i <= 14; i++) {
        const t = i / 14, angle = t * Math.PI * 4 + tick * .12;
        const left = Math.sin(angle) * amplitude, top = (t - .5) * length;
        ctx!.strokeStyle = "rgba(232,96,79,.1)";
        ctx!.beginPath(); ctx!.moveTo(left, top); ctx!.lineTo(-left, top); ctx!.stroke();
      }
      ctx!.fillStyle = "rgba(222,158,135,.16)"; ctx!.font = "300 10px Lexend, Arial";
      ctx!.fillText("A—T", amplitude + 9, -length * .28); ctx!.fillText("G—C", amplitude + 9, length * .24);
      ctx!.restore();
    }
    function cell(x: number, y: number, size: number) {
      ctx!.save(); ctx!.translate(x, y); ctx!.rotate(tick * .012);
      ctx!.strokeStyle = "rgba(232,96,79,.12)"; ctx!.lineWidth = 1;
      ctx!.beginPath(); ctx!.ellipse(0, 0, size, size * .78, -.25, 0, Math.PI * 2); ctx!.stroke();
      ctx!.beginPath(); ctx!.ellipse(0, 0, size * .93, size * .72, -.25, 0, Math.PI * 2); ctx!.stroke();
      ctx!.fillStyle = "rgba(136,53,44,.07)"; ctx!.fill();
      ctx!.beginPath(); ctx!.arc(-size * .12, size * .04, size * .28, 0, Math.PI * 2); ctx!.stroke();
      ctx!.beginPath(); ctx!.arc(-size * .1, size * .04, size * .09, 0, Math.PI * 2); ctx!.stroke();
      for (let i = 0; i < 5; i++) {
        const angle = i * 1.26;
        ctx!.beginPath(); ctx!.ellipse(Math.cos(angle) * size * .55, Math.sin(angle) * size * .43, size * .13, size * .055, angle, 0, Math.PI * 2); ctx!.stroke();
      }
      ctx!.restore();
    }
    function annotations(unit: number) {
      ctx!.save();
      ctx!.fillStyle = "rgba(218,151,126,.16)"; ctx!.font = `300 ${Math.max(12, unit * .023)}px Lexend, Arial`;
      ctx!.fillText("E = mc²", width * .39, height * .15);
      ctx!.fillText("F = ma", width * .075, height * .9);
      ctx!.fillText("λ", width * .72, height * .92);
      ctx!.font = `300 ${Math.max(20, unit * .04)}px Lexend, Arial`;
      ctx!.fillStyle = "rgba(232,96,79,.09)"; ctx!.fillText("∫", width * .93, height * .19);
      ctx!.fillText("Σ", width * .49, height * .8);
      const x = width * .87, y = height * .41, side = Math.max(36, unit * .06);
      ctx!.strokeStyle = "rgba(232,96,79,.13)"; ctx!.strokeRect(x, y, side, side * 1.16);
      ctx!.font = "300 9px Lexend, Arial"; ctx!.fillStyle = "rgba(218,151,126,.2)"; ctx!.fillText("6", x + 5, y + 11);
      ctx!.font = `300 ${side * .42}px Lexend, Arial`; ctx!.fillText("C", x + side * .32, y + side * .74);
      ctx!.font = "300 8px Lexend, Arial"; ctx!.fillText("12.01", x + 5, y + side * 1.02);
      ctx!.font = "300 12px Lexend, Arial"; ctx!.fillText("H₂O", width * .035, height * .43);
      ctx!.restore();
    }
    function draw() {
      const unit = Math.min(width, height);
      ctx!.clearRect(0, 0, width, height);
      const glow = ctx!.createRadialGradient(width * .37, height * .56, 0, width * .37, height * .56, unit * .72);
      glow.addColorStop(0, "rgba(118,35,30,.13)"); glow.addColorStop(1, "rgba(11,9,10,0)");
      ctx!.fillStyle = glow; ctx!.fillRect(0, 0, width, height);
      ctx!.save(); ctx!.translate(pointer.x * 9, pointer.y * 9);
      atom(width * .16, height * .72, unit * .17, tick);
      atom(width * .8, height * .84, unit * .2, -tick * .7);
      molecule(width * .57, height * .21, unit * .075, tick * .022);
      molecule(width * .94, height * .46, unit * .06, -tick * .017);
      molecule(width * .06, height * .23, unit * .038, tick * .012);
      dna(width * .095, height * .53, unit * .078, -.32);
      cell(width * .88, height * .73, unit * .08);
      annotations(unit);
      for (const particle of particles) {
        const x = particle.x * width + Math.sin(tick * .12 + particle.phase) * 13;
        const y = particle.y * height + Math.cos(tick * .1 + particle.phase) * 16;
        ctx!.fillStyle = `rgba(232,96,79,${.12 + Math.sin(tick * .3 + particle.phase) * .06})`;
        ctx!.beginPath(); ctx!.arc(x, y, particle.size, 0, Math.PI * 2); ctx!.fill();
      }
      ctx!.restore();
    }
    let lastTime = 0;
    function animate(time: number) {
      frame = 0;
      if (!lastTime) lastTime = time;
      tick += Math.min((time - lastTime) / 1000, .05); lastTime = time;
      draw();
      if (!document.hidden && !reduced.matches) frame = requestAnimationFrame(animate);
    }
    function restart() {
      cancelAnimationFrame(frame); lastTime = 0;
      if (!document.hidden && !reduced.matches) frame = requestAnimationFrame(animate); else draw();
    }
    function resize() {
      width = window.innerWidth; height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
    }
    function move(event: PointerEvent) { pointer.x = event.clientX / width - .5; pointer.y = event.clientY / height - .5; }
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("visibilitychange", restart); reduced.addEventListener("change", restart);
    resize(); restart();
    return () => {
      cancelAnimationFrame(frame); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", move);
      document.removeEventListener("visibilitychange", restart); reduced.removeEventListener("change", restart);
    };
  }, []);
  return <canvas ref={canvasRef} className="science-background" aria-hidden="true" />;
}
