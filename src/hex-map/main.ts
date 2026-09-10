import { hexDistance, hexToPixel, type Hex } from "@shared/mathUtils/hex";
import { qs } from "@shared/dom";

const canvas = qs<HTMLCanvasElement>("#board");
const ctx = canvas.getContext("2d");
if (ctx === null) throw new Error("2D canvas context unavailable");

const SIZE = 24;
const RADIUS = 4;
const ORIGIN: Hex = { q: 0, r: 0 };

const cells: Hex[] = [];
for (let q = -RADIUS; q <= RADIUS; q++) {
  for (let r = -RADIUS; r <= RADIUS; r++) {
    if (hexDistance(ORIGIN, { q, r }) <= RADIUS) cells.push({ q, r });
  }
}

let hovered: Hex | null = null;

const drawCell = (cell: Hex, isHovered: boolean): void => {
  const { x, y } = hexToPixel(cell, SIZE);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    const px = x + SIZE * Math.cos(angle);
    const py = y + SIZE * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = isHovered ? "#4f8cff" : "#e8e8e8";
  ctx.fill();
  ctx.strokeStyle = "#999";
  ctx.stroke();
};

const draw = (): void => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  for (const cell of cells) {
    drawCell(cell, cell === hovered);
  }
  ctx.restore();
};

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const mx = event.clientX - rect.left - canvas.width / 2;
  const my = event.clientY - rect.top - canvas.height / 2;
  let nearest: Hex | null = null;
  let best = Infinity;
  for (const cell of cells) {
    const { x, y } = hexToPixel(cell, SIZE);
    const d = Math.hypot(mx - x, my - y);
    if (d < best) {
      best = d;
      nearest = cell;
    }
  }
  hovered = best <= SIZE ? nearest : null;
  draw();
});

canvas.addEventListener("mouseleave", () => {
  hovered = null;
  draw();
});

draw();
