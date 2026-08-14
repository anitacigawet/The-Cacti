import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
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
            Terms of Service
          </h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-8" style={{ fontFamily: "var(--font-mono)" }}>
            Last updated 2026-05-20
          </p>

          <h2>What this is</h2>
          <p>
            The Cacti is a civic intelligence and AI-generated newspaper covering Mohave
            County, Arizona. By accessing it you agree to these terms. If you don&apos;t,
            don&apos;t use it.
          </p>

          <h2>Tiered access</h2>
          <p>
            <strong>Public (anonymous):</strong> read newspaper editions and browse documents
            with 24-hour-delayed data, no account required.{" "}
            <strong>Invited (signed in):</strong> 3-hour-delayed data, plus dashboard and
            entity graph. Invitation is at the owner&apos;s discretion.{" "}
            <strong>Owner:</strong> real-time data and admin tools.
          </p>
          <p>
            We may grant, change, or revoke any tier at any time without notice. If you lose
            access, your content stays in our archive but you stop seeing it.
          </p>

          <h2>What you can&apos;t do</h2>
          <p>
            <strong>Don&apos;t scrape The Cacti.</strong> Automated extraction of our content
            (newspaper articles, intelligence reports, entity graphs) at any scale beyond
            normal reading is prohibited. Use of automated agents (including LLM-driven
            browsers) to bulk-download is prohibited.
          </p>
          <p>
            <strong>Don&apos;t abuse the API.</strong> Excessive Intelligence Q&amp;A queries,
            report generation requests, or any pattern that imposes disproportionate cost on
            our LLM provider budget will result in tier downgrade or revocation.
          </p>
          <p>
            <strong>Don&apos;t republish.</strong> The AI-generated content here is for
            personal reading and reference. Don&apos;t syndicate, repost, or claim authorship.
            The underlying source articles belong to their original publishers — go to them
            for republication rights.
          </p>

          <h2>No warranty</h2>
          <p>
            The Cacti is provided <strong>as is</strong>. AI-generated content can be wrong,
            biased, or hallucinatory. Always verify against the cited source documents before
            acting on anything you read here. This site is not a substitute for primary
            sources, legal advice, financial advice, medical advice, or official government
            communication.
          </p>

          <h2>No liability</h2>
          <p>
            We aren&apos;t liable for any direct, indirect, incidental, or consequential
            damages arising from your use of The Cacti — including but not limited to acting
            on AI-generated content, downtime, data loss, or third-party LLM provider
            decisions.
          </p>

          <h2>Owner discretion</h2>
          <p>
            The owner reserves the right to modify, suspend, or shut down any part of The
            Cacti at any time, with or without notice, for any reason.
          </p>

          <h2>Changes to these terms</h2>
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
