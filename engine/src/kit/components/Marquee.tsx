import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Marquee as MarqueeBase } from "./ui/marquee";

type MarqueeBaseProps = React.ComponentProps<typeof MarqueeBase>;

/** Frame-locked Magic UI marquee (scrolling row of cards/logos/pills). */
export const Marquee: React.FC<Omit<MarqueeBaseProps, "frameOffsetSeconds">> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <MarqueeBase frameOffsetSeconds={frame / fps} {...props} />;
};
