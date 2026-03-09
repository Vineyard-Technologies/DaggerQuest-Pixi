/**
 * Login screen and loading-bar overlay.
 *
 * The login form is pure HTML rendered in index.html so it appears
 * instantly.  This module wires up interactivity and exposes helpers
 * that daggerquest.ts uses to report loading progress.
 *
 * Authentication is handled by Firebase Email / Password auth.
 */

import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    type AuthError,
} from 'firebase/auth';
import { auth } from './firebase';

// ── DOM handles ───────────────────────────────────────────────────────────

const loginOverlay   = document.getElementById('login-overlay')!;
const loginForm      = document.getElementById('login-form')! as HTMLFormElement;
const loginError     = document.getElementById('login-error')!;
const loginSubmit    = document.getElementById('login-submit')! as HTMLButtonElement;
const loginConfirm   = document.getElementById('login-confirm')! as HTMLInputElement;
const loginToggle    = document.getElementById('login-toggle')!;
const loginSubtitle  = document.getElementById('login-subtitle')!;

const loadingOverlay = document.getElementById('loading-overlay')!;
const loadingStatus  = document.getElementById('loading-status')!;
const loadingBarFill = document.getElementById('loading-bar-fill')!;

// ── State ─────────────────────────────────────────────────────────────────

let isCreateMode = false;

// ── Public API ────────────────────────────────────────────────────────────

/** Returns a promise that resolves once the user has authenticated. */
export function waitForLogin(): Promise<void> {
    return new Promise<void>((resolve) => {
        // Toggle between Sign In / Create Account modes.
        loginToggle.addEventListener('click', () => {
            isCreateMode = !isCreateMode;
            loginError.textContent = '';

            if (isCreateMode) {
                loginSubmit.textContent   = 'Create Account';
                loginSubtitle.textContent = 'Create your account';
                loginConfirm.style.display = '';
                loginConfirm.required      = true;
                loginToggle.innerHTML     =
                    'Have an account? <span style="color:#c8a84e;text-decoration:underline;">Sign in</span>';
            } else {
                loginSubmit.textContent   = 'Sign In';
                loginSubtitle.textContent = 'Enter the realm';
                loginConfirm.style.display = 'none';
                loginConfirm.required      = false;
                loginConfirm.value         = '';
                loginToggle.innerHTML     =
                    'No account? <span style="color:#c8a84e;text-decoration:underline;">Create one</span>';
            }
        });

        loginForm.addEventListener('submit', async (e: Event) => {
            e.preventDefault();

            const email    = (document.getElementById('login-email') as HTMLInputElement).value.trim();
            const password = (document.getElementById('login-password') as HTMLInputElement).value;

            if (!email || !password) {
                loginError.textContent = 'Please fill in both fields.';
                return;
            }

            if (isCreateMode && password !== loginConfirm.value) {
                loginError.textContent = 'Passwords do not match.';
                return;
            }

            loginError.textContent = '';
            loginSubmit.disabled   = true;
            loginSubmit.textContent = isCreateMode ? 'Creating…' : 'Signing in…';

            try {
                if (isCreateMode) {
                    await createUserWithEmailAndPassword(auth, email, password);
                } else {
                    await signInWithEmailAndPassword(auth, email, password);
                }

                showLoadingOverlay();
                resolve();
            } catch (err) {
                loginError.textContent = friendlyError(err as AuthError);
                loginSubmit.disabled   = false;
                loginSubmit.textContent = isCreateMode ? 'Create Account' : 'Sign In';
            }
        });
    });
}

/** Update the loading bar (0-100) and optional status text. */
export function setLoadingProgress(percent: number, status?: string): void {
    loadingBarFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    if (status !== undefined) {
        loadingStatus.textContent = status;
    }
}

/** Dismiss all overlays so the game canvas is visible. */
export function hideOverlays(): void {
    loadingOverlay.classList.add('hidden');
    // Remove from DOM after fade-out to avoid pointer-event leaks.
    setTimeout(() => {
        loginOverlay.remove();
        loadingOverlay.remove();
    }, 600);
}

// ── Internals ─────────────────────────────────────────────────────────────

function showLoadingOverlay(): void {
    // Fade out login, show loading.
    loginOverlay.classList.add('hidden');
    loadingOverlay.style.display = 'flex';
    setLoadingProgress(0, 'Authentication successful — loading game…');
}

/** Map Firebase error codes to player-friendly messages. */
function friendlyError(err: AuthError): string {
    switch (err.code) {
        case 'auth/invalid-email':            return 'Invalid email address.';
        case 'auth/user-disabled':            return 'This account has been disabled.';
        case 'auth/user-not-found':           return 'No account found with that email.';
        case 'auth/wrong-password':           return 'Incorrect password.';
        case 'auth/invalid-credential':       return 'Invalid email or password.';
        case 'auth/email-already-in-use':     return 'An account with that email already exists.';
        case 'auth/weak-password':            return 'Password must be at least 6 characters.';
        case 'auth/too-many-requests':        return 'Too many attempts — please try again later.';
        case 'auth/network-request-failed':   return 'Network error — check your connection.';
        case 'auth/blocking-function-error-response':
            return err.message?.includes('Too many accounts')
                ? 'Too many accounts created from this network today. Please try again tomorrow.'
                : 'Account creation was blocked. Please try again later.';
        default:                              return err.message ?? 'Authentication failed.';
    }
}
