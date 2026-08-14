import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/newspaper")}
          className="text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to The Cacti
        </Button>

        <article className="cacti-report">
          <h1
            className="text-2xl tracking-wider text-primary uppercase mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Privacy Policy
          </h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-8" style={{ fontFamily: "var(--font-mono)" }}>
            Last updated 2026-05-20
          </p>

          <h2>What we collect</h2>
          <p>
            <strong>Google account info.</strong> When you sign in with Google we receive your
            email address, name, and avatar URL. We use these to identify your account and
            display your profile inside the app. We never sell, share, or use this data for
            advertising.
          </p>
          <p>
            <strong>Session cookies.</strong> We set one HTTP-only cookie named{" "}
            <code>cacti_session</code> that holds a JWT identifying your session. We do not use
            analytics cookies, marketing cookies, or third-party tracking cookies.
          </p>
          <p>
            <strong>No data from anonymous visitors.</strong> If you browse The Cacti without
            signing in, we don&apos;t store anything about you.
          </p>

          <h2>How LLM providers see your queries</h2>
          <p>
            Every Intelligence Q&amp;A, report generation, and ingestion analysis sends content
            to the active LLM provider (Google Gemini, OpenAI, or DeepSeek) for processing.
            The content is the public-record civic data the system has ingested — never your
            personal Google profile data. Provider-side retention and use is governed by their
            respective policies; consult{" "}
            <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">
              Gemini
            </a>
            ,{" "}
            <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer">
              OpenAI
            </a>
            , or{" "}
            <a href="https://platform.deepseek.com/privacy" target="_blank" rel="noopener noreferrer">
              DeepSeek
            </a>{" "}
            for details.
          </p>

          <h2>Ingested content</h2>
          <p>
            The Cacti ingests publicly available civic content — news articles, government
            websites, public-record feeds. This content is already public by the time we
            collect it. We retain it indefinitely as a civic archive.
          </p>

          <h2>Account deletion</h2>
          <p>
            Email <a href="mailto:ai.sibling445@passmail.net">the owner</a> to delete your
            account. We&apos;ll purge your user record (email, name, avatar URL, tier) within
            7 days. Your past Intelligence queries — if any — are also deleted.
          </p>

          <h2>Data retention</h2>
          <p>
            Inactive user accounts are automatically purged after 12 months of no sign-in
            activity. Ingested civic content is kept indefinitely.
          </p>

          <h2>Children</h2>
          <p>
            The Cacti isn&apos;t targeted at or designed for children under 13. We don&apos;t
            knowingly collect data from anyone under 13.
          </p>

          <h2>Changes</h2>
          <p>
            We&apos;ll update the &quot;Last updated&quot; date above when material changes
            land. Continued use after that date constitutes acceptance.
          </p>

          <h2>Contact</h2>
          <p>
            Questions:{" "}
            <a href="mailto:ai.sibling445@passmail.net">ai.sibling445@passmail.net</a>
          </p>
        </article>
      </div>
    </div>
  );
}
