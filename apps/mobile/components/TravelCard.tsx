import { forwardRef } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { WorldMap } from "./WorldMap";

const CARD_BG = "#0B1B2E";
const CARD_BORDER = "#2C5C8A";
const BRAND_GREEN = "#3B8C5A";

interface TravelCardProps {
  name: string;
  visited: Set<string>;
  worldPct: number;
  tripCount: number;
  countryCount: number;
  onSelectCountry?: (code: string) => void;
}

/**
 * The one thing both shown on-screen and captured for sharing (see the
 * Analytics screen's onShare) -- Revolut's "Travels" card look: dark
 * background, branded header, map, and stats all inside a single framed
 * card, so the shared image doesn't need a second layout to maintain.
 * `collapsable={false}` keeps Android from flattening this view out of the
 * native hierarchy, which would otherwise make it capture as blank.
 */
export const TravelCard = forwardRef<View, TravelCardProps>(function TravelCard(
  { name, visited, worldPct, tripCount, countryCount, onSelectCountry },
  ref,
) {
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.brandRow}>
          <Image source={require("../assets/images/icon-mark.png")} style={styles.brandMark} />
          <Text style={styles.brandText}>
            receipt<Text style={styles.brandAccent}>raccoon</Text>
          </Text>
        </View>
        <View style={styles.travelsRow}>
          <Text style={styles.planeIcon}>✈️</Text>
          <Text style={styles.travelsText}>{name}&rsquo;s Travels</Text>
        </View>
      </View>

      <View style={styles.mapWrap}>
        <WorldMap visited={visited} onSelectCountry={onSelectCountry ?? (() => {})} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{worldPct}%</Text>
          <Text style={styles.statLabel}>Of the world</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{tripCount}</Text>
          <Text style={styles.statLabel}>Trips</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{countryCount}</Text>
          <Text style={styles.statLabel}>Countries</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 16,
    // A soft glow along the border reads closer to Revolut's card than a flat
    // 1px line -- shadow is the only way to fake that without a gradient
    // border, which RN's StyleSheet has no primitive for.
    shadowColor: CARD_BORDER,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  brandMark: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  brandText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
  brandAccent: {
    color: BRAND_GREEN,
  },
  travelsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  planeIcon: {
    fontSize: 13,
  },
  travelsText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  mapWrap: {
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  statValue: {
    fontSize: 19,
    fontWeight: "800",
    color: "#fff",
  },
  statLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
  },
});
