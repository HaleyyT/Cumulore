import { QuestShell } from "../modules/quest/components/quest-shell";
import { readQuestRuntimeConfig } from "../modules/quest/runtime-config";

export const dynamic = "force-dynamic";

export default function Page() {
  let liveAvailable = false;
  try {
    const config = readQuestRuntimeConfig();
    liveAvailable =
      config.liveEnabled &&
      config.provider === "openai" &&
      Boolean(config.apiKey);
  } catch {
    liveAvailable = false;
  }
  return <QuestShell liveAvailable={liveAvailable} />;
}
