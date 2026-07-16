import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Text, SegmentedControl, Input } from "soma-style";

export default function FoodsScreen() {
  const [tab, setTab] = useState<"Search Foods" | "Create Custom">("Search Foods");
  return (
    <ScrollView className="flex-1 bg-base" contentContainerClassName="items-center px-5 py-6">
      <View className="w-full max-w-2xl gap-4">
        <View className="gap-1">
          <Text variant="headline">Food Library</Text>
          <Text variant="body" className="text-text-secondary">
            Browse ingredients, search USDA foods, and manage your custom foods.
          </Text>
        </View>
        <SegmentedControl options={["Search Foods", "Create Custom"] as const} value={tab} onChange={setTab} className="self-start" />
        {tab === "Search Foods" ? (
          <Input placeholder="Search foods (e.g. chicken breast, banana, rice)…" />
        ) : (
          <View className="gap-3">
            <Input placeholder="Custom food name" />
            <View className="flex-row gap-3">
              <Input placeholder="kcal" keyboardType="numeric" className="flex-1" />
              <Input placeholder="protein g" keyboardType="numeric" className="flex-1" />
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
