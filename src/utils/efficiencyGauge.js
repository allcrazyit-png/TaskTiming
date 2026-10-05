export function efficiencyGaugePoint(value, radius = 72) {
    const bounded = Math.max(0, Math.min(150, Number(value) || 0));
    const angle = Math.PI + (bounded / 150) * Math.PI;
    return { x: 90 + radius * Math.cos(angle), y: 88 + radius * Math.sin(angle) };
}
