import Svg, { Path, Ellipse } from "react-native-svg";
import { color } from "@rr/ui-tokens";
import { rn } from "../lib/colors";

/** The raccoon face mark from the design's home-header tile, ported to react-native-svg. */
export function RaccoonMark({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Path
        d="M100,18 C60,18 34,44 34,78 C22,84 14,96 14,112 C14,132 30,148 50,148 C54,148 58,147 62,146 C68,162 82,172 100,172 C118,172 132,162 138,146 C142,147 146,148 150,148 C170,148 186,132 186,112 C186,96 178,84 166,78 C166,44 140,18 100,18 Z M50,72 C56,66 66,62 76,62 C80,62 82,66 80,70 C74,80 64,86 54,86 C48,86 46,78 50,72 Z M150,72 C154,78 152,86 146,86 C136,86 126,80 120,70 C118,66 120,62 124,62 C134,62 144,66 150,72 Z"
        fill={rn(color.text)}
      />
      <Ellipse cx="76" cy="102" rx="14" ry="17" fill="#ffffff" />
      <Ellipse cx="124" cy="102" rx="14" ry="17" fill="#ffffff" />
      <Ellipse cx="100" cy="126" rx="10" ry="7" fill={rn(color.brand)} />
    </Svg>
  );
}
