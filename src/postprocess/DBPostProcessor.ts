import { DetResizeMeta } from './DetResizeMeta';
import { PolygonUtils } from './PolygonUtils';
import { FindContours } from '../utils/FindContours';
import { Point } from '../types/Point.interface';
import { Box } from '../types/Box.interface';
import { DBPostProcessConfig } from '../types/DBPostProcessConfig.interface';
import * as ClipperLib from 'js-clipper';

interface ClipperPath {
  X: number;
  Y: number;
}

export class DBPostProcessor {
  private config: DBPostProcessConfig;

  constructor(config: Partial<DBPostProcessConfig> = {}) {
    this.config = {
      thresh: config.thresh ?? 0.3,
      boxThresh: config.boxThresh ?? 0.6,
      maxCandidates: config.maxCandidates ?? 1000,
      unclipRatio: config.unclipRatio ?? 1.5,
    };
  }

  process(
    pred: Float32Array,
    width: number,
    height: number,
    resizeMeta: DetResizeMeta
  ): Box[] {
    const { thresh, boxThresh, maxCandidates, unclipRatio } = this.config;
    const expectedSize = width * height;
    if (pred.length < expectedSize) {
      throw new Error(`Invalid det map size: ${pred.length} (expected ${expectedSize})`);
    }

    const probMap = this.ensureProbMap(pred.subarray(0, expectedSize));

    const binaryMap = new Uint8Array(width * height);
    for (let i = 0; i < probMap.length; i++) {
        binaryMap[i] = probMap[i] > thresh ? 1 : 0;
    }

    const contours = FindContours.findContours(binaryMap, width, height);

    const boxes: Box[] = [];

    for (let i = 0; i < Math.min(contours.length, maxCandidates); i++) {
      const contour = contours[i];
      
      const flatContour: number[] = [];
      contour.forEach(p => { flatContour.push(p.x); flatContour.push(p.y); });
      
      let area = 0;
      for (let j = 0; j < contour.length; j++) {
          const p1 = contour[j];
          const p2 = contour[(j + 1) % contour.length];
          area += (p2.x - p1.x) * (p2.y + p1.y);
      }
      area = Math.abs(area) / 2.0;

      if (area < 3) continue;

      const minRect = FindContours.minAreaRect(contour);
      if (Math.min(minRect.size.width, minRect.size.height) < 3) continue;

      const score = this.boxScore(probMap, width, height, contour);
      if (score < boxThresh) continue;

      const unclipped = this.unclip(contour, unclipRatio, area);
      if (!unclipped) continue;

      const finalRect = FindContours.minAreaRect(unclipped);
      if (Math.min(finalRect.size.width, finalRect.size.height) < 3) continue;

      const finalBoxPoints = this.rectToPoints(finalRect);

      const outToInScaleX = resizeMeta.resizeW / width;
      const outToInScaleY = resizeMeta.resizeH / height;
      const scaledPoints = finalBoxPoints.map(p => ({
          x: Math.min(Math.max((p.x * outToInScaleX) / resizeMeta.scale, 0), resizeMeta.origW),
          y: Math.min(Math.max((p.y * outToInScaleY) / resizeMeta.scale, 0), resizeMeta.origH)
      }));

      boxes.push({
          points: scaledPoints,
          score: score
      });
    }

    return boxes;
  }

  private ensureProbMap(pred: Float32Array): Float32Array {
    const step = Math.max(1, Math.floor(pred.length / 2048));
    for (let i = 0; i < pred.length; i += step) {
      const v = pred[i];
      if (v < -0.001 || v > 1.001) {
        const out = new Float32Array(pred.length);
        for (let j = 0; j < pred.length; j++) {
          out[j] = PolygonUtils.sigmoid(pred[j]);
        }
        return out;
      }
    }

    return pred;
  }

  private boxScore(
      pred: Float32Array, 
      width: number, 
      height: number, 
      contour: Point[]
  ): number {
      let minX = width, maxX = 0, minY = height, maxY = 0;
      for (const p of contour) {
          minX = Math.min(minX, Math.floor(p.x));
          maxX = Math.max(maxX, Math.ceil(p.x));
          minY = Math.min(minY, Math.floor(p.y));
          maxY = Math.max(maxY, Math.ceil(p.y));
      }
      
      minX = Math.max(0, minX);
      maxX = Math.min(width - 1, maxX);
      minY = Math.max(0, minY);
      maxY = Math.min(height - 1, maxY);

      let sum = 0;
      let count = 0;

      for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
              if (this.pointInPolygon(x, y, contour)) {
                  sum += pred[y * width + x];
                  count++;
              }
          }
      }

      return count === 0 ? 0 : sum / count;
  }

  private pointInPolygon(x: number, y: number, poly: Point[]): boolean {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const xi = poly[i].x, yi = poly[i].y;
          const xj = poly[j].x, yj = poly[j].y;
          
          const intersect = ((yi > y) !== (yj > y))
              && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
      }
      return inside;
  }

  private unclip(points: Point[], unclipRatio: number, area: number): Point[] | null {
      let perimeter = 0;
      for (let i = 0; i < points.length; i++) {
          const p1 = points[i];
          const p2 = points[(i + 1) % points.length];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          perimeter += Math.sqrt(dx * dx + dy * dy);
      }
      
      if (perimeter < 1e-6) return null;

      const distance = (area * unclipRatio) / perimeter;
      const scale = 1000.0;

      const path: ClipperPath[] = points.map(p => ({
          X: Math.round(p.x * scale),
          Y: Math.round(p.y * scale)
      }));

      const co = new ClipperLib.ClipperOffset();
      co.AddPath(path, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);

      const solution: ClipperPath[][] = [];
      co.Execute(solution, distance * scale);

      if (!solution || solution.length === 0) return null;

      let maxArea = -1;
      let bestPath: ClipperPath[] | null = null;

      for (const p of solution) {
          let pArea = 0;
          for (let j = 0; j < p.length; j++) {
              const p1 = p[j];
              const p2 = p[(j + 1) % p.length];
              pArea += (p2.X - p1.X) * (p2.Y + p1.Y);
          }
          pArea = Math.abs(pArea) / 2.0;
          
          if (pArea > maxArea) {
              maxArea = pArea;
              bestPath = p;
          }
      }

      if (!bestPath) return null;

      return bestPath.map(p => ({
          x: p.X / scale,
          y: p.Y / scale
      }));
  }

  private rectToPoints(rect: { center: Point, size: {width: number, height: number}, angle: number }): Point[] {
      const { center, size, angle } = rect;
      const w2 = size.width / 2;
      const h2 = size.height / 2;
      
      const corners = [
          { x: -w2, y: -h2 },
          { x: w2, y: -h2 },
          { x: w2, y: h2 },
          { x: -w2, y: h2 }
      ];
      
      const rad = angle * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      return corners.map(p => ({
          x: center.x + (p.x * cos - p.y * sin),
          y: center.y + (p.x * sin + p.y * cos)
      }));
  }
}

