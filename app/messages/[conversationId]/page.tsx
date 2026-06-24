"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import ConversationThread from "@/components/ConversationThread";
import { langFromParam } from "@/lib/i18n-lang";

function ConversationPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const conversationId = String(params.conversationId ?? "");
  const lang = langFromParam(searchParams.get("lang"));
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const me = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (me.ok) {
        const j = await me.json();
        setMyUserId(j.user?.id ?? null);
      }
    })();
  }, []);

  if (!conversationId) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#FDF8F1] px-4 py-8">
      <div className="max-w-lg mx-auto">
        <Link href="/messages" className="text-sm text-[#6B7280] hover:text-[#1B4332] mb-4 inline-block">
          {lang === "en" ? "← Messages" : "← Mensajes"}
        </Link>
        <ConversationThread conversationId={conversationId} myUserId={myUserId} lang={lang} />
      </div>
    </main>
  );
}

export default function ConversationPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#FDF8F1] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <ConversationPageInner />
    </Suspense>
  );
}
