/**
 * Login screen and loading-bar overlay.
 *
 * The login form is pure HTML rendered in index.html so it appears
 * instantly.  This module wires up interactivity and exposes helpers
 * that daggerquest.ts uses to report loading progress.
 */

// ── DOM handles ───────────────────────────────────────────────────────────

const loginOverlay   = document.getElementById('login-overlay')!;
const loginForm      = document.getElementById('login-form')! as HTMLFormElement;
const loginError     = document.getElementById('login-error')!;

const loadingOverlay = document.getElementById('loading-overlay')!;
const loadingStatus  = document.getElementById('loading-status')!;
const loadingBarFill = document.getElementById('loading-bar-fill')!;

// ── Public API ────────────────────────────────────────────────────────────

/** Returns a promise that resolves once the user has "logged in". */
export function waitForLogin(): Promise<void> {
    return new Promise<void>((resolve) => {
        loginForm.addEventListener('submit', (e: Event) => {
            e.preventDefault();

            const username = (document.getElementById('login-username') as HTMLInputElement).value.trim();
            const password = (document.getElementById('login-password') as HTMLInputElement).value;

            if (!username || !password) {
                loginError.textContent = 'Please fill in both fields.';
                return;
            }

            // Mock auth — accept anything.
            loginError.textContent = '';
            showLoadingOverlay();
            resolve();
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
