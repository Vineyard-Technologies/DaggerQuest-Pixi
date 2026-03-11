/**
 * Character select screen shown after login.
 *
 * Each account has 3 character slots. Players can create, delete,
 * and select characters before entering the game.
 */

import {
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    query,
    orderBy,
} from 'firebase/firestore';
import { auth, db } from './firebase';

// ── Types ─────────────────────────────────────────────────────────────────

export interface CharacterData {
    id: string;
    name: string;
    className: string;
    level: number;
    slot: number;
    createdAt: unknown;
}

const MAX_SLOTS = 3;
const MAX_NAME_LENGTH = 16;
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9 ]{0,14}[A-Za-z0-9]$/;

const CLASS_INFO: Record<string, { display: string; description: string }> = {
    chevalier: {
        display: 'Chevalier',
        description: 'A swift swordsman specializing in agile combat.',
    },
    vanguard: {
        display: 'Vanguard',
        description: 'A sturdy warrior clad in heavy armor.',
    },
};

// ── DOM handles ───────────────────────────────────────────────────────────

const overlay     = document.getElementById('charselect-overlay')!;
const slotsEl     = document.getElementById('charselect-slots')!;
const createPanel = document.getElementById('charselect-create')!;
const errorEl     = document.getElementById('charselect-error')!;

// ── State ─────────────────────────────────────────────────────────────────

let characters: CharacterData[] = [];
let resolveSelection: ((char: CharacterData) => void) | null = null;

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Shows the character select screen and returns a promise that resolves
 * with the selected character data once the player picks one.
 */
export function waitForCharacterSelect(): Promise<CharacterData> {
    return new Promise<CharacterData>(async (resolve) => {
        resolveSelection = resolve;
        overlay.style.display = 'flex';
        await loadCharacters();
        renderSlots();
    });
}

/** Hide the character select overlay. */
export function hideCharacterSelect(): void {
    overlay.classList.add('hidden');
    setTimeout(() => overlay.remove(), 600);
}

// ── Firestore Operations ──────────────────────────────────────────────────

async function loadCharacters(): Promise<void> {
    const uid = auth.currentUser!.uid;
    const charCol = collection(db, 'users', uid, 'characters');
    const q = query(charCol, orderBy('slot'));
    const snap = await getDocs(q);
    characters = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CharacterData));
}

async function createCharacter(name: string, className: string, slot: number): Promise<void> {
    const uid = auth.currentUser!.uid;
    const charCol = collection(db, 'users', uid, 'characters');
    await addDoc(charCol, {
        name,
        className,
        level: 1,
        slot,
        createdAt: serverTimestamp(),
    });
}

async function deleteCharacter(charId: string): Promise<void> {
    const uid = auth.currentUser!.uid;
    const charDoc = doc(db, 'users', uid, 'characters', charId);
    await deleteDoc(charDoc);
}

// ── Rendering ─────────────────────────────────────────────────────────────

function renderSlots(): void {
    slotsEl.innerHTML = '';
    createPanel.innerHTML = '';
    createPanel.style.display = 'none';
    errorEl.textContent = '';

    for (let i = 0; i < MAX_SLOTS; i++) {
        const char = characters.find((c) => c.slot === i);
        const slotEl = document.createElement('div');
        slotEl.className = 'charselect-slot';

        if (char) {
            slotEl.innerHTML = `
                <div class="charselect-slot-info">
                    <div class="charselect-slot-name">${escapeHtml(char.name)}</div>
                    <div class="charselect-slot-detail">
                        Level ${char.level} ${CLASS_INFO[char.className]?.display ?? char.className}
                    </div>
                </div>
                <div class="charselect-slot-actions">
                    <button class="charselect-btn charselect-btn-play" data-slot="${i}">Play</button>
                    <button class="charselect-btn charselect-btn-delete" data-slot="${i}">Delete</button>
                </div>
            `;

            const playBtn = slotEl.querySelector('.charselect-btn-play')!;
            playBtn.addEventListener('click', () => selectCharacter(char));

            const deleteBtn = slotEl.querySelector('.charselect-btn-delete')!;
            deleteBtn.addEventListener('click', () => confirmDelete(char));
        } else {
            slotEl.innerHTML = `
                <div class="charselect-slot-empty">Empty Slot</div>
                <button class="charselect-btn charselect-btn-create" data-slot="${i}">Create Character</button>
            `;

            const createBtn = slotEl.querySelector('.charselect-btn-create')!;
            createBtn.addEventListener('click', () => showCreateForm(i));
        }

        slotsEl.appendChild(slotEl);
    }
}

function showCreateForm(slot: number): void {
    errorEl.textContent = '';
    createPanel.style.display = 'flex';

    createPanel.innerHTML = `
        <div class="charselect-create-title">Create Character</div>
        <input type="text" id="charselect-name-input"
               placeholder="Character Name"
               maxlength="${MAX_NAME_LENGTH}"
               autocomplete="off" />
        <div class="charselect-class-picker">
            ${Object.entries(CLASS_INFO).map(([key, info]) => `
                <button class="charselect-class-btn" data-class="${key}">
                    <div class="charselect-class-name">${info.display}</div>
                    <div class="charselect-class-desc">${info.description}</div>
                </button>
            `).join('')}
        </div>
        <div class="charselect-create-actions">
            <button class="charselect-btn charselect-btn-confirm" id="charselect-confirm-create" disabled>Create</button>
            <button class="charselect-btn charselect-btn-cancel" id="charselect-cancel-create">Cancel</button>
        </div>
    `;

    const nameInput = document.getElementById('charselect-name-input')! as HTMLInputElement;
    const confirmBtn = document.getElementById('charselect-confirm-create')! as HTMLButtonElement;
    const cancelBtn = document.getElementById('charselect-cancel-create')!;
    const classButtons = createPanel.querySelectorAll('.charselect-class-btn');

    let selectedClass = '';

    function updateConfirmState(): void {
        confirmBtn.disabled = !selectedClass || !nameInput.value.trim();
    }

    nameInput.addEventListener('input', updateConfirmState);
    nameInput.focus();

    classButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            classButtons.forEach((b) => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedClass = (btn as HTMLElement).dataset.class!;
            updateConfirmState();
        });
    });

    cancelBtn.addEventListener('click', () => {
        createPanel.style.display = 'none';
        createPanel.innerHTML = '';
        errorEl.textContent = '';
    });

    confirmBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();

        if (!name) {
            errorEl.textContent = 'Please enter a character name.';
            return;
        }
        if (name.length < 2) {
            errorEl.textContent = 'Name must be at least 2 characters.';
            return;
        }
        if (name.length > MAX_NAME_LENGTH) {
            errorEl.textContent = `Name must be at most ${MAX_NAME_LENGTH} characters.`;
            return;
        }
        if (!NAME_PATTERN.test(name)) {
            errorEl.textContent = 'Name must start with a letter and contain only letters, numbers, and spaces.';
            return;
        }
        if (!selectedClass || !CLASS_INFO[selectedClass]) {
            errorEl.textContent = 'Please select a class.';
            return;
        }

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Creating…';
        errorEl.textContent = '';

        try {
            await createCharacter(name, selectedClass, slot);
            await loadCharacters();
            renderSlots();
        } catch (err) {
            errorEl.textContent = 'Failed to create character. Please try again.';
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Create';
        }
    });
}

function confirmDelete(char: CharacterData): void {
    errorEl.textContent = '';
    createPanel.style.display = 'flex';

    createPanel.innerHTML = `
        <div class="charselect-create-title">Delete Character</div>
        <div class="charselect-delete-warning">
            Are you sure you want to delete
            <strong>${escapeHtml(char.name)}</strong>?<br>
            This action cannot be undone.<br><br>
            Type the character's name to confirm:
        </div>
        <input type="text" id="charselect-delete-input"
               placeholder="${escapeHtml(char.name)}"
               autocomplete="off" />
        <div class="charselect-create-actions">
            <button class="charselect-btn charselect-btn-danger" id="charselect-confirm-delete" disabled>Delete</button>
            <button class="charselect-btn charselect-btn-cancel" id="charselect-cancel-delete">Cancel</button>
        </div>
    `;

    const deleteInput = document.getElementById('charselect-delete-input')! as HTMLInputElement;
    const confirmBtn = document.getElementById('charselect-confirm-delete')! as HTMLButtonElement;
    const cancelBtn = document.getElementById('charselect-cancel-delete')!;

    deleteInput.addEventListener('input', () => {
        confirmBtn.disabled = deleteInput.value !== char.name;
    });

    deleteInput.focus();

    cancelBtn.addEventListener('click', () => {
        createPanel.style.display = 'none';
        createPanel.innerHTML = '';
        errorEl.textContent = '';
    });

    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Deleting…';
        errorEl.textContent = '';

        try {
            await deleteCharacter(char.id);
            await loadCharacters();
            renderSlots();
        } catch (err) {
            errorEl.textContent = 'Failed to delete character. Please try again.';
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Delete';
        }
    });
}

function selectCharacter(char: CharacterData): void {
    if (resolveSelection) {
        resolveSelection(char);
        resolveSelection = null;
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
