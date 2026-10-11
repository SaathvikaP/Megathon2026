import type { CSSProperties } from 'react';

type Props = {
  size?: number;
  color?: string;
  accent?: string;
  className?: string;
  style?: CSSProperties;
  slow?: boolean;
};

/** One wing (drawn as the left side); the right side mirrors it. The inner group carries the flap animation. */
function Wing({ color, accent }: { color: string; accent: string }) {
  return (
    <g className="bf-wing">
      <path d="M32 23 C25 7 9 1 4 9 C-1 18 12 26 32 25 Z" fill={color} />
      <path d="M32 26 C21 26 9 32 11 41 C13 49 26 41 32 29 Z" fill={color} />
      <circle cx="12" cy="11" r="2.6" fill={accent} />
      <circle cx="19" cy="15" r="1.8" fill={accent} />
      <circle cx="9" cy="17" r="1.4" fill={accent} />
      <path d="M14 7 C19 10 24 15 29 21" stroke={accent} strokeWidth="0.9" fill="none" strokeLinecap="round" />
      <circle cx="17" cy="37" r="2.2" fill={accent} />
      <circle cx="23" cy="33" r="1.3" fill={accent} />
    </g>
  );
}

export function Butterfly({ size = 48, color = '#ffffff', accent = '#72c198', className = '', style, slow = false }: Props) {
  return (
    <svg
      viewBox="0 0 64 48"
      width={size}
      height={(size * 48) / 64}
      className={`${slow ? 'bf-slow ' : ''}${className}`}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <Wing color={color} accent={accent} />
      <g transform="translate(64 0) scale(-1 1)">
        <Wing color={color} accent={accent} />
      </g>
      <ellipse cx="32" cy="26" rx="1.8" ry="9" fill={color} />
      <path d="M31.5 17 C30 12 27 9 25 8 M32.5 17 C34 12 37 9 39 8" stroke={color} strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  );
}
