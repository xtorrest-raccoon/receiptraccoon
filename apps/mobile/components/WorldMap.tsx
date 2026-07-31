import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { ReactNativeZoomableView } from "@openspacelabs/react-native-zoomable-view";
import { color } from "@rr/ui-tokens";
import { rn } from "../lib/colors";
import { WORLD_MAP_PATHS, WORLD_MAP_VIEWBOX } from "../lib/worldMapData";

const OCEAN = "#0B2036";
const LAND_DEFAULT = "#233C54";
const LAND_VISITED = rn(color.brand);
const LAND_SELECTED = "#ffffff";
const BORDER = "#0B2036";

/**
 * Pan-and-pinch flat world map (Equal Earth projection, precomputed at build
 * time -- see lib/worldMapData.ts). Only countries with at least one receipt
 * are tappable; the rest render as inert background shape.
 */
export function WorldMap({
  visited,
  selected,
  onSelectCountry,
}: {
  visited: Set<string>;
  selected?: string | null;
  onSelectCountry: (code: string) => void;
}) {
  return (
    <View style={styles.wrap}>
      <ReactNativeZoomableView
        maxZoom={6}
        minZoom={1}
        initialZoom={1}
        bindToBorders
        style={styles.zoomable}
      >
        <Svg viewBox={WORLD_MAP_VIEWBOX} width="100%" height="100%">
          {Object.entries(WORLD_MAP_PATHS).map(([code, d]) => {
            const isVisited = visited.has(code);
            const isSelected = selected === code;
            return (
              <Path
                key={code}
                d={d}
                fill={isSelected ? LAND_SELECTED : isVisited ? LAND_VISITED : LAND_DEFAULT}
                stroke={BORDER}
                strokeWidth={0.6}
                onPress={isVisited ? () => onSelectCountry(code) : undefined}
              />
            );
          })}
        </Svg>
      </ReactNativeZoomableView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 260,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: OCEAN,
  },
  zoomable: {
    width: "100%",
    height: "100%",
  },
});
