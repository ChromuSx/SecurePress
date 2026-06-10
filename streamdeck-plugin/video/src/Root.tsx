import React from "react";
import { Composition, Still } from "remotion";
import {
  GalleryHero,
  GalleryPropertyInspector,
  SecurePressPromo,
  SecurePressThumbnail,
} from "./SecurePressPromo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SecurePressPromo"
        component={SecurePressPromo}
        durationInFrames={1440}
        fps={60}
        width={1920}
        height={1080}
      />
      <Still
        id="SecurePressThumbnail"
        component={SecurePressThumbnail}
        width={1920}
        height={960}
      />
      <Still
        id="SecurePressHero"
        component={GalleryHero}
        width={1920}
        height={960}
      />
      <Still
        id="SecurePressPropertyInspector"
        component={GalleryPropertyInspector}
        width={1920}
        height={960}
      />
    </>
  );
};
