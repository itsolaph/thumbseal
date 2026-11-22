import { useEffect, useRef } from 'react';

export function AsciiField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const styles = getComputedStyle(document.documentElement);
    const glyphColors = [
      styles.getPropertyValue('--color-glyph-1').trim() || '#d8e0ef',
      styles.getPropertyValue('--color-glyph-2').trim() || '#bcc9e4',
      styles.getPropertyValue('--color-glyph-3').trim() || '#8ea8d8',
      styles.getPropertyValue('--color-glyph-4').trim() || '#5f87cc',
    ];
    const accentDeep = styles.getPropertyValue('--color-accent-deep').trim() || '#2957b8';
    const ruleColor = styles.getPropertyValue('--color-rule-2').trim() || '#cbd3df';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cellW = 8;
    const cellH = 16;
    const leftChars = '0123456789abcdef.:-=+*';
    const rightChars = '.:-=+';

    let visible = true;
    let rafId = 0;
    let lastDraw = 0;
    let pointerX = -999;
    let pointerY = -999;

    const draw = (t: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      ctx.clearRect(0, 0, w, h);
      ctx.font = '11px "JetBrains Mono", ui-monospace, monospace';
      ctx.textBaseline = 'top';

      const cols = Math.floor(w / cellW);
      const rows = Math.floor((h - 8) / cellH);
      const midCol = Math.floor(cols * 0.5);
      const centerX = w * 0.5;
      const centerY = h * 0.5;
      const isMobile = w < 640;
      const rx = isMobile ? w * 0.62 : w * 0.36;
      const ry = isMobile ? h * 0.48 : h * 0.43;
      const phase = t * 0.00055;

      // Vertical proof-boundary hairline ONLY on desktop above/below the quiet hero corridor
      if (!isMobile) {
        const topStop = Math.max(0, Math.floor(centerY - ry * 0.88));
        const botStart = Math.min(h, Math.ceil(centerY + ry * 0.88));
        const gradTop = ctx.createLinearGradient(0, 0, 0, topStop || 1);
        gradTop.addColorStop(0, ruleColor);
        gradTop.addColorStop(1, 'transparent');
        ctx.strokeStyle = gradTop;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(midCol * cellW + 0.5, 0);
        ctx.lineTo(midCol * cellW + 0.5, topStop);
        ctx.stroke();

        const gradBot = ctx.createLinearGradient(0, botStart, 0, h);
        gradBot.addColorStop(0, 'transparent');
        gradBot.addColorStop(1, ruleColor);
        ctx.strokeStyle = gradBot;
        ctx.beginPath();
        ctx.moveTo(midCol * cellW + 0.5, botStart);
        ctx.lineTo(midCol * cellW + 0.5, h);
        ctx.stroke();
      }

      for (let r = 0; r < rows; r++) {
        const y = r * cellH;
        for (let c = 0; c < cols; c++) {
          const x = c * cellW;
          const dxC = (x - centerX) / rx;
          const dyC = (y - centerY) / ry;
          if (dxC * dxC + dyC * dyC < 1.0) continue;

          const wave =
            Math.sin(c * 0.14 + phase * 1.4 + Math.cos(r * 0.22 - phase)) * 0.5 + 0.5;
          const band = Math.sin(r * 0.31 + c * 0.07 - phase * 0.9) * 0.5 + 0.5;
          let energy = wave * 0.65 + band * 0.35;

          const distP = Math.hypot(x - pointerX, y - pointerY);
          if (distP < 110) {
            energy = Math.min(1, energy + (1 - distP / 110) * 0.45);
          }

          if (energy < 0.32) continue;

          const isLeft = c < midCol;
          const charset = isLeft ? leftChars : rightChars;
          const chIdx = Math.floor((energy * 17 + c * 3 + r * 5) % charset.length);
          const colorIdx = Math.min(3, Math.floor((energy - 0.3) * 5.2));
          ctx.fillStyle = energy > 0.92 && Math.abs(c - midCol) < 6 ? accentDeep : glyphColors[colorIdx];
          ctx.fillText(charset[chIdx], x, y);
        }
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(0);
    };

    const tick = (now: number) => {
      if (!visible) return;
      if (now - lastDraw >= 33) {
        draw(now);
        lastDraw = now;
      }
      rafId = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reducedMotion) rafId = requestAnimationFrame(tick);
    });
    observer.observe(canvas);

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = e.clientX - rect.left;
      pointerY = e.clientY - rect.top;
    };
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });

    resize();
    if (!reducedMotion) rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <div className="ascii-bg" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
