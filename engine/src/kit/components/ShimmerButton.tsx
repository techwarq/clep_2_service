import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ShimmerButton as ShimmerButtonBase, ShimmerButtonProps } from "./ui/shimmer-button";
import { useKitTheme } from "../theme/ThemeProvider";

/** Frame-locked Magic UI shimmer button, themed from the video's KitTheme. */
export const ShimmerButton: React.FC<Omit<ShimmerButtonProps, "frameOffsetSeconds">> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useKitTheme();
  return (
    <ShimmerButtonBase
      background={theme.primary}
      shimmerColor={theme.primaryForeground}
      frameOffsetSeconds={frame / fps}
      {...props}
    />
  );
};
