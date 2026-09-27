import React from "react";
import { useKitTheme } from "../theme/ThemeProvider";

/**
 * A soft circular brand character — colors come from the video's theme
 * (avatarFrom/avatarTo), and the face is a swappable slot so this isn't
 * locked to Muse's specific look. Pass `face` to use a different face, or
 * omit it for the default simple dot-eyes-and-smile face.
 */
export const Avatar: React.FC<{ size: number; face?: React.ReactNode }> = ({ size, face }) => {
  const theme = useKitTheme();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        position: "relative",
        flex: "none",
        background: `radial-gradient(circle at 35% 28%, ${theme.avatarFrom}, ${theme.avatarTo})`,
      }}
    >
      {face ?? <DefaultFace />}
    </div>
  );
};

const DefaultFace: React.FC = () => (
  <>
    <span
      style={{
        position: "absolute",
        top: "40%",
        left: "30%",
        width: "11%",
        height: "11%",
        borderRadius: "50%",
        background: "#2b2119",
      }}
    />
    <span
      style={{
        position: "absolute",
        top: "40%",
        right: "30%",
        width: "11%",
        height: "11%",
        borderRadius: "50%",
        background: "#2b2119",
      }}
    />
    <div
      style={{
        position: "absolute",
        top: "56%",
        left: "50%",
        transform: "translateX(-50%)",
        width: "16%",
        height: "8%",
        borderBottom: "2px solid #2b2119",
        borderRadius: "0 0 50% 50%",
      }}
    />
  </>
);

export const AvatarBadge: React.FC<{ size: number; pad?: number; face?: React.ReactNode }> = ({
  size,
  pad = size * 0.12,
  face,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: "#fff",
      boxShadow: "0 16px 34px rgba(20,30,60,.18)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: pad,
      flex: "none",
    }}
  >
    <Avatar size={size - pad * 2} face={face} />
  </div>
);
