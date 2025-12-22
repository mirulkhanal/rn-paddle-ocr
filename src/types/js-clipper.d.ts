declare module 'js-clipper' {
  export enum JoinType {
    jtSquare = 0,
    jtRound = 1,
    jtMiter = 2
  }

  export enum EndType {
    etClosedPolygon = 0,
    etClosedLine = 1,
    etOpenButt = 2,
    etOpenSquare = 3,
    etOpenRound = 4
  }

  export interface IntPoint {
    X: number;
    Y: number;
  }

  export class ClipperOffset {
    AddPath(path: IntPoint[], joinType: JoinType, endType: EndType): void;
    Execute(solution: IntPoint[][], delta: number): void;
  }

  const ClipperLib: {
    ClipperOffset: typeof ClipperOffset;
    JoinType: typeof JoinType;
    EndType: typeof EndType;
  };

  export = ClipperLib;
}

