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
    signOut,
    type AuthError,
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from './firebase';

// ── Cloud Function callables ──────────────────────────────────────────────

const functions = getFunctions(undefined, 'us-central1');

const callSendVerificationEmail = httpsCallable(functions, 'sendVerificationEmail');
const callSendResetEmail        = httpsCallable(functions, 'sendResetEmail');

// ── DOM handles ───────────────────────────────────────────────────────────

const loginOverlay   = document.getElementById('login-overlay')!;
const loginForm      = document.getElementById('login-form')! as HTMLFormElement;
const loginError     = document.getElementById('login-error')!;
const loginSubmit    = document.getElementById('login-submit')! as HTMLButtonElement;
const loginConfirm   = document.getElementById('login-confirm')! as HTMLInputElement;
const loginToggle    = document.getElementById('login-toggle')!;
const forgotPassword = document.getElementById('forgot-password')!;
const signInLink     = document.getElementById('sign-in-link')!;
const passwordReqs   = document.getElementById('password-requirements')!;
const loginPassword  = document.getElementById('login-password')! as HTMLInputElement;

const loadingOverlay = document.getElementById('loading-overlay')!;
const loadingStatus  = document.getElementById('loading-status')!;
const loadingBarFill = document.getElementById('loading-bar-fill')!;

// ── State ─────────────────────────────────────────────────────────────────

let mode: 'signin' | 'create' | 'forgot' = 'signin';

// ── Public API ────────────────────────────────────────────────────────────

/** Returns a promise that resolves once the user has authenticated. */
export function waitForLogin(): Promise<void> {
    return new Promise<void>((resolve) => {
        // Live password-strength indicator.
        const reqChecks: { key: string; test: (p: string) => boolean }[] = [
            { key: 'length',  test: (p) => p.length >= 8 },
            { key: 'upper',   test: (p) => /[A-Z]/.test(p) },
            { key: 'lower',   test: (p) => /[a-z]/.test(p) },
            { key: 'digit',   test: (p) => /[0-9]/.test(p) },
            { key: 'special', test: (p) => /[^A-Za-z0-9]/.test(p) },
        ];

        function updatePasswordReqs(): void {
            const pw = loginPassword.value;
            for (const { key, test } of reqChecks) {
                const li = passwordReqs.querySelector(`[data-req="${key}"]`)!;
                const icon = li.querySelector('.req-icon')!;
                if (test(pw)) {
                    icon.textContent = '✓';
                    (icon as HTMLElement).style.color = '#4caf50';
                } else {
                    icon.textContent = '✗';
                    (icon as HTMLElement).style.color = '#cc4444';
                }
            }
        }

        loginPassword.addEventListener('input', () => {
            if (mode === 'create') updatePasswordReqs();
        });

        function enterSignInMode(): void {
            mode = 'signin';
            loginError.textContent     = '';
            loginForm.reset();
            loginSubmit.textContent    = 'Sign In';
            loginPassword.style.display = '';
            loginConfirm.style.display = 'none';
            loginConfirm.required      = false;
            loginConfirm.value         = '';
            passwordReqs.style.display = 'none';
            forgotPassword.style.display = '';
            loginToggle.style.display  = '';
            signInLink.style.display   = 'none';
            loginToggle.innerHTML      =
                'No account? <span style="color:#c8a84e;text-decoration:underline;">Create one</span>';
        }

        // Toggle between Sign In / Create Account modes.
        loginToggle.addEventListener('click', () => {
            mode = mode === 'create' ? 'signin' : 'create';
            loginError.textContent = '';
            loginForm.reset();

            if (mode === 'create') {
                loginSubmit.textContent    = 'Create Account';
                loginPassword.style.display = '';
                loginConfirm.style.display = '';
                loginConfirm.required      = true;
                passwordReqs.style.display = '';
                updatePasswordReqs();
                forgotPassword.style.display = 'none';
                loginToggle.innerHTML      =
                    'Have an account? <span style="color:#c8a84e;text-decoration:underline;">Sign in</span>';
            } else {
                enterSignInMode();
            }
        });

        // Forgot password — switch to forgot mode.
        forgotPassword.addEventListener('click', () => {
            mode = 'forgot';
            loginError.textContent      = '';
            loginForm.reset();
            loginSubmit.textContent     = 'Reset Password';
            loginPassword.style.display = 'none';
            loginConfirm.style.display  = 'none';
            loginConfirm.required       = false;
            passwordReqs.style.display  = 'none';
            forgotPassword.style.display = 'none';
            loginToggle.style.display   = 'none';
            signInLink.style.display    = '';
        });

        // Return to sign-in from forgot mode.
        signInLink.addEventListener('click', () => {
            enterSignInMode();
        });

        loginForm.addEventListener('submit', async (e: Event) => {
            e.preventDefault();

            const email    = (document.getElementById('login-email') as HTMLInputElement).value.trim();
            const password = (document.getElementById('login-password') as HTMLInputElement).value;

            if (!email) {
                loginError.textContent = 'Please enter your email address.';
                return;
            }

            if (!isValidEmail(email)) {
                loginError.textContent = 'Please input a valid email address.';
                return;
            }

            // Forgot-password mode: send reset email and stop.
            if (mode === 'forgot') {
                loginSubmit.disabled    = true;
                loginSubmit.textContent = 'Sending…';
                try {
                    await callSendResetEmail({ email });
                    loginError.textContent = 'Password reset email sent! Check your inbox.';
                } catch (err) {
                    loginError.textContent = friendlyError(err as AuthError);
                }
                loginSubmit.disabled    = false;
                loginSubmit.textContent = 'Reset Password';
                return;
            }

            if (!password) {
                loginError.textContent = 'Please enter your password.';
                return;
            }

            if (mode === 'create') {
                const passwordIssue = validatePassword(password);
                if (passwordIssue) {
                    loginError.textContent = passwordIssue;
                    return;
                }
                if (password !== loginConfirm.value) {
                    loginError.textContent = 'Passwords do not match.';
                    return;
                }
            }

            loginError.textContent = '';
            loginSubmit.disabled   = true;
            loginSubmit.textContent = mode === 'create' ? 'Creating…' : 'Signing in…';

            try {
                if (mode === 'create') {
                    const { user } = await createUserWithEmailAndPassword(auth, email, password);
                    await callSendVerificationEmail();
                    await signOut(auth);
                    // Switch to sign-in mode so they can log in after verifying.
                    enterSignInMode();
                    loginError.textContent = 'Verification email sent! Please check your inbox and verify your email, then sign in.';
                    loginSubmit.disabled   = false;
                    return;
                } else {
                    const { user } = await signInWithEmailAndPassword(auth, email, password);
                    await user.reload();
                    if (!user.emailVerified) {
                        try {
                            await callSendVerificationEmail();
                        } catch {
                            // Email sending failed — still sign out and prompt verification.
                        }
                        await signOut(auth);
                        loginError.textContent = 'Please verify your email before signing in. A new verification email has been sent.';
                        loginSubmit.disabled   = false;
                        loginSubmit.textContent = 'Sign In';
                        return;
                    }
                }

                // Hide login — character select will appear next.
                loginOverlay.classList.add('hidden');
                resolve();
            } catch (err) {
                loginError.textContent = friendlyError(err as AuthError);
                loginSubmit.disabled   = false;
                loginSubmit.textContent = mode === 'create' ? 'Create Account' : 'Sign In';
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

/** Show the loading bar overlay after character selection. */
export function showLoadingOverlay(): void {
    loadingOverlay.style.display = 'flex';
    setLoadingProgress(0, 'Loading game…');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
    return EMAIL_RE.test(email);
}

/**
 * Returns an error message if the password is too weak, or `null` if it passes.
 * Requirements: ≥ 8 chars, uppercase, lowercase, digit, special character.
 */
function validatePassword(password: string): string | null {
    if (password.length < 8)        return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(password))    return 'Password must include an uppercase letter.';
    if (!/[a-z]/.test(password))    return 'Password must include a lowercase letter.';
    if (!/[0-9]/.test(password))    return 'Password must include a number.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include a special character.';
    return null;
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
