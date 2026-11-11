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
const color = (i: number) => pollColors[i % pollColors.length];

const percent = (value: number, total: number) =>
  total ? Math.round((value / total) * 100) : 0;

export function PollChart({
  results,
  chart,
  voters,
  firstVoters,
  ownVotes = [],
}: {
  results: PollResult[];
  chart: ChartType;
  voters: number;
  /** Gesetzt, sobald eine zweite Runde läuft: Ergebnis wird als Vergleich gezeigt. */
  firstVoters?: number;
  ownVotes?: string[];
}) {
  const votes = results.reduce((sum, r) => sum + r.count, 0);
  const compare = firstVoters !== undefined;
  if (!votes && !compare)
    return (
      <div className="poll-chart poll-empty">
        <span aria-hidden="true">▥</span>
        <p>Noch keine Stimmen.</p>
      </div>
    );
  return (
    <div className="poll-chart">
      {compare && (
        <p className="poll-compare-legend">
          <span>
            <i className="round-one" /> Runde 1 · {firstVoters}{" "}
            {firstVoters === 1 ? "Person" : "Personen"}
          </span>
          <span>
            <i className="round-two" /> Runde 2 · {voters}{" "}
            {voters === 1 ? "Person" : "Personen"}
          </span>
        </p>
      )}
      {chart === "pie" ? (
        <PieCharts
          results={results}
          compare={compare}
          ownVotes={ownVotes}
          votes={votes}
        />
      ) : (
        <BarChart
          results={results}
          voters={voters}
          firstVoters={firstVoters}
          ownVotes={ownVotes}
        />
      )}
      <p className="poll-total">
        {compare && "Runde 2: "}
        {voters} {voters === 1 ? "Person hat" : "Personen haben"} abgestimmt
        {votes !== voters ? ` · ${votes} Stimmen` : ""}
      </p>
    </div>
  );
}

function OwnVote({ show }: { show: boolean }) {
  return show ? <em className="own-vote"> · deine Wahl</em> : null;
}

function BarChart({
  results,
  voters,
  firstVoters,
  ownVotes,
}: {
  results: PollResult[];
  voters: number;
  firstVoters?: number;
  ownVotes: string[];
}) {
  const compare = firstVoters !== undefined;
  // Im Vergleich werden Anteile verglichen, damit unterschiedliche Teilnehmerzahlen nicht verzerren.
  const share = (r: PollResult) => (voters ? r.count / voters : 0);
  const firstShare = (r: PollResult) =>
    firstVoters ? (r.firstCount ?? 0) / firstVoters : 0;
  const max = compare
    ? Math.max(...results.flatMap((r) => [share(r), firstShare(r)]), 0.0001)
    : Math.max(...results.map((r) => r.count), 1);
  return (
    <ul className="poll-bars" aria-label="Ergebnisse als Balkendiagramm">
      {results.map((r, i) => {
        const change = compare
          ? percent(r.count, voters) - percent(r.firstCount ?? 0, firstVoters)
          : 0;
        return (
          <li key={r.id}>
            <div className="poll-bar-label">
              <span>
                {r.text}
                <OwnVote show={ownVotes.includes(r.id)} />
              </span>
              {compare ? (
                <b>
                  <small>{percent(r.firstCount ?? 0, firstVoters)} % →</small>{" "}
                  {percent(r.count, voters)} %{" "}
                  <small
                    className={change > 0 ? "up" : change < 0 ? "down" : ""}
                  >
                    ({change > 0 ? "+" : ""}
                    {change})
                  </small>
                </b>
              ) : (
                <b>
                  {percent(r.count, voters)} %{" "}
                  <small>
                    ({r.count} {r.count === 1 ? "Stimme" : "Stimmen"})
                  </small>
                </b>
              )}
            </div>
            {compare && (
              <div className="poll-bar-track first" aria-hidden="true">
                <div
                  className="poll-bar-fill"
                  style={{
                    width: `${(firstShare(r) / max) * 100}%`,
                    background: color(i),
                  }}
                />
              </div>
            )}
            <div className="poll-bar-track" aria-hidden="true">
              <div
                className="poll-bar-fill"
                style={{
                  width: `${((compare ? share(r) : r.count) / max) * 100}%`,
                  background: color(i),
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Pie({
  counts,
  results,
  label,
}: {
  counts: number[];
  results: PollResult[];
  label: string;
}) {
  const total = counts.reduce((a, b) => a + b, 0);
  const r = 100,
    cx = 120,
    cy = 120;
  let angle = -Math.PI / 2;
  const p = (a: number) =>
    `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  return (
    <svg viewBox="0 0 240 240" role="img" aria-label={label}>
      {!total && <circle cx={cx} cy={cy} r={r} fill="#e8ece2" />}
      {counts.map((count, i) => {
        const share = total ? count / total : 0,
          start = angle,
          end = angle + share * 2 * Math.PI;
        angle = end;
        if (share === 0) return null;
        const title = (
          <title>
            {results[i].text}: {count} ({percent(count, total)} %)
          </title>
        );
        if (share >= 0.9999)
          return (
            <circle key={results[i].id} cx={cx} cy={cy} r={r} fill={color(i)}>
              {title}
            </circle>
          );
        return (
          <path
            key={results[i].id}
            d={`M ${cx} ${cy} L ${p(start)} A ${r} ${r} 0 ${end - start > Math.PI ? 1 : 0} 1 ${p(end)} Z`}
            fill={color(i)}
            stroke="#fff"
            strokeWidth={2}
          >
            {title}
          </path>
        );
      })}
    </svg>
  );
}

function PieCharts({
  results,
  compare,
  votes,
  ownVotes,
}: {
  results: PollResult[];
  compare: boolean;
  votes: number;
  ownVotes: string[];
}) {
  const firstVotes = results.reduce((s, r) => s + (r.firstCount ?? 0), 0);
  return (
    <div className="poll-pie">
      {compare ? (
        <div className="poll-pie-pair">
          <figure>
            <Pie
              counts={results.map((r) => r.firstCount ?? 0)}
              results={results}
              label="Runde 1 als Tortendiagramm"
            />
            <figcaption>Runde 1</figcaption>
          </figure>
          <figure>
            <Pie
              counts={results.map((r) => r.count)}
              results={results}
              label="Runde 2 als Tortendiagramm"
            />
            <figcaption>Runde 2</figcaption>
          </figure>
        </div>
      ) : (
        <Pie
          counts={results.map((r) => r.count)}
          results={results}
          label="Ergebnisse als Tortendiagramm"
        />
      )}
      <ul className="poll-legend">
        {results.map((res, i) => (
          <li key={res.id}>
            <i aria-hidden="true" style={{ background: color(i) }} />
            <span>
              {res.text}
              <OwnVote show={ownVotes.includes(res.id)} />
            </span>
            {compare ? (
              <b>
                <small>{percent(res.firstCount ?? 0, firstVotes)} % →</small>{" "}
                {percent(res.count, votes)} %
              </b>
            ) : (
              <b>
                {percent(res.count, votes)} % <small>({res.count})</small>
              </b>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
