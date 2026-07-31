import { Tabs } from "expo-router";
import { TabBar } from "../../components/TabBar";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="analytics" options={{ title: "Analytics" }} />
      <Tabs.Screen name="capture" options={{ title: "Capture", tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="receipts" options={{ title: "Receipts" }} />
      <Tabs.Screen name="mileage" options={{ title: "Mileage" }} />
    </Tabs>
  );
}
