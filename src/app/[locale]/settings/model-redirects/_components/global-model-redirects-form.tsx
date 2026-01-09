"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveSystemSettings } from "@/actions/system-config";
import { Button } from "@/components/ui/button";
import { ModelRedirectEditor } from "../../providers/_components/model-redirect-editor";

interface GlobalModelRedirectsFormProps {
  initialValue: Record<string, string>;
}

export function GlobalModelRedirectsForm({ initialValue }: GlobalModelRedirectsFormProps) {
  const router = useRouter();
  const t = useTranslations("settings.modelRedirects");
  const tCommon = useTranslations("settings.common");
  const [modelRedirects, setModelRedirects] = useState<Record<string, string>>(initialValue);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const normalized = Object.keys(modelRedirects).length > 0 ? modelRedirects : null;
      const result = await saveSystemSettings({
        globalModelRedirects: normalized,
      });

      if (!result.ok) {
        toast.error(result.error || t("form.saveFailed"));
        return;
      }

      setModelRedirects(result.data?.globalModelRedirects ?? {});
      toast.success(t("form.saved"));
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSave();
      }}
      className="space-y-6"
    >
      <ModelRedirectEditor
        value={modelRedirects}
        onChange={setModelRedirects}
        disabled={isPending}
        translationNamespace="settings.modelRedirects.editor"
      />

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon("saving") : t("form.save")}
        </Button>
      </div>
    </form>
  );
}
