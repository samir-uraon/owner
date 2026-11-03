
"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  FileText,
  Mail,
  ExternalLink,
  AlertTriangle,
  ChevronRight,
  LockKeyhole,
} from "lucide-react";

const UPDATED = "2 November 2026";
const EMAIL = "theinsightfact04@gmail.com";
const SITE = "https://zeriy.com";

const OPERATOR = "[INSERT LEGAL NAME OF ZERIY OPERATOR]";
const ADDRESS = "[INSERT PRINCIPAL BUSINESS ADDRESS]";
const GRIEVANCE =
  "[INSERT GRIEVANCE OFFICER NAME/DESIGNATION AND CONTACT DETAILS]";

const sections = [
  [
    "1. Who operates ZERIY",
    [
      `Operator: ${OPERATOR}. Principal address: ${ADDRESS}. Website: ${SITE}. Support/privacy email: ${EMAIL}. The domain name is not itself proof of a registered legal business name.`,
      `Grievance contact: ${GRIEVANCE}. Complete all placeholders before publishing.`,
    ],
  ],
  [
    "2. Information we may collect",
    [
      "Account information: name, email address, mobile number, sign-in/authentication information, and profile details you provide. ZERIY should not store plain-text passwords; credentials must be protected using appropriate security controls.",
      "Booking information: selected service and provider, appointment date/time, token or queue details, booking status, acceptance/rejection, cancellation history, and booking-related communications.",
      "Payment information: payment status, amount, transaction/reference IDs, refund status, and limited information returned by Razorpay. Do not store full card credentials, CVV, or UPI PINs.",
      "Location: precise device location may be processed if you grant GPS permission, to find nearby businesses or provide location-based features. You can disable permission in device settings.",
      "Support information: complaints, reviews, ratings, and messages you send to support. Technical information such as device, browser, IP address, app version, crash and usage data may be processed if relevant tools are implemented. Analytics vendors have not yet been finalised.",
    ],
  ],
  [
    "3. How we use information",
    [
      "Create accounts and authenticate users, including email/password and Google sign-in where available.",
      "Receive and manage booking requests; communicate acceptance or rejection; provide token updates, reminders, essential notifications, and customer support.",
      "Process or reconcile payments, refunds, duplicate-payment reports, chargebacks, and fraud/security investigations.",
      "Maintain and improve the Platform, investigate abuse, enforce terms, and comply with legal obligations. Analytics or diagnostics will be used only if implemented with appropriate notices and controls.",
    ],
  ],
  [
    "4. Location permission",
    [
      "If GPS is requested, the app should explain the purpose before asking for permission. Location should be used for disclosed purposes such as nearby-provider search, not unrelated tracking.",
      "You can deny or withdraw device-level permission; some location features may then be unavailable. Manual location selection should be offered where feasible.",
    ],
  ],
  [
    "5. Sharing information",
    [
      "Relevant business owners may receive only information reasonably necessary to fulfil a booking, such as customer name, selected service, appointment time, booking/token status, and contact details where needed.",
      "Information may be shared with payment providers such as Razorpay; hosting/database providers; authentication/email services; SMS/OTP providers; location/map providers; and analytics/diagnostic vendors if enabled.",
      "Information may be disclosed where required by law or valid legal process, or where reasonably necessary to protect safety, rights, security, or investigate fraud. ZERIY does not intend to sell customer personal information. Owners must not use booking data for unrelated marketing or share it onward without an appropriate lawful basis and required permission.",
    ],
  ],
  [
    "6. Notifications and marketing",
    [
      "Essential notices may include authentication, security, booking acceptance/rejection, booking changes, token updates, reminders, and payment/refund status.",
      "The current plan is to send essential notifications, not promotional messages. If marketing is added, it should be described transparently with applicable consent and opt-out controls.",
    ],
  ],
  [
    "7. Children and young users",
    [
      "The product decision is that minors may use ZERIY with parental or guardian involvement, but the implementation is not finalised. Do not enable independent minor accounts or bookings until appropriate safeguards and legal review are completed.",
      "If you believe a child has provided information in a way that is not permitted, contact support for review.",
    ],
  ],
  [
    "8. Retention and deletion",
    [
      "ZERIY will retain information only as reasonably necessary for accounts, bookings, refunds, support, security, disputes, and legal/accounting duties. The detailed retention schedule is not yet finalised and must be set before launch.",
      "Users may request account deletion through support or an in-app feature when available. Deletion may not immediately remove records required for lawful financial, tax, fraud-prevention, dispute, or compliance purposes. Retained data should be restricted and deleted when no longer needed.",
    ],
  ],
  [
    "9. Security and your choices",
    [
      "ZERIY intends to use reasonable safeguards such as access controls, secure transmission, protected credentials, backups, and incident response. No online service can guarantee absolute security.",
      "Depending on applicable law and provisions in force, you may be able to request access, correction, deletion, withdraw consent where processing relies on consent, or raise a grievance. Contact support; identity verification may be required.",
    ],
  ],
  [
    "10. Third-party services and changes",
    [
      "Payment, hosting, authentication, location, communication, and analytics providers may have their own privacy notices. ZERIY should identify the actual vendors used in the live app before launch.",
      "We may update this Policy as the service or law changes. Material changes will be communicated through an appropriate channel, the effective date updated, and consent obtained where required for a new purpose.",
    ],
  ],
  [
    "11. Contact and grievance",
    [
      `Support/privacy email: ${EMAIL}. Website: ${SITE}.`,
      `Operator: ${OPERATOR}. Address: ${ADDRESS}.`,
      `Grievance contact: ${GRIEVANCE}. Replace the placeholders before publication.`,
    ],
  ],
];

function PolicyPage({ title, kind, warning, intro, sections }) {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">

        {/* Back button */}
        <button
          type="button"
          onClick={handleBack}
          className="group mb-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-md active:scale-95"
        >
          <ArrowLeft
            size={17}
            className="transition-transform duration-200 group-hover:-translate-x-1"
          />
          Back
        </button>

        {/* Header */}
        <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-6 sm:px-9">
            <div className="mb-6 flex items-center justify-between gap-4">
              <Image
                src="/logo.png"
                alt="ZERIY"
                width={130}
                height={44}
                priority
                className="h-10 w-auto object-contain rounded-xl"
              />

              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
                <ShieldCheck size={14} />
                {kind}
              </span>
            </div>

            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
              ZERIY · Customer Protection
            </p>

            <h1 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl">
              {title}
            </h1>

            <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <FileText size={15} />
              Last updated: {UPDATED}
            </p>
          </div>

          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 text-white sm:px-9">
            <div className="flex items-center gap-3">
              <LockKeyhole size={22} className="shrink-0 text-indigo-100" />
              <p className="text-sm leading-7 text-indigo-50">
                Your privacy matters. Learn how ZERIY collects, uses,
                protects, and shares your personal information.
              </p>
            </div>
          </div>
        </header>

        {/* Publishing warning */}
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={21}
              className="mt-0.5 shrink-0 text-amber-600"
            />

            <div>
              <h2 className="font-bold text-amber-900">
                Before publishing
              </h2>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                {warning}
              </p>
            </div>
          </div>
        </section>

        {/* Introduction */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="mb-3 flex items-center gap-2 text-indigo-700">
            <ShieldCheck size={19} />
            <h2 className="font-bold">Privacy overview</h2>
          </div>

          <p className="text-sm leading-7 text-slate-600 sm:text-base">
            {intro}
          </p>
        </section>

        {/* Policy sections */}
        <div className="mt-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Privacy policy details
            </h2>

            <span className="text-xs font-medium text-slate-400">
              {sections.length} sections
            </span>
          </div>

          <div className="space-y-4">
            {sections.map(([heading, items], index) => (
              <section
                key={heading}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-100 hover:shadow-md sm:p-7"
              >
                <div className="mb-4 flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold leading-7 text-slate-900 sm:text-lg">
                      {heading}
                    </h3>
                  </div>

                  <ChevronRight
                    size={18}
                    className="mt-1 shrink-0 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-indigo-500"
                  />
                </div>

                <div className="space-y-3 pl-0 sm:pl-12">
                  {items.map((item, i) => (
                    <p
                      key={i}
                      className="text-sm leading-7 text-slate-600"
                    >
                      {item}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* Contact section */}
        <section className="mt-8 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 to-violet-700 p-6 text-white shadow-lg sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Mail size={22} />
            </div>

            <div className="min-w-0">
              <h2 className="text-lg font-bold">
                Privacy questions or concerns?
              </h2>

              <p className="mt-2 text-sm leading-6 text-indigo-100">
                Contact our support team for privacy requests, account
                concerns, information corrections, or grievances.
              </p>

              <a
                href={`mailto:${EMAIL}`}
                className="mt-4 inline-flex max-w-full items-center gap-2 break-all rounded-xl bg-white px-4 py-3 text-sm font-bold text-indigo-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-indigo-50 hover:shadow-md active:scale-95"
              >
                <Mail size={16} />
                {EMAIL}
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-8 border-t border-slate-200 py-6 text-center">
          <Image
            src="/logo.png"
            alt="ZERIY"
            width={100}
            height={34}
            className="mx-auto mb-3 h-8 w-auto object-contain opacity-80"
          />

          <p className="text-xs leading-6 text-slate-500">
            © {new Date().getFullYear()} ZERIY. All rights reserved.
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Made Simpler & Much Faster
          </p>

          <a
            href={SITE}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition-colors hover:text-indigo-800"
          >
            zeriy.com
            <ExternalLink size={12} />
          </a>
        </footer>
      </div>
    </main>
  );
}

export default function UserPrivacyPolicy() {
  return (
    <PolicyPage
      title="Customer Privacy Policy"
      kind="Privacy"
      warning="Replace the legal operator/address/grievance placeholders, confirm the actual data flows and vendors, and obtain Indian legal review before publication."
      intro="This Policy explains how ZERIY handles customer personal information. Booking cancellation and refund eligibility are in the Customer Terms & Conditions, not this Privacy Policy."
      sections={sections}
    />
  );
}
