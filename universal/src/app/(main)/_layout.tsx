import { Tabs } from "expo-router";
import { type ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

/* Mobile-first bottom tab bar, matching the soma design system. macro-engine has
   three sections, so all three are primary tabs (no "More" overflow). Tokens are
   mirrored from soma-style/preset.js since the tab bar is native chrome. */
const TEAL = "#77c8d1";
const MUTED = "#5a7a8a";
const SURFACE = "#0e1a26";
const BORDER = "#1a3040";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const tabIcon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size} color={color as string} />
  );

export default function MainLayout() {
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-base">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: TEAL,
          tabBarInactiveTintColor: MUTED,
          tabBarStyle: { backgroundColor: SURFACE, borderTopColor: BORDER, borderTopWidth: 1 },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
          sceneStyle: { backgroundColor: "#0a1720" },
        }}
      >
        <Tabs.Screen name="dashboard" options={{ title: "Home", tabBarIcon: tabIcon("home-outline") }} />
        <Tabs.Screen name="foods" options={{ title: "Foods", tabBarIcon: tabIcon("restaurant-outline") }} />
        <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: tabIcon("settings-outline") }} />
      </Tabs>
    </SafeAreaView>
  );
}
