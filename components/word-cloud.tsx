"use client";
import { useEffect, useRef, useState } from "react";
import cloud, { type Word } from "d3-cloud";
type Entry = { text: string; count: number; normalized: string };
type Placed = Word & Entry;
const colors = [
  "#28604e",
  "#b75233",
  "#6063a2",
  "#a16a14",
  "#25728c",
  "#9b4670",
];
export function WordCloud({
  words,
  onHide,
}: {
  words: Entry[];
  onHide?: (word: string) => void;
}) {
  const [placed, setPlaced] = useState<Placed[]>([]);
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!words.length) {
      setPlaced([]);
      return;
    }
    const max = Math.max(...words.map((w) => w.count));
    const measure = document.createElement("canvas").getContext("2d")!;
    const layout = cloud<Placed>()
      .size([1000, 620])
      .words(
        words.map((w) => {
          const desired = Math.min(94, 24 + 70 * Math.sqrt(w.count / max));
          measure.font = `600 ${desired}px Arial`;
          const width = measure.measureText(w.text).width;
          return {
            ...w,
            size: Math.max(
              14,
              Math.min(desired, (desired * 850) / Math.max(width, 1)),
            ),
          };
        }),
      )
      .padding(7)
      .rotate(() => 0)
      .font("Arial")
      .fontWeight("600")
      .fontSize((w) => w.size!)
      .random(() => 0.45)
      .on("end", setPlaced);
    layout.start();
    return () => {
      layout.stop();
    };
  }, [words]);
  async function download() {
    if (!svg.current) return;
    const markup = new XMLSerializer().serializeToString(svg.current);
    const url = URL.createObjectURL(
      new Blob([markup], { type: "image/svg+xml;charset=utf-8" }),
    );
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 2000;
      canvas.height = 1240;
      const c = canvas.getContext("2d")!;
      c.fillStyle = "#fafbf7";
      c.fillRect(0, 0, 2000, 1240);
      c.drawImage(img, 0, 0, 2000, 1240);
      const a = document.createElement("a");
      a.download = "klassenwand-wortwolke.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }
  return (
    <div className="word-cloud">
      {!words.length ? (
        <div className="cloud-empty">
          <span>☁</span>
          <p>Noch keine Begriffe.</p>
        </div>
      ) : (
        <svg
          ref={svg}
          viewBox="0 0 1000 620"
          xmlns="http://www.w3.org/2000/svg"
          role={onHide ? "group" : "img"}
          aria-label="Wortwolke"
        >
          <g transform="translate(500,310)">
            {placed.map((w, i) => (
              <text
                key={w.normalized}
                x={w.x}
                y={w.y}
                textAnchor="middle"
                fontFamily="Arial, sans-serif"
                fontWeight="600"
                fontSize={w.size}
                fill={colors[i % colors.length]}
                className={onHide ? "clickable-word" : ""}
                role={onHide ? "button" : undefined}
                tabIndex={onHide ? 0 : undefined}
                aria-label={`${w.text}, ${w.count} Mal${onHide ? ", ausblenden" : ""}`}
                onClick={() => onHide?.(w.normalized)}
                onKeyDown={(e) => {
                  if (onHide && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onHide(w.normalized);
                  }
                }}
              >
                <title>
                  {w.count} Mal{onHide ? " · Klicken zum Ausblenden" : ""}
                </title>
                {w.text}
              </text>
            ))}
          </g>
        </svg>
      )}
      {onHide && words.length > 0 && (
        <>
          <button className="subtle no-print" onClick={download}>
            ↓ Als PNG speichern
          </button>
          <details className="accessible-words">
            <summary>Alle Begriffe als Liste ({words.length})</summary>
            {words.map((w) => (
              <button key={w.normalized} onClick={() => onHide(w.normalized)}>
                {w.text} ({w.count}) ×
              </button>
            ))}
          </details>
        </>
      )}
    </div>
  );
}
