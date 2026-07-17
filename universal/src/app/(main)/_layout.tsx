import { Slot, usePathname, useRouter } from "expo-router";
import { View } from "react-native";
import { NavBar } from "soma-style";

const ITEMS = [
  { key: "dashboard", label: "Home" },
  { key: "foods", label: "Foods" },
  { key: "settings", label: "Settings" },
];

/** Shared shell for the main app screens — top nav + routed content. */
export default function MainLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const active = ITEMS.find((i) => pathname.startsWith(`/${i.key}`))?.key ?? "dashboard";

  return (
    <View className="flex-1 bg-base">
      <NavBar
        brand="MacroEngine"
        items={ITEMS}
        active={active}
        onSelect={(key) => router.push(`/${key}` as never)}
      />
      <Slot />
    </View>
  );
}
