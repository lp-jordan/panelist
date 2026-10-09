import type { Metadata } from "next";
import Link from "next/link";
import "./privacy.css";

export const metadata: Metadata = { title: "Privacy · Panelist" };

// The privacy note. Reachable signed out (see isPublic in src/proxy.ts). Keep it
// in step with the code: anything new that stores data, or a new outside
// service, belongs here.

const CONTACT = "howdy@renownedcomic.com";
const UPDATED = "October 9, 2026";

export default function PrivacyPage() {
  return (
    <main className="privacy">
      <article className="privacy-body">
        <Link href="/" className="privacy-back">
          Panelist
        </Link>
        <h1>Privacy</h1>
        <p className="privacy-meta">Last updated {UPDATED}</p>

        <p>
          Panelist is a small tool for writing comic scripts and working on them with your team. It&rsquo;s run by me,
          Jordan Johnson, as an individual. This page says plainly what it stores, where, and who can see it.
        </p>

        <h2>What Panelist stores</h2>
        <ul>
          <li>
            <strong>Your account:</strong> your name and email address. There are no passwords. You sign in with a
            one-time code or link sent to your email.
          </li>
          <li>
            <strong>Your work:</strong> scripts, pages, panels, notes, the scratch pad, saved versions of each script,
            cast names, and project membership and invites.
          </li>
          <li>
            <strong>Reference images and links:</strong> images you upload as references, the pages of PDFs you
            import, and any links you save as references.
          </li>
          <li>
            <strong>Art:</strong> every version of art you upload, a smaller preview made from it, its file name and
            size, who uploaded it and when, and notes left on it.
          </li>
          <li>
            <strong>Activity:</strong> a record of who did certain things and when, like deleting an art version, so
            a project&rsquo;s history still makes sense after something is removed.
          </li>
        </ul>
        <p>
          Panelist doesn&rsquo;t use analytics, ad trackers, or third-party scripts. It never sells or shares your data
          for marketing. The only cookie is the one that keeps you signed in.
        </p>

        <h2>Where it&rsquo;s kept</h2>
        <ul>
          <li>
            <strong>Railway</strong> runs the app and its database. Your account, your work, reference images and
            imported PDF pages live in that database.
          </li>
          <li>
            <strong>Cloudflare R2</strong> stores art files and their previews. Cloudflare encrypts stored files.
          </li>
          <li>
            <strong>Resend</strong> sends sign-in and invite emails, so it sees your email address and the message.
          </li>
        </ul>
        <p>
          Railway keeps server logs for a limited time. They can include details like which page was requested, and
          are only used to fix problems.
        </p>

        <h2>Who can see your work</h2>
        <p>
          Only you and the people you add to a project. Every request is checked against your project membership on
          the server, including every image and art file.
        </p>
        <p>
          Nothing in Panelist is public. Reference images are only served through the app after that check. Art files
          sit in private storage. When you open or download one, the app hands your browser a link that works for a
          few minutes, and only after checking you&rsquo;re on the project. Uploads go the same way.
        </p>
        <p>
          As the person who runs Panelist, I can technically access the database and storage. I only do that to keep
          the service running, fix a problem, or act on a request from you.
        </p>

        <h2>How it&rsquo;s protected</h2>
        <ul>
          <li>Everything travels over HTTPS.</li>
          <li>
            Sign-in codes expire after 15 minutes, work once, and lock after a few wrong guesses. They&rsquo;re stored
            only in a scrambled (hashed) form, never as the code itself.
          </li>
          <li>
            The sign-in cookie is encrypted, can&rsquo;t be read by page scripts, and lasts 30 days. Logging out ends
            it.
          </li>
          <li>Repeated sign-in attempts are rate limited.</li>
          <li>The app sets strict browser security rules so other sites can&rsquo;t embed it or run code in it.</li>
        </ul>
        <p>No system is perfectly secure. If something ever goes wrong with your data, I&rsquo;ll tell you directly.</p>

        <h2>Deleting your data</h2>
        <p>
          Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> from the address on your account and I&rsquo;ll delete your
          account and everything you&rsquo;ve stored. Art files and reference images are deleted along with it. Work
          that belongs to a project you share with others stays with the project unless you ask for it to be removed.
        </p>
        <p>
          Panelist doesn&rsquo;t keep separate backups right now, so once something is deleted, it&rsquo;s gone. If that
          changes, this page will say how long backups are kept.
        </p>

        <h2>Changes and questions</h2>
        <p>
          If this changes, the date at the top will change with it, and anything significant will be shared with you
          directly. Questions go to <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </article>
    </main>
  );
}
