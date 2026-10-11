import type { CSSProperties } from 'react';
import { Butterfly } from './Butterfly';

type Flight = { path: 'a' | 'b'; duration: number; delay: number; size: number; slow?: boolean };

const FLIGHTS: Flight[] = [
  { path: 'a', duration: 17, delay: 0, size: 38 },
  { path: 'b', duration: 21, delay: -6, size: 30, slow: true },
  { path: 'a', duration: 24, delay: -11, size: 24, slow: true },
  { path: 'b', duration: 15, delay: -3, size: 44 },
  { path: 'a', duration: 19, delay: -15, size: 28 },
  { path: 'b', duration: 26, delay: -18, size: 22, slow: true },
];

/** Decorative butterflies drifting across their (relatively positioned) parent. Hidden for reduced-motion users. */
export function ButterflyField({ count = 4, color = '#ffffff', accent = '#72c198', className = '' }: {
  count?: number;
  color?: string;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={`bf-drift ${className}`} aria-hidden="true">
      {FLIGHTS.slice(0, count).map((f, i) => (
        <div
          key={i}
          className={`bf-path bf-drift-${f.path}`}
          style={{ '--bf-duration': `${f.duration}s`, '--bf-delay': `${f.delay}s` } as CSSProperties}
        >
          <div className="bf-bob" style={{ animationDelay: `${f.delay / 3}s` }}>
            <Butterfly size={f.size} color={color} accent={accent} slow={f.slow} style={{ opacity: 0.9 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
