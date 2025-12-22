import { Point } from '../types/Point.interface';

export class FindContours {
  static findContours(data: Uint8Array | Float32Array | number[], width: number, height: number): Point[][] {
    const contours: Point[][] = [];
    const visited = new Uint8Array(width * height);
    const isForeground = (idx: number) => data[idx] > 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (isForeground(idx) && !visited[idx]) {
          let isBorder = false;
          if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
            isBorder = true;
          } else {
            const offsets = [
              -width - 1, -width, -width + 1,
              -1, 1,
              width - 1, width, width + 1,
            ];

            for (const off of offsets) {
              if (!isForeground(idx + off)) {
                isBorder = true;
                break;
              }
            }
          }
          
          if (isBorder) {
             const contour = this.traceContour(data, width, height, x, y, visited);
             if (contour.length > 0) {
               contours.push(contour);
             }
          }
        }
      }
    }
    return contours;
  }

  private static traceContour(
    data: Uint8Array | Float32Array | number[], 
    width: number, 
    height: number, 
    startX: number, 
    startY: number, 
    visited: Uint8Array
  ): Point[] {
    const contour: Point[] = [];
    const x = startX;
    const y = startY;
    
    const neighbors = [
      {x: 0, y: -1}, {x: 1, y: -1}, {x: 1, y: 0}, {x: 1, y: 1},
      {x: 0, y: 1}, {x: -1, y: 1}, {x: -1, y: 0}, {x: -1, y: -1}
    ];

    let backtrackIdx = -1;
    for (let i = 0; i < 8; i++) {
        const nx = x + neighbors[i].x;
        const ny = y + neighbors[i].y;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height || data[ny * width + nx] === 0) {
            backtrackIdx = i;
            break;
        }
    }
    
    if (backtrackIdx === -1) {
        visited[y * width + x] = 1;
        return [{x, y}];
    }

    let pX = x;
    let pY = y;
    
    const startIdx = y * width + x;
    contour.push({x, y});
    visited[startIdx] = 1;

    let currentBacktrack = backtrackIdx;
    let iter = 0;
    const maxIter = width * height; 

    while (iter < maxIter) {
        let foundNext = false;
        for (let i = 0; i < 8; i++) {
            const checkIdx = (currentBacktrack + 1 + i) % 8; 
            const nx = pX + neighbors[checkIdx].x;
            const ny = pY + neighbors[checkIdx].y;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                if (data[ny * width + nx] > 0) {
                    pX = nx;
                    pY = ny;
                    currentBacktrack = (checkIdx + 4) % 8;
                    foundNext = true;
                    break;
                }
            }
        }
        
        if (!foundNext) {
            break;
        }
        
        if (pX === startX && pY === startY) {
            break;
        }
        
        contour.push({x: pX, y: pY});
        visited[pY * width + pX] = 1;
        iter++;
    }

    return contour;
  }
  
  static approxPolyDP(points: Point[], epsilon: number): Point[] {
    if (points.length <= 2) return points;

    let dmax = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
      const d = this.perpendicularDistance(points[i], points[0], points[end]);
      if (d > dmax) {
        index = i;
        dmax = d;
      }
    }

    if (dmax > epsilon) {
      const res1 = this.approxPolyDP(points.slice(0, index + 1), epsilon);
      const res2 = this.approxPolyDP(points.slice(index), epsilon);
      return res1.slice(0, res1.length - 1).concat(res2);
    } else {
      return [points[0], points[end]];
    }
  }

  private static perpendicularDistance(p: Point, lineStart: Point, lineEnd: Point): number {
    let dx = lineEnd.x - lineStart.x;
    let dy = lineEnd.y - lineStart.y;
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 0) {
      dx /= mag;
      dy /= mag;
    }
    const pvx = p.x - lineStart.x;
    const pvy = p.y - lineStart.y;
    
    const pv_dot = pvx * dx + pvy * dy;
    const dsx = pv_dot * dx;
    const dsy = pv_dot * dy;
    
    const ax = pvx - dsx;
    const ay = pvy - dsy;
    return Math.sqrt(ax * ax + ay * ay);
  }

  static minAreaRect(points: Point[]): { center: Point, size: {width: number, height: number}, angle: number } {
    if (points.length === 0) return { center: {x:0, y:0}, size: {width:0, height:0}, angle: 0 };
    
    const hull = this.convexHull(points);
    
    let minArea = Number.MAX_VALUE;
    let bestRect = { center: {x:0, y:0}, size: {width:0, height:0}, angle: 0 };
    
    if (hull.length < 3) {
        return this.boundingRect(points);
    }
    
    for (let i = 0; i < hull.length; i++) {
        const p1 = hull[i];
        const p2 = hull[(i + 1) % hull.length];
        
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);
        
        let minX = Number.MAX_VALUE, maxX = -Number.MAX_VALUE;
        let minY = Number.MAX_VALUE, maxY = -Number.MAX_VALUE;
        
        for (const p of hull) {
            const rx = p.x * cos - p.y * sin;
            const ry = p.x * sin + p.y * cos;
            minX = Math.min(minX, rx);
            maxX = Math.max(maxX, rx);
            minY = Math.min(minY, ry);
            maxY = Math.max(maxY, ry);
        }
        
        const width = maxX - minX;
        const height = maxY - minY;
        const area = width * height;
        
        if (area < minArea) {
            minArea = area;
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;
            
            const center = {
                x: cx * Math.cos(angle) - cy * Math.sin(angle),
                y: cx * Math.sin(angle) + cy * Math.cos(angle)
            };
            
            bestRect = {
                center,
                size: { width, height },
                angle: angle * 180 / Math.PI
            };
        }
    }
    
    return bestRect;
  }
  
  static boundingRect(points: Point[]): { center: Point, size: {width: number, height: number}, angle: number } {
      let minX = Number.MAX_VALUE, maxX = -Number.MAX_VALUE;
      let minY = Number.MAX_VALUE, maxY = -Number.MAX_VALUE;
      for (const p of points) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
      }
      const width = maxX - minX;
      const height = maxY - minY;
      return {
          center: { x: minX + width/2, y: minY + height/2 },
          size: { width, height },
          angle: 0
      };
  }
  
  static convexHull(points: Point[]): Point[] {
      const sorted = points.slice().sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
      
      const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
      
      const lower: Point[] = [];
      for (const p of sorted) {
          while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
              lower.pop();
          }
          lower.push(p);
      }
      
      const upper: Point[] = [];
      for (let i = sorted.length - 1; i >= 0; i--) {
          const p = sorted[i];
          while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
              upper.pop();
          }
          upper.push(p);
      }
      
      upper.pop();
      lower.pop();
      return lower.concat(upper);
  }
}

