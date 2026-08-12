declare module '@react-three/fiber';
declare module 'three';

import React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      line: any;
      bufferGeometry: any;
      bufferAttribute: any;
      lineBasicMaterial: any;
      mesh: any;
      sphereGeometry: any;
      meshBasicMaterial: any;
      ambientLight: any;
    }
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      line: any;
      bufferGeometry: any;
      bufferAttribute: any;
      lineBasicMaterial: any;
      mesh: any;
      sphereGeometry: any;
      meshBasicMaterial: any;
      ambientLight: any;
    }
  }
}
