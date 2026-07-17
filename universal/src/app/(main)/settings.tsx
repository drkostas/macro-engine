import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Text, Card, Input, Button, Pill, PillGroup, Badge } from "soma-style";
import { useProfile, updateProfile } from "../../lib/api";

const TABS = ["Profile", "Deficit mode", "Body comp", "Goals", "Activity", "Reminders"];

const FIELDS: { key: string; label: string; unit?: string }[] = [
  { key: "weight_kg", label: "Weight", unit: "kg" },
  { key: "height_cm", label: "Height", unit: "cm" },
  { key: "age", label: "Age", unit: "yrs" },
  { key: "estimated_bf_pct", label: "Current BF%", unit: "%" },
  { key: "daily_deficit", label: "Daily deficit", unit: "kcal" },
];

export default function SettingsScreen() {
  const [tab, setTab] = useState("Profile");
  const profile = useProfile();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      const v: Record<string, string> = {};
      FIELDS.forEach((f) => (v[f.key] = String(profile[f.key] ?? "")));
      setValues(v);
    }
  }, [profile]);

  async function saveAll() {
    setSaving(true);
    for (const f of FIELDS) {
      if (values[f.key] !== undefined && values[f.key] !== "") {
        await updateProfile(f.key, Number(values[f.key]));
      }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <ScrollView className="flex-1 bg-base" contentContainerClassName="items-center px-5 py-6">
      <View className="w-full max-w-2xl gap-4">
        <Text variant="headline">Settings</Text>
        <PillGroup>
          {TABS.map((t) => (
            <Pill key={t} label={t} active={tab === t} onPress={() => setTab(t)} />
          ))}
        </PillGroup>

        <Card className="gap-1">
          <Text variant="title" className="mb-2">Personal info</Text>
          {FIELDS.map((f) => (
            <View key={f.key} className="flex-row items-center justify-between border-b border-border-subtle py-3">
              <Text variant="body" className="text-text-secondary">{f.label}</Text>
              <View className="flex-row items-center gap-2">
                <Input
                  value={values[f.key] ?? ""}
                  onChangeText={(t) => setValues((s) => ({ ...s, [f.key]: t }))}
                  keyboardType="numeric"
                  className="w-24 text-center"
                />
                {f.unit ? <Text variant="caption" className="text-text-muted">{f.unit}</Text> : null}
              </View>
            </View>
          ))}
          <View className="mt-3 flex-row items-center gap-3">
            <Button label={saving ? "Saving…" : "Save changes"} variant="primary" size="sm" disabled={saving} onPress={saveAll} />
            {saved ? <Badge label="Saved" tone="success" /> : null}
          </View>
        </Card>

        <Card className="gap-3">
          <Text variant="title">Data</Text>
          <Button label="Export CSV" variant="secondary" size="sm" className="self-start" />
        </Card>
      </View>
    </ScrollView>
  );
}
