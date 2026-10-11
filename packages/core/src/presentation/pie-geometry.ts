/**
 * SVG path data for a wedge of a pie centred at (radius, radius), from one
 * fraction of a full turn to another, clockwise from twelve o'clock.
 * Plain strings, so web SVG and react-native-svg draw the same pie.
 */
export function wedgePath(from: number, to: number, radius: number): string {
  const span = to - from;

  if (span <= 0) return "";

  if (span >= 0.9999) {
    return `M ${radius} 0 A ${radius} ${radius} 0 1 1 ${radius} ${radius * 2} A ${radius} ${radius} 0 1 1 ${radius} 0 Z`;
  }

  const [startX, startY] = pointAt(from, radius);
  const [endX, endY] = pointAt(to, radius);
  const largeArc = span > 0.5 ? 1 : 0;

  return `M ${radius} ${radius} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

function pointAt(turn: number, radius: number): readonly [number, number] {
  const angle = turn * 2 * Math.PI;

  return [round(radius + radius * Math.sin(angle)), round(radius - radius * Math.cos(angle))];
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
