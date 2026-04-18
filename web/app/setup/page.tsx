import { isGarminEnabled } from "@/lib/feature-flags";
import { SetupClient } from "./setup-client";

export default function SetupPage() {
  const garminEnabled = isGarminEnabled();
  return <SetupClient garminEnabled={garminEnabled} />;
}
