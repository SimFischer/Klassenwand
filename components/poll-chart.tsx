"use client";
import type { ChartType, PollResult } from "@/lib/types";

// Gut unterscheidbare, ruhige Farben passend zur Wortwolke.
export const pollColors = [
  "#38634e",
  "#c9774d",
  "#6063a2",
  "#a16a14",
  "#25728c",
  "#9b4670",
  "#6f8f3a",
  "#b5473a",
  "#4b5563",
  "#2f8f83",
];

const percent = (value: number, total: number) =>
  total ? Math.round((value / total) * 100) : 0;

export function PollChart({
  results,
  chart,
  voters,
  ownVotes = [],
}: {
  results: PollResult[];
  chart: ChartType;
  voters: number;
  ownVotes?: string[];
}) {
  const votes = results.reduce((sum, r) => sum + r.count, 0);
  if (!votes)
    return (
      <div className="poll-chart poll-empty">
        <span aria-hidden="true">▥</span>
        <p>Noch keine Stimmen.</p>
      </div>
    );
  return (
    <div className="poll-chart">
      {chart === "pie" ? (
        <PieChart results={results} votes={votes} ownVotes={ownVotes} />
      ) : (
        <BarChart results={results} voters={voters} ownVotes={ownVotes} />
      )}
      <p className="poll-total">
        {voters} {voters === 1 ? "Person hat" : "Personen haben"} abgestimmt
        {votes !== voters ? ` · ${votes} Stimmen` : ""}
      </p>
    </div>
  );
}

function BarChart({
  results,
  voters,
  ownVotes,
}: {
  results: PollResult[];
  voters: number;
  ownVotes: string[];
}) {
  const max = Math.max(...results.map((r) => r.count), 1);
  return (
    <ul className="poll-bars" aria-label="Ergebnisse als Balkendiagramm">
      {results.map((r, i) => (
        <li key={r.id}>
          <div className="poll-bar-label">
            <span>
              {r.text}
              {ownVotes.includes(r.id) && (
                <em className="own-vote"> · deine Wahl</em>
              )}
            </span>
            <b>
              {percent(r.count, voters)} %{" "}
              <small>
                ({r.count} {r.count === 1 ? "Stimme" : "Stimmen"})
              </small>
            </b>
          </div>
          <div className="poll-bar-track" aria-hidden="true">
            <div
              className="poll-bar-fill"
              style={{
                width: `${(r.count / max) * 100}%`,
                background: pollColors[i % pollColors.length],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function PieChart({
  results,
  votes,
  ownVotes,
}: {
  results: PollResult[];
  votes: number;
  ownVotes: string[];
}) {
  const r = 100,
    cx = 120,
    cy = 120;
  let angle = -Math.PI / 2;
  const slices = results.map((res, i) => {
    const share = res.count / votes,
      start = angle,
      end = angle + share * 2 * Math.PI;
    angle = end;
    const color = pollColors[i % pollColors.length];
    if (share === 0) return null;
    if (share >= 0.9999)
      return <circle key={res.id} cx={cx} cy={cy} r={r} fill={color} />;
    const large = end - start > Math.PI ? 1 : 0;
    const p = (a: number) =>
      `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
    return (
      <path
        key={res.id}
        d={`M ${cx} ${cy} L ${p(start)} A ${r} ${r} 0 ${large} 1 ${p(end)} Z`}
        fill={color}
        stroke="#fff"
        strokeWidth={2}
      >
        <title>
          {res.text}: {res.count} ({percent(res.count, votes)} %)
        </title>
      </path>
    );
  });
  return (
    <div className="poll-pie">
      <svg
        viewBox="0 0 240 240"
        role="img"
        aria-label="Ergebnisse als Tortendiagramm"
      >
        {slices}
      </svg>
      <ul className="poll-legend">
        {results.map((res, i) => (
          <li key={res.id}>
            <i
              aria-hidden="true"
              style={{ background: pollColors[i % pollColors.length] }}
            />
            <span>
              {res.text}
              {ownVotes.includes(res.id) && (
                <em className="own-vote"> · deine Wahl</em>
              )}
            </span>
            <b>
              {percent(res.count, votes)} % <small>({res.count})</small>
            </b>
          </li>
        ))}
      </ul>
    </div>
  );
}
