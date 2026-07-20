import { Tabs } from "expo-router";
import { type ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { tabBarScreenOptions } from "soma-style";

/* Mobile-first bottom tab bar, matching the soma design system. macro-engine has
   three sections, so all three are primary tabs (no "More" overflow). The bar's
   look comes from soma-style's shared tabBarScreenOptions so it stays identical
   to soma's; routing stays app-local. */
type IconName = React.ComponentProps<typeof Ionicons>["name"];
const tabIcon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size} color={color as string} />
  );

export default function MainLayout() {
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-base">
      <Tabs screenOptions={tabBarScreenOptions}>
        <Tabs.Screen name="dashboard" options={{ title: "Home", tabBarIcon: tabIcon("home-outline") }} />
        <Tabs.Screen name="foods" options={{ title: "Foods", tabBarIcon: tabIcon("restaurant-outline") }} />
        <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: tabIcon("settings-outline") }} />
      </Tabs>
    </SafeAreaView>
  );
}
