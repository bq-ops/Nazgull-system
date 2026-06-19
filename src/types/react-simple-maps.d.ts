declare module "react-simple-maps" {
  import * as React from "react";

  interface ProjectionConfig {
    scale?: number;
    center?: [number, number];
    rotate?: [number, number, number];
  }

  interface ComposableMapProps {
    projection?: string;
    projectionConfig?: ProjectionConfig;
    width?: number;
    height?: number;
    style?: React.CSSProperties;
    className?: string;
    children?: React.ReactNode;
  }
  export function ComposableMap(props: ComposableMapProps): React.ReactElement;

  interface GeographiesProps {
    geography: string | object;
    children: (props: { geographies: Geography[] }) => React.ReactNode;
  }
  export function Geographies(props: GeographiesProps): React.ReactElement;

  interface Geography {
    rsmKey: string;
    properties: Record<string, unknown>;
    geometry: object;
  }

  interface GeographyProps {
    geography: Geography;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: {
      default?: React.CSSProperties;
      hover?: React.CSSProperties;
      pressed?: React.CSSProperties;
    };
    onMouseEnter?: (evt: React.MouseEvent<SVGPathElement>) => void;
    onMouseLeave?: (evt: React.MouseEvent<SVGPathElement>) => void;
  }
  export function Geography(props: GeographyProps): React.ReactElement;

  interface MarkerProps {
    coordinates: [number, number];
    onMouseEnter?: (evt: React.MouseEvent<SVGGElement>) => void;
    onMouseLeave?: (evt: React.MouseEvent<SVGGElement>) => void;
    onMouseMove?: (evt: React.MouseEvent<SVGGElement>) => void;
    onClick?: (evt: React.MouseEvent<SVGGElement>) => void;
    children?: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
  }
  export function Marker(props: MarkerProps): React.ReactElement;

  interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    onMoveStart?: (pos: object) => void;
    onMove?: (pos: object) => void;
    onMoveEnd?: (pos: object) => void;
    children?: React.ReactNode;
  }
  export function ZoomableGroup(props: ZoomableGroupProps): React.ReactElement;
}
