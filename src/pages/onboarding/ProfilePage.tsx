// Profile onboarding (step 3) — captures name (required), photo (required),
// and an optional bio for everyone. Plus an optional ID image.
// Skills moved to step 4 (/onboarding/skills) — volunteers only.
// Stored at fixed Storage paths:
//   users/{uid}/photo
//   users/{uid}/id-image

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { useAuthState } from '../../lib/auth-context';
import { db, storage } from '../../lib/firebase';
import { OnboardingProgress } from '../../components/OnboardingProgress';

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_NAME = 80;
const MAX_BIO = 280;

function validateImage(file: File): string | null {
  if (!ALLOWED_MIME.includes(file.type)) {
    return 'Use a JPEG, PNG, or WebP image.';
  }
  if (file.size > MAX_BYTES) {
    return 'Image must be 2 MB or smaller.';
  }
  return null;
}

export default function ProfilePage() {
  const state = useAuthState();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nameId = useId();
  const bioId = useId();
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const idInputRef = useRef<HTMLInputElement | null>(null);
  const errorId = useId();

  const photoPreview = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile],
  );

  useEffect(() => {
    if (!photoPreview) return;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  if (state.status !== 'incomplete') return null;
  const user = state.user;
  const isVolunteer =
    state.userDoc.roles?.includes('volunteer') ?? false;

  function onPhotoChange(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setPhotoFile(null);
      return;
    }
    const v = validateImage(file);
    if (v) {
      setError(v);
      setPhotoFile(null);
      return;
    }
    setPhotoFile(file);
  }

  function onIdChange(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setIdFile(null);
      return;
    }
    const v = validateImage(file);
    if (v) {
      setError(v);
      setIdFile(null);
      return;
    }
    setIdFile(file);
  }

  async function handleSubmit() {
    setError(null);
    const trimmedName = displayName.trim();
    if (!trimmedName) return setError('Please enter a name.');
    if (trimmedName.length > MAX_NAME) {
      return setError(`Name must be ${String(MAX_NAME)} characters or fewer.`);
    }
    if (!photoFile) return setError('Please add a profile photo.');
    if (bio.length > MAX_BIO) {
      return setError(`Bio must be ${String(MAX_BIO)} characters or fewer.`);
    }

    setBusy(true);
    try {
      const photoPath = `users/${user.uid}/photo`;
      await uploadBytes(storageRef(storage(), photoPath), photoFile, {
        contentType: photoFile.type,
      });

      const update: Record<string, unknown> = {
        displayName: trimmedName,
        photoURL: photoPath,
      };
      if (bio.trim()) {
        update.bio = bio.trim();
      }

      if (idFile) {
        const idPath = `users/${user.uid}/id-image`;
        await uploadBytes(storageRef(storage(), idPath), idFile, {
          contentType: idFile.type,
        });
        update.idImagePath = idPath;
      }

      await updateDoc(doc(db(), 'users', user.uid), update);
      // ProtectedRoute on /onboarding/profile will redirect once the
      // onSnapshot delivers the new doc:
      //   - volunteer / dual: → /onboarding/skills (step 4)
      //   - customer-only:    → /app
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save your profile. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fafaf8] text-[#131312]">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#ececea] bg-white px-7">
        <div className="flex items-center gap-2.5 text-[15px] font-bold tracking-tight text-[#131312]">
          <span className="grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-gradient-to-br from-[#1f6f5c] to-[#185845] text-white">
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </span>
          Hey Padosi
        </div>
      </header>

      <div className="vc-screen-enter mx-auto max-w-2xl px-6 py-12 sm:py-20">
        <OnboardingProgress current={3} includeSkills={isVolunteer} />
        <h1 className="text-3xl font-bold tracking-tight text-[#131312]">
          Tell us about you
        </h1>
        <p className="mt-3 text-[#4f4b46]">
          A few details so neighbours can recognise you. You can update these
          later.
        </p>

        <div className="mt-10 flex items-center gap-6">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="group relative h-24 w-24 overflow-hidden rounded-full border border-[#ececea] bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2"
            aria-label="Choose profile photo"
          >
            {photoPreview ? (
              <img
                src={photoPreview}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs font-medium text-[#8a847d]">
                Add photo
              </span>
            )}
          </button>
          <div className="text-sm text-[#4f4b46]">
            <p>JPEG, PNG, or WebP. Up to 2 MB.</p>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="mt-1 font-semibold text-[#1f6f5c] hover:underline"
            >
              {photoFile ? 'Choose a different photo' : 'Choose a photo'}
            </button>
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept={ALLOWED_MIME.join(',')}
            onChange={onPhotoChange}
            className="sr-only"
          />
        </div>

        <div className="mt-10 space-y-8">
          <div>
            <label
              htmlFor={nameId}
              className="block text-sm font-medium text-[#131312]"
            >
              Name
            </label>
            <input
              id={nameId}
              type="text"
              autoComplete="name"
              maxLength={MAX_NAME}
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#ececea] bg-white px-4 py-3 text-base text-[#131312] placeholder-[#8a847d] transition focus:border-[#1f6f5c] focus:outline-none focus:ring-1 focus:ring-[#1f6f5c]"
            />
          </div>

          <div>
            <label
              htmlFor={bioId}
              className="block text-sm font-medium text-[#131312]"
            >
              About you{' '}
              <span className="font-normal text-[#8a847d]">(optional)</span>
            </label>
            <textarea
              id={bioId}
              maxLength={MAX_BIO}
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#ececea] bg-white px-4 py-3 text-base text-[#131312] placeholder-[#8a847d] transition focus:border-[#1f6f5c] focus:outline-none focus:ring-1 focus:ring-[#1f6f5c]"
              placeholder="A short line about you. What kind of help you tend to ask for, hours you're usually around."
            />
            <p className="mt-1 text-xs text-[#8a847d]">
              {bio.length} / {MAX_BIO}
            </p>
          </div>

          <div className="rounded-2xl border border-[#ececea] bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-[#131312]">
              ID image{' '}
              <span className="font-normal text-[#8a847d]">(optional)</span>
            </p>
            <p className="mt-1 text-sm text-[#4f4b46]">
              Upload a college / company / community ID to unlock medium-risk
              tasks. Only admins ever see this image; it is never shown
              publicly.
            </p>
            <button
              type="button"
              onClick={() => idInputRef.current?.click()}
              className="mt-3 rounded-full border border-[#ececea] bg-white px-4 py-2 text-sm font-semibold text-[#4f4b46] transition hover:bg-[#f3f1ec] hover:border-[#d8d4cc] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2"
            >
              {idFile ? `Selected: ${idFile.name}` : 'Choose ID image'}
            </button>
            <input
              ref={idInputRef}
              type="file"
              accept={ALLOWED_MIME.join(',')}
              onChange={onIdChange}
              className="sr-only"
            />
          </div>
        </div>

        {error && (
          <p id={errorId} role="alert" className="mt-6 text-sm text-[#a32a22]">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={busy}
          className="mt-10 rounded-full bg-[#1f6f5c] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#185845] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5c] focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {busy ? 'Uploading…' : isVolunteer ? 'Continue → Skills' : 'Continue'}
        </button>
      </div>
    </main>
  );
}

