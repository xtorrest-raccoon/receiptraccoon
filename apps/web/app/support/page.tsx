import { LegalPageLayout, LegalSection } from "../../components/LegalPageLayout";

export default function SupportPage() {
  return (
    <LegalPageLayout title="Support" updated="August 3, 2026">
      <p>
        Need help, or something not working as expected? Email us at{" "}
        <a href="mailto:contact@receiptraccoon.fr" style={{ color: "inherit" }}>
          contact@receiptraccoon.fr
        </a>{" "}
        and we'll get back to you — please include your workspace name so we can find your account faster.
      </p>

      <LegalSection heading="Common questions">
        <p>
          <strong>I forgot my password.</strong> On the web app's sign-in screen, use "Forgot password?" to get a
          reset link by email. The mobile app doesn't have its own account creation or password reset — sign in
          there with the same email and password once you've reset it on the web.
        </p>
        <p>
          <strong>I was invited but never got the email.</strong> Ask whoever invited you to resend it from the web
          app's Setup page, and check your spam folder for a message from ReceiptRaccoon.
        </p>
        <p>
          <strong>How do I cancel my company's subscription?</strong> Whoever manages billing for your workspace can
          cancel or resume it from the web app's Payment page. This isn't available in the mobile app, since billing
          is handled entirely on the web.
        </p>
        <p>
          <strong>A receipt was read incorrectly.</strong> Open it and correct the amount, category, or other field
          directly — extracted data is a starting point, not locked in.
        </p>
      </LegalSection>

      <LegalSection heading="Deleting your account">
        <p>
          To delete your ReceiptRaccoon account and personal data, email{" "}
          <a href="mailto:contact@receiptraccoon.fr" style={{ color: "inherit" }}>
            contact@receiptraccoon.fr
          </a>{" "}
          from the email address on your account, with the subject line "Delete my account." We'll confirm your
          identity and remove your account, typically within 30 days. Note: if you're the only System Admin of your
          company's workspace, you'll need to promote someone else first (Setup's Profile Definition table) — a
          workspace can never be left with zero admins.
        </p>
        <p>
          To delete an entire company workspace (not just one person's account), a System Admin or Admin can do this
          directly from the web app's Setup page — no need to email us for that one.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
