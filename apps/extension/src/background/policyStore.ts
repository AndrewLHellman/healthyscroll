import type { UserPolicy } from "@healthyscroll/shared";

const KEY = "policy";

const DEFAULT_POLICY: UserPolicy = {
  prompt: "",
  enabled: false,
  updatedAt: 0,
};

/** Thin wrapper over chrome.storage.sync so the popup and background share one policy. */
export async function getPolicy(): Promise<UserPolicy> {
  const result = await chrome.storage.sync.get(KEY);
  return { ...DEFAULT_POLICY, ...(result[KEY] as Partial<UserPolicy> | undefined) };
}

export async function setPolicy(patch: Partial<UserPolicy>): Promise<UserPolicy> {
  const current = await getPolicy();
  const next: UserPolicy = { ...current, ...patch, updatedAt: Date.now() };
  await chrome.storage.sync.set({ [KEY]: next });
  return next;
}

/** Overwrites the local policy as-is, keeping its updatedAt (used when pulling from Supabase). */
export async function replacePolicy(policy: UserPolicy): Promise<void> {
  await chrome.storage.sync.set({ [KEY]: policy });
}

export function onPolicyChange(cb: (policy: UserPolicy) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
    if (changes[KEY]) {
      cb({ ...DEFAULT_POLICY, ...(changes[KEY].newValue as Partial<UserPolicy> | undefined) });
    }
  };
  chrome.storage.sync.onChanged.addListener(listener);
  return () => chrome.storage.sync.onChanged.removeListener(listener);
}
