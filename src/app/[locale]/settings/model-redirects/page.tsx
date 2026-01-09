import { getTranslations } from "next-intl/server";
import { Section } from "@/components/section";
import { getSystemSettings } from "@/repository/system-config";
import { SettingsPageHeader } from "../_components/settings-page-header";
import { GlobalModelRedirectsForm } from "./_components/global-model-redirects-form";

export const dynamic = "force-dynamic";

export default async function GlobalModelRedirectsPage() {
  const t = await getTranslations("settings.modelRedirects");
  const settings = await getSystemSettings();

  return (
    <div className="space-y-6">
      <SettingsPageHeader title={t("title")} description={t("description")} />
      <Section title={t("section.title")} description={t("section.description")}>
        <GlobalModelRedirectsForm initialValue={settings.globalModelRedirects ?? {}} />
      </Section>
    </div>
  );
}
