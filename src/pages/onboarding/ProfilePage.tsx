// Profile onboarding — captures name (required), photo (required), bio,
// and optional ID image. Uploads images to Storage and updates the
// users/{uid} doc. Reached only via ProtectedRoute requires="profile".
//
// Photo + ID image are stored at fixed paths:
//   users/{uid}/photo
//   users/{uid}/id-image
// Re-uploading replaces the prior file. The user doc records the Storage
// path string (not a public download URL).

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

  const photoPreview = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile],
  );

  const nameId = useId();
  const bioId = useId();
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const idInputRef = useRef<HTMLInputElement | null>(null);
  const errorId = useId();

  useEffect(() => {
    if (!photoPreview) return;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  if (state.status !== 'incomplete') return null;
  const user = state.user;

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
    if (!trimmedName) {
      setError('Please enter a name.');
      return;
    }
    if (trimmedName.length > MAX_NAME) {
      setError(`Name must be ${String(MAX_NAME)} characters or fewer.`);
      return;
    }
    if (bio.length > MAX_BIO) {
      setError(`Bio must be ${String(MAX_BIO)} characters or fewer.`);
      return;
    }
    if (!photoFile) {
      setError('Please add a profile photo.');
      return;
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
      if (bio.trim()) update.bio = bio.trim();

      if (idFile) {
        const idPath = `users/${user.uid}/id-image`;
        await uploadBytes(storageRef(storage(), idPath), idFile, {
          contentType: idFile.type,
        });
        update.idImagePath = idPath;
      }

      await updateDoc(doc(db(), 'users', user.uid), update);
      // Navigation handled by useRedirectWhenSignedIn() when state flips
      // to 'ready' — but ProfilePage isn't wired to that hook, so the
      // ProtectedRoute on /app + the onSnapshot update will pull us
      // forward naturally on the next render.
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
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
        <h1 className="text-3xl font-semibold tracking-tight">
          Tell us about you
        </h1>
        <p className="mt-3 text-neutral-600">
          A few details so neighbours can recognise you. You can update these
          later.
        </p>

        <div className="mt-10 flex items-center gap-6">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="group relative h-24 w-24 overflow-hidden rounded-full border border-neutral-300 bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
            aria-label="Choose profile photo"
          >
            {photoPreview ? (
              <img
                src={photoPreview}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                Add photo
              </span>
            )}
          </button>
          <div className="text-sm text-neutral-600">
            <p>JPEG, PNG, or WebP. Up to 2 MB.</p>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="mt-1 font-medium text-neutral-900 underline underline-offset-4 hover:no-underline"
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

        <div className="mt-10 space-y-6">
          <div>
            <label
              htmlFor={nameId}
              className="block text-sm font-medium text-neutral-900"
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
              className="mt-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-base text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <div>
            <label
              htmlFor={bioId}
              className="block text-sm font-medium text-neutral-900"
            >
              About you{' '}
              <span className="font-normal text-neutral-500">(optional)</span>
            </label>
            <textarea
              id={bioId}
              maxLength={MAX_BIO}
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-base text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              placeholder="A short line about you. Skills, what you can help with, hours you tend to be free."
            />
            <p className="mt-1 text-xs text-neutral-500">
              {bio.length} / {MAX_BIO}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-sm font-medium text-neutral-900">
              ID image{' '}
              <span className="font-normal text-neutral-500">(optional)</span>
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              Upload a college / company / community ID to unlock medium-risk
              tasks. Only admins ever see this image; it is never shown
              publicly.
            </p>
            <button
              type="button"
              onClick={() => idInputRef.current?.click()}
              className="mt-3 rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
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
          <p id={errorId} role="alert" className="mt-6 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={busy}
          className="mt-10 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {busy ? 'Uploading…' : 'Continue'}
        </button>
      </div>
    </main>
  );
}
