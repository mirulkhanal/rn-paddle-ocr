export class PolygonUtils {
  static isClockwise(points: number[]): boolean {
    if (points.length < 6) {
      return false;
    }

    const n = points.length / 2;
    let area = 0.0;

    for (let i = 0; i < n; i++) {
      const x = points[2 * i];
      const y = points[2 * i + 1];
      const nextIdx = (i + 1) % n;
      const nextX = points[2 * nextIdx];
      const nextY = points[2 * nextIdx + 1];

      area += (nextX - x) * (nextY + y);
    }

    return area < 0;
  }

  static sigmoid(x: number): number {
    const clipped = Math.max(-500, Math.min(500, x));
    return 1.0 / (1.0 + Math.exp(-clipped));
  }
}

